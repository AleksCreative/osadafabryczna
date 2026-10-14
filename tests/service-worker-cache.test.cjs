// Run: node --test tests/service-worker-cache.test.cjs
// Uses in-memory Cache API mocks; no browser, network or WordPress writes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const workerPath = process.env.OSADA_SW_TEST_PATH || path.join(__dirname, '../dist/assets/service-worker.js');
const source = fs.readFileSync(workerPath, 'utf8');
const origin = 'https://osada.example';
const runtimeName = 'osada-fabryczna-v5-runtime';
const buildingsName = 'osada-fabryczna-v5-buildings';
const publicHeaders = { 'X-Osada-PWA-Cache': 'public' };
const data = value => new Response(JSON.stringify([{ id: value }]), {
  headers: { ...publicHeaders, 'Content-Type': 'application/json' },
});
const request = (version = 1, language = 'pl', extra = '') => new Request(
  `${origin}/wp-json/wp/v2/budynek?language=${language}&per_page=70&content_version=${version}${extra}`
);

function setup() {
  const stores = new Map();
  const handlers = {};
  let calls = 0;
  let fetcher = async () => data(1);
  let failOpen = false;
  let claimed = false;
  let skipped = false;
  let failCleanup = false;
  const caches = {
    async open(name) {
      if (failOpen) throw new Error('Storage unavailable');
      if (!stores.has(name)) {
        const entries = new Map();
        const key = input => typeof input === 'string' ? input : input.url;
        stores.set(name, {
          failPut: false,
          failMatch: false,
          async match(input) {
            if (this.failMatch) throw new Error('Read unavailable');
            return entries.get(key(input))?.clone();
          },
          async put(input, response) {
            if (this.failPut) throw new Error('Quota exceeded');
            entries.set(key(input), response.clone());
          },
          async keys() { return [...entries.keys()].map(url => new Request(url)); },
          async delete(input) { return entries.delete(key(input)); },
          async add(input) { await this.put(input, new Response('offline')); },
        });
      }
      return stores.get(name);
    },
    async keys() {
      if (failCleanup) throw new Error('Cache enumeration unavailable');
      return [...stores.keys()];
    },
    async delete(name) { return stores.delete(name); },
    async match(input) {
      for (const cache of stores.values()) {
        const result = await cache.match(input);
        if (result) return result;
      }
    },
  };
  const context = vm.createContext({
    URL, Request, Response, Headers, caches,
    console: { warn() {} },
    OSADA_PWA_CONFIG: { offlineUrl: `${origin}/offline.html`, themeUrl: `${origin}/theme/` },
    self: {
      location: { origin },
      addEventListener: (name, callback) => { handlers[name] = callback; },
      skipWaiting: async () => { skipped = true; },
      clients: { claim: async () => { claimed = true; } },
    },
    fetch: async (...args) => { calls++; return fetcher(...args); },
  });
  vm.runInContext(source, context);
  return {
    context, caches,
    calls: () => calls,
    fetchWith: fn => { fetcher = fn; },
    failStorage: () => { failOpen = true; },
    failCleanup: () => { failCleanup = true; },
    claimed: () => claimed,
    skipped: () => skipped,
    async get(req) {
      let response;
      handlers.fetch({ request: req, respondWith: promise => { response = promise; } });
      return response;
    },
    async activate() {
      let work;
      handlers.activate({ waitUntil: promise => { work = promise; } });
      await work;
    },
    async install() {
      let work;
      handlers.install({ waitUntil: promise => { work = promise; } });
      await work;
    },
  };
}

test('unchanged version uses saved data with no second network request', async () => {
  const s = setup();
  await s.get(request());
  s.fetchWith(() => { throw new Error('Should not fetch'); });
  assert.deepEqual(await (await s.get(request())).json(), [{ id: 1 }]);
  assert.equal(s.calls(), 1);
});

