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
const runtimeName = 'osada-fabryczna-v4-runtime';
const buildingsName = 'osada-fabryczna-v4-buildings';
const data = value => new Response(JSON.stringify([{ id: value }]), {
  headers: { 'Content-Type': 'application/json' },
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
  const caches = {
    async open(name) {
      if (failOpen) throw new Error('Storage unavailable');
      if (!stores.has(name)) {
        const entries = new Map();
        const key = input => typeof input === 'string' ? input : input.url;
        stores.set(name, {
          failPut: false,
          async match(input) { return entries.get(key(input))?.clone(); },
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
    async keys() { return [...stores.keys()]; },
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
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    fetch: async (...args) => { calls++; return fetcher(...args); },
  });
  vm.runInContext(source, context);
  return {
    context, caches,
    calls: () => calls,
    fetchWith: fn => { fetcher = fn; },
    failStorage: () => { failOpen = true; },
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
  for (const bad of [new Response('Error', { status: 503 }), new Response('<html>Login</html>'), new Response('{}')]) {
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
    headers: { 'Content-Type': 'application/json', 'X-WP-Total': '1', 'Content-Length': '9999' },
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
  await runtime.put(oldMapRequest(), new Response(JSON.stringify([richBuilding])));
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
