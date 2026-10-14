const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../dist/assets/main.js'), 'utf8');
const helpers = source.slice(source.indexOf('async function fetchMapBuildings('), source.indexOf("document.addEventListener('DOMContentLoaded'"));
const origin = 'https://osada.example';
function setup(overrides = {}) {
  return vm.createContext({ URL, console: { warn() {} },
    MAP_CONFIG: {},
    window: { location: { href: origin + '/' } },
    DEFAULT_BUILDING_MARKER_URL: origin + '/default.png', ...overrides });
}
function run(overrides) {
  const context = setup(overrides);
  vm.runInContext(helpers, context);
  return context;
}

test('all 151 buildings are fetched across three pages with filters preserved', async () => {
  const urls = [];
  const s = run({ fetch: async url => {
    urls.push(new URL(url));
    const page = Number(new URL(url).searchParams.get('page') || 1);
    const size = page === 3 ? 11 : 70;
    return new Response(JSON.stringify(Array.from({ length: size }, (_, index) => ({ id: (page - 1) * 70 + index + 1 }))),
      { headers: { 'X-WP-TotalPages': '3' } });
  } });
  const result = await s.fetchMapBuildings('/wp-json/wp/v2/budynek?language=en&per_page=70&content_version=42&_fields=id,acf');
  assert.equal(result.length, 151);
  assert.equal(result.at(-1).id, 151);
  assert.deepEqual(urls.map(url => url.searchParams.get('page')), [null, '2', '3']);
  for (const url of urls) {
    assert.equal(url.searchParams.get('language'), 'en');
    assert.equal(url.searchParams.get('content_version'), '42');
    assert.equal(url.searchParams.get('_fields'), 'id,acf');
  }
});

test('a failed later page rejects the incomplete collection', async () => {
  let calls = 0;
  const s = run({ fetch: async () => ++calls === 1
    ? new Response('[{"id":1}]', { headers: { 'X-WP-TotalPages': '2' } })
    : new Response('offline', { status: 503 }) });
  await assert.rejects(s.fetchMapBuildings('/wp-json/wp/v2/budynek'), /503/);
});

test('logged-in map sends the WordPress REST nonce on every page', async () => {
  const requests = [];
  const s = run({ MAP_CONFIG: { restNonce: 'test-rest-nonce' }, fetch: async (url, options) => {
    requests.push({ url, options });
    // Same contract as WordPress cookie authentication followed by the access gate.
    if (options.headers?.['X-WP-Nonce'] !== 'test-rest-nonce') return new Response('Unauthorized', { status: 401 });
    return new Response(JSON.stringify([{ id: requests.length }]), { headers: { 'X-WP-TotalPages': '2' } });
  } });
  assert.equal((await s.fetchMapBuildings('/wp-json/wp/v2/budynek?language=pl')).length, 2);
  assert.equal(requests.length, 2);
  for (const { url, options } of requests) {
    assert.equal(options.headers['X-WP-Nonce'], 'test-rest-nonce');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.cache, 'no-store');
    assert.equal(new URL(url).searchParams.has('_wpnonce'), false);
  }
});

test('anonymous visitors and password testers retain cookie access without a REST nonce', async () => {
  const s = run({ fetch: async (url, options) => {
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.headers, undefined);
    assert.equal(options.cache, undefined);
    return new Response('[{"id":1}]');
  } });
  assert.equal((await s.fetchMapBuildings('/wp-json/wp/v2/budynek')).length, 1);
});

test('invalid collections fail clearly and repeated IDs are deduplicated', async () => {
  const s = run({ fetch: async () => new Response('[null,{}, {"id":1}, {"id":1}, {"id":2}]') });
  assert.equal((await s.fetchMapBuildings('/wp-json/wp/v2/budynek')).length, 2);
  s.fetch = async () => new Response('{}');
  await assert.rejects(s.fetchMapBuildings('/wp-json/wp/v2/budynek'), /Invalid building collection/);
});

test('missing pagination metadata cannot silently truncate a full result page', async () => {
  const s = run({ fetch: async () => new Response('[{"id":1},{"id":2}]') });
  await assert.rejects(s.fetchMapBuildings('/wp-json/wp/v2/budynek?per_page=2'), /pagination/);
});

test('coordinate validation skips malformed records but accepts zero and numeric strings', () => {
  const s = run();
  for (const building of [null, {}, { acf: null }, ...[
    ['', 20], ['text', 20], [null, 20], [true, 20], [91, 20], [52, 181], [52, Infinity]
  ].map(([latitude, longitude]) => ({ acf: { latitude, longitude } }))]) {
    assert.equal(s.getBuildingCoordinates(building), null);
  }
  assert.equal(JSON.stringify(s.getBuildingCoordinates({ acf: { latitude: '52.05', longitude: '20.43' } })), '[52.05,20.43]');
  assert.equal(JSON.stringify(s.getBuildingCoordinates({ acf: { latitude: 0, longitude: 0 } })), '[0,0]');
});

test('failed custom icon loads the default icon with its own dimensions', async () => {
  const attempts = [];
  const s = run({ Image: class {
    set src(url) {
      attempts.push(url);
      if (url.endsWith('broken.png')) this.onerror();
      else { this.naturalWidth = 60; this.naturalHeight = 80; this.onload(); }
    }
  } });
  const icon = await s.loadMapMarkerImage(origin + '/broken.png');
  assert.equal(icon.url, origin + '/default.png');
  assert.equal(icon.width, 60);
  assert.equal(icon.height, 80);
  assert.equal(attempts.length, 2);
});

test('failure of both images yields a self-contained marker without a retry loop', async () => {
  let attempts = 0;
  const s = run({ Image: class { set src(url) { attempts++; this.onerror(); } } });
  const icon = await s.loadMapMarkerImage(origin + '/broken.png');
  assert.match(icon.url, /^data:image\/svg\+xml,/);
  assert.ok(icon.width > 0 && icon.height > 0);
  assert.equal(attempts, 2);
});