test('new version downloads data and prunes only previous versions of that query', async () => {
  const s = setup();
  await s.get(request(1, 'pl'));
  await s.get(request(1, 'en'));
  await s.get(request(1, 'pl', '&page=2'));
  s.fetchWith(async () => data(2));
  assert.deepEqual(await (await s.get(request(2))).json(), [{ id: 2 }]);
  const keys = (await (await s.caches.open(buildingsName)).keys()).map(r => r.url);
  assert.equal(keys.length, 3);
  assert.ok(keys.some(k => k.includes('language=en')));
  assert.ok(keys.some(k => k.includes('page=2')));
  assert.equal(s.calls(), 4);
});

test('offline fallback is not saved under the new version and retries when online', async () => {
  const s = setup();
  await s.get(request(1));
  s.fetchWith(async () => { throw new Error('Offline'); });
  assert.deepEqual(await (await s.get(request(2))).json(), [{ id: 1 }]);
  const cache = await s.caches.open(buildingsName);
  assert.equal((await cache.keys()).length, 1);
  s.fetchWith(async () => data(2));
  assert.deepEqual(await (await s.get(request(2))).json(), [{ id: 2 }]);
  assert.equal(s.calls(), 3);
});

test('offline data never crosses language or filter boundaries', async () => {
  const s = setup();
  await s.get(request(1, 'pl'));
  s.fetchWith(async () => { throw new Error('Offline'); });
  assert.equal((await s.get(request(2, 'en'))).type, 'error');
  assert.equal((await s.get(request(2, 'pl', '&page=2'))).type, 'error');
});

test('server errors and malformed JSON cannot replace valid offline data', async () => {
  const s = setup();
  await s.get(request());
  for (const bad of [new Response('Error', { status: 503 }), new Response('<html>Bad response</html>', { headers: publicHeaders }), new Response('{}', { headers: publicHeaders })]) {
    s.fetchWith(async () => bad.clone());
    assert.deepEqual(await (await s.get(request(2))).json(), [{ id: 1 }]);
  }
  assert.equal((await (await s.caches.open(buildingsName)).keys()).length, 1);
});

test('storage failure still returns a successful network response', async () => {
  const s = setup();
  s.failStorage();
  assert.deepEqual(await (await s.get(request())).json(), [{ id: 1 }]);
});

test('quota error does not discard last offline copy or hide fresh network data', async () => {
  const s = setup();
  await s.get(request());
  const cache = await s.caches.open(buildingsName);
  cache.failPut = true;
  s.fetchWith(async () => data(2));
  assert.deepEqual(await (await s.get(request(2))).json(), [{ id: 2 }]);
  s.fetchWith(async () => { throw new Error('Offline'); });
  assert.deepEqual(await (await s.get(request(3))).json(), [{ id: 1 }]);
});

test('activation migrates latest legacy PL/EN data without deleting pages or map tiles', async () => {
  const s = setup();
  const runtime = await s.caches.open(runtimeName);
  await runtime.put(request(1), data(1));
  await runtime.put(request(3), data(3));
  await runtime.put(request(2), data(2));
  await runtime.put(request(2, 'en'), data(20));
  await runtime.put(`${origin}/theme/tile.webp`, new Response('tile'));
  await runtime.put(`${origin}/`, new Response('page'));
  await s.activate();
  assert.equal((await (await s.caches.open(buildingsName)).keys()).length, 2);
  assert.equal((await runtime.keys()).length, 2);
  assert.equal(await (await runtime.match(`${origin}/theme/tile.webp`)).text(), 'tile');
  assert.deepEqual(await (await s.get(request(3))).json(), [{ id: 3 }]);
  assert.equal(s.calls(), 0);
});

test('migration failure preserves legacy data for offline fallback', async () => {
  const s = setup();
  const runtime = await s.caches.open(runtimeName);
  await runtime.put(request(), data(1));
  (await s.caches.open(buildingsName)).failPut = true;
  await s.activate();
  assert.equal((await runtime.keys()).length, 1);
  s.fetchWith(async () => { throw new Error('Offline'); });
  assert.deepEqual(await (await s.get(request(2))).json(), [{ id: 1 }]);
});

test('query order does not cause duplicate downloads', async () => {
  const s = setup();
  await s.get(request());
  await s.get(new Request(`${origin}/wp-json/wp/v2/budynek?content_version=1&per_page=70&language=pl`));
  assert.equal(s.calls(), 1);
});

test('older tab cannot prune a newer cached version', async () => {
  const s = setup();
  s.fetchWith(async () => data(3));
  await s.get(request(3));
  await s.get(request(1));
  const keys = await (await s.caches.open(buildingsName)).keys();
  assert.equal(keys.length, 1);
  assert.ok(keys[0].url.includes('content_version=3'));
});

test('other REST requests retain network-first behavior', async () => {
  const s = setup();
  const req = new Request(`${origin}/wp-json/wp/v2/pages`);
  await s.get(req);
  await s.get(req);
  assert.equal(s.calls(), 2);
});

test('private, unversioned and non-building queries cannot use the new cache strategy', () => {
  const s = setup();
  for (const req of [
    request(0), request(1, 'de'), request(1, 'pl', '&context=edit'),
    request(1, 'pl', '&status=draft'), request(1, 'pl', '&_wpnonce=abc'),
    new Request(request(), { headers: { 'X-WP-Nonce': 'abc' } }),
    new Request(`${origin}/wp-json/wp/v2/budynek/123?content_version=1&language=pl`),
  ]) assert.equal(s.context.getBuildingsCacheKey(req), null);
});

const mapFields = 'id,link,title.rendered,marker_icon_width,acf.latitude,acf.longitude,acf.marker_icon,acf.subtitle,acf.short_description';
const mapRequest = (version = 2, language = 'pl', extra = '') => request(version, language,
  '&acf_format=standard&_fields=' + mapFields + extra);
const oldMapRequest = (version = 1, language = 'pl', extra = '') => request(version, language,
  '&acf_format=standard&_embed=1' + extra);
const richBuilding = {
  id: 1, title: { rendered: 'Building' }, link: origin + '/budynki/building/', marker_icon_width: 90,
  content: { rendered: 'Full page content' }, _embedded: { media: [] },
  acf: {
    latitude: 52.05, longitude: 20.43, marker_icon: origin + '/marker.webp',
    subtitle: 'Subtitle', short_description: '<p>Short description</p>',
    history: 'Full history', gallery: ['photo.jpg'], comparison_photo: 123,
  },
};

test('offline update can extract map-only fields from the old full response', async () => {
  const s = setup();
  s.fetchWith(async () => new Response(JSON.stringify([richBuilding]), {
    headers: { ...publicHeaders, 'Content-Type': 'application/json', 'X-WP-Total': '1', 'Content-Length': '9999' },
  }));
  await s.get(oldMapRequest());
  s.fetchWith(async () => { throw new Error('Offline'); });
  const response = await s.get(mapRequest());
  const [building] = await response.json();
  assert.equal(building.id, richBuilding.id);
  assert.equal(building.link, richBuilding.link);
  assert.equal(building.acf.marker_icon, richBuilding.acf.marker_icon);
  assert.equal(building.acf.short_description, richBuilding.acf.short_description);
  assert.deepEqual(Object.keys(building.acf).sort(), ['latitude', 'longitude', 'marker_icon', 'short_description', 'subtitle']);
  assert.equal(building.content, undefined);
  assert.equal(building._embedded, undefined);
  assert.equal(response.headers.get('X-WP-Total'), '1');
  assert.equal(response.headers.get('Content-Length'), null);
  // Old data must not be relabelled as a successfully downloaded new version.
  assert.equal((await (await s.caches.open(buildingsName)).keys()).length, 1);
  s.fetchWith(async () => data(2));
  await s.get(mapRequest());
  await s.get(mapRequest());
  assert.equal(s.calls(), 3);
});

test('map-only offline compatibility preserves language and pagination boundaries', async () => {
  const s = setup();
  await s.get(oldMapRequest());
  s.fetchWith(async () => { throw new Error('Offline'); });
  assert.equal((await s.get(mapRequest(2, 'en'))).type, 'error');
  assert.equal((await s.get(mapRequest(2, 'pl', '&page=2'))).type, 'error');
});

test('old full response in the runtime cache also supports offline map-only requests', async () => {
  const s = setup();
  const runtime = await s.caches.open(runtimeName);
  await runtime.put(oldMapRequest(), new Response(JSON.stringify([richBuilding]), { headers: publicHeaders }));
  s.fetchWith(async () => { throw new Error('Offline'); });
  const [building] = await (await s.get(mapRequest())).json();
  assert.equal(building.acf.latitude, richBuilding.acf.latitude);
  assert.equal(building.acf.history, undefined);
});

test('map-only cache cannot satisfy a full building data request', async () => {
  const s = setup();
  await s.get(mapRequest());
  s.fetchWith(async () => { throw new Error('Offline'); });
  assert.equal((await s.get(oldMapRequest())).type, 'error');
});

const pageRequest = () => {
  const req = new Request(`${origin}/`);
  Object.defineProperty(req, 'mode', { value: 'navigate' });
  return req;
};

for (const [kind, makeRequest] of [
  ['page', pageRequest],
  ['REST', () => new Request(`${origin}/wp-json/wp/v2/budynek`)],
  ['asset', () => new Request(`${origin}/theme/main.js`)],
]) {
  test(`${kind}: storage unavailable does not block successful network response`, async () => {
    const s = setup();
    s.failStorage();
    assert.deepEqual(await (await s.get(makeRequest())).json(), [{ id: 1 }]);
    assert.equal(s.calls(), 1);
  });

  test(`${kind}: quota error does not hide fresh network response`, async () => {
    const s = setup();
    const cache = await s.caches.open(runtimeName);
    cache.failPut = true;
    assert.deepEqual(await (await s.get(makeRequest())).json(), [{ id: 1 }]);
    assert.equal((await cache.keys()).length, 0);
  });

  test(`${kind}: cache read failure still permits network access`, async () => {
    const s = setup();
    (await s.caches.open(runtimeName)).failMatch = true;
    assert.deepEqual(await (await s.get(makeRequest())).json(), [{ id: 1 }]);
  });
}

test('REST quota failure returns fresh data while preserving the last offline copy', async () => {
  const s = setup();
  const req = new Request(`${origin}/wp-json/wp/v2/budynek`);
  await s.get(req);
  (await s.caches.open(runtimeName)).failPut = true;
  s.fetchWith(async () => data(2));
  assert.deepEqual(await (await s.get(req)).json(), [{ id: 2 }]);
  s.fetchWith(async () => { throw new Error('Offline'); });
  assert.deepEqual(await (await s.get(req)).json(), [{ id: 1 }]);
});

test('offline page uses saved page, then offline document, then a controlled error', async () => {
  const s = setup();
  await s.install();
  await s.get(pageRequest());
  s.fetchWith(async () => { throw new Error('Offline'); });
  assert.deepEqual(await (await s.get(pageRequest())).json(), [{ id: 1 }]);
  await (await s.caches.open(runtimeName)).delete(pageRequest());
  assert.equal(await (await s.get(pageRequest())).text(), 'offline');
  s.failStorage();
  assert.equal((await s.get(pageRequest())).type, 'error');
});

test('private requests bypass every cache strategy, including previously saved responses', async () => {
  const s = setup();
  const variants = [
    '?context=edit', '?context=view&context=edit', '?status=draft', '?status[]=private',
    '?_wpnonce=abc', '?preview=true', '?preview_nonce=abc', '?password=secret',
  ];
  const requests = variants.flatMap(query => [
    new Request(`${origin}/wp-json/wp/v2/pages${query}`),
    new Request(request().url + query.replace('?', '&')),
  ]);
  for (const header of ['X-WP-Nonce', 'Authorization']) {
    for (const url of [`${origin}/`, request().url, `${origin}/theme/main.js`]) {
      requests.push(new Request(url, { headers: { [header]: 'test' } }));
    }
  }
  requests.push(new Request(`${origin}/wp-admin`), new Request(`${origin}/wp-admin/`));
  const runtime = await s.caches.open(runtimeName);
  for (const req of requests) {
    await runtime.put(req, data('must not be served'));
    assert.equal(await s.get(req), undefined, req.url);
  }
  assert.equal(s.calls(), 0); // No respondWith: the browser handles the original request.
});

test('private, holding, no-store and unmarked responses are never saved', async () => {
  for (const headers of [
    {}, { 'X-Osada-PWA-Cache': 'private' },
    { ...publicHeaders, 'Cache-Control': 'no-cache, private' },
    { ...publicHeaders, 'Cache-Control': 'no-store' },
    { ...publicHeaders, 'X-Osada-Holding': '1' },
  ]) {
    const s = setup();
    s.fetchWith(async () => new Response('[{"id":2}]', { headers }));
    for (const req of [pageRequest(), new Request(`${origin}/wp-json/wp/v2/pages`), request()]) {
      assert.deepEqual(await (await s.get(req)).json(), [{ id: 2 }]);
    }
    assert.equal((await (await s.caches.open(runtimeName)).keys()).length, 0);
    assert.equal((await (await s.caches.open(buildingsName)).keys()).length, 0);
  }
});

test('access denial and private building responses do not fall back to public cached data', async () => {
  for (const response of [new Response('Denied', { status: 401 }), new Response('Forbidden', { status: 403 }),
    new Response('Private', { headers: { 'X-Osada-PWA-Cache': 'private' } })]) {
    const s = setup();
    await s.get(request(1));
    s.fetchWith(async () => response.clone());
    const result = await s.get(request(2));
    assert.equal(result.status, response.status);
    assert.equal(await result.text(), await response.text());
  }
});

test('activation removes all old application caches and leaves other applications alone', async () => {
  const s = setup();
  for (const suffix of ['runtime', 'buildings', 'static']) {
    await (await s.caches.open(`osada-fabryczna-v4-${suffix}`)).put(`${origin}/`, new Response('old private page'));
  }
  await s.caches.open('other-app');
  await s.activate();
  assert.ok(s.claimed());
  assert.ok((await s.caches.keys()).includes('other-app'));
  assert.ok(!(await s.caches.keys()).some(name => name.startsWith('osada-fabryczna-v4-')));
});

test('cleanup failure cannot expose old cached pages or assets', async () => {
  const s = setup();
  const old = await s.caches.open('osada-fabryczna-v4-runtime');
  await old.put(`${origin}/theme/main.js`, new Response('old private asset'));
  await old.put(`${origin}/`, new Response('old private page'));
  s.failCleanup();
  await s.activate();
  assert.ok(s.claimed());
  assert.deepEqual(await (await s.get(new Request(`${origin}/theme/main.js`))).json(), [{ id: 1 }]);
  s.fetchWith(async () => { throw new Error('Offline'); });
  assert.equal((await s.get(pageRequest())).type, 'error');
});

test('installation and activation survive unavailable storage', async () => {
  const s = setup();
  s.failStorage();
  await s.install();
  await s.activate();
  assert.ok(s.skipped());
  assert.ok(s.claimed());
});

test('private assets and redirects are not retained', async () => {
  for (const privateResponse of [
    new Response('private', { headers: { 'X-Osada-PWA-Cache': 'private' } }),
    new Response('private', { headers: { 'Cache-Control': 'private' } }),
    new Response('private', { headers: { 'Cache-Control': 'no-store' } }),
  ]) {
    const s = setup();
    s.fetchWith(async () => privateResponse.clone());
    await s.get(new Request(`${origin}/theme/main.js`));
    assert.equal((await (await s.caches.open(runtimeName)).keys()).length, 0);
  }
  const s = setup();
  s.fetchWith(async () => {
    const response = new Response('login', { headers: publicHeaders });
    Object.defineProperty(response, 'redirected', { value: true });
    return response;
  });
  await s.get(pageRequest());
  assert.equal((await (await s.caches.open(runtimeName)).keys()).length, 0);
});
