// Scenario for: node tests/browser-accessibility-check.cjs --pwa
// Actual service worker and CacheStorage, isolated localhost responses, no WordPress changes.
const fs = require('node:fs');
const path = require('node:path');
const hits = new Map();
let denyBuildings = false;
let disconnected = false;

exports.handleRequest = (req, res, theme) => {
  // CDP's page-level offline switch may not affect a separate service-worker target.
  // Dropping the local server connection also exercises the worker's real fetch failure.
  if (disconnected) { req.socket.destroy(); return true; }
  const url = new URL(req.url, 'http://localhost');
  const known = ['/pwa-host', '/sw.js', '/pwa-register.js', '/offline.html', '/public-page', '/private-page', '/theme/test.js', '/wp-json/wp/v2/budynek'];
  if (!known.includes(url.pathname)) return false;
  hits.set(req.url, (hits.get(req.url) || 0) + 1);
  res.setHeader('Cache-Control', 'no-cache');
  if (url.pathname === '/sw.js') {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(`const OSADA_PWA_CONFIG = {offlineUrl: self.location.origin + '/offline.html', themeUrl: self.location.origin + '/theme/'};\n`
      + fs.readFileSync(path.join(theme, 'dist/assets/service-worker.js'), 'utf8'));
  } else if (url.pathname === '/pwa-register.js') {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(fs.readFileSync(path.join(theme, 'dist/assets/pwa-register.js'), 'utf8'));
  } else if (url.pathname === '/wp-json/wp/v2/budynek') {
    const authenticated = Boolean(req.headers['x-wp-nonce']);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Osada-PWA-Cache', authenticated || denyBuildings ? 'private' : 'public');
    res.setHeader('X-WP-TotalPages', '1');
    if (denyBuildings) { res.writeHead(401); res.end('{"code":"access_required"}'); }
    else res.end(JSON.stringify([{ id: authenticated ? 999 : Number(url.searchParams.get('content_version') || 1) }]));
  } else if (url.pathname === '/theme/test.js') {
    res.setHeader('Content-Type', 'application/javascript');
    res.end('/* asset ' + url.searchParams.get('ver') + ' */');
  } else {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('X-Osada-PWA-Cache', url.pathname === '/private-page' ? 'private' : 'public');
    const register = url.pathname === '/pwa-host'
      ? `<script>window.OsadaFabrycznaPwa={serviceWorkerUrl:'/sw.js',scope:'/'};</script><script src="/pwa-register.js"></script>` : '';
    res.end(`<!doctype html><html><head><title>PWA test</title></head><body><p id="page-kind">${url.pathname}</p>${register}</body></html>`);
  }
  return true;
};

exports.run = async ({ send, evaluate, checks, baseUrl }) => {
  const navigate = async pathname => {
    await send('Page.navigate', { url: baseUrl + pathname });
    await evaluate(`new Promise(resolve => {
      if (document.readyState === 'complete') resolve(); else window.addEventListener('load', resolve, {once:true});
    })`);
  };
  const building = (version, language = 'pl') => `/wp-json/wp/v2/budynek?language=${language}&per_page=70&content_version=${version}`;
  const get = async (url, nonce) => evaluate(`fetch(${JSON.stringify(url)}, ${JSON.stringify(nonce ? { headers: { 'X-WP-Nonce': nonce }, cache: 'no-store' } : {})}).then(async r => ({status:r.status, text:await r.text()}))`);
  await navigate('/public-page');
  await evaluate(`(async () => {
    for (const suffix of ['runtime','buildings','static']) {
      const cache = await caches.open('osada-fabryczna-v4-' + suffix);
      await cache.put('/old-private', new Response('old private response'));
    }
  })()`);
  await navigate('/pwa-host');
  checks(await evaluate(`(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, {once:true}));
    return navigator.serviceWorker.controller.scriptURL.endsWith('/sw.js');
  })()`), 'actual registration script activates and controls the page');
  checks(await evaluate(`caches.keys().then(keys => !keys.some(key => key.startsWith('osada-fabryczna-v4-')))`), 'old caches removed on activation');
  checks(JSON.parse((await get(building(1))).text)[0].id === 1, 'initial public response');
  await get(building(1));
  checks(hits.get(building(1)) === 1, 'same version served from real cache');
  checks(JSON.parse((await get(building(2))).text)[0].id === 2, 'new content version downloaded');
  await get(building(2, 'en'));
  checks(await evaluate(`caches.open('osada-fabryczna-v5-buildings').then(c => c.keys()).then(keys => keys.length === 2 && keys.every(k => k.url.includes('content_version=2')))`), 'old version pruned and languages kept separate');
  checks(JSON.parse((await get(building(2), 'test-nonce')).text)[0].id === 999, 'authenticated request bypasses cached public response');
  checks(JSON.parse((await get(building(2))).text)[0].id === 2, 'private response did not overwrite public cache');
  await get('/theme/test.js?ver=1'); await get('/theme/test.js?ver=1'); await get('/theme/test.js?ver=2');
  checks(hits.get('/theme/test.js?ver=1') === 1 && hits.get('/theme/test.js?ver=2') === 1, 'asset versions cached separately');
  await navigate('/public-page');
  checks(await evaluate(`caches.open('osada-fabryczna-v5-runtime').then(c => c.match('/public-page')).then(Boolean)`), 'public navigation saved');
  await navigate('/private-page');
  checks(await evaluate(`caches.open('osada-fabryczna-v5-runtime').then(c => c.match('/private-page')).then(r => !r)`), 'private navigation not saved');
  denyBuildings = true;
  checks((await get(building(3))).status === 401, 'access denial is not replaced with older data');
  denyBuildings = false;
  disconnected = true;
  await send('Network.enable');
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  checks(JSON.parse((await get(building(3))).text)[0].id === 2, 'offline fallback uses previous matching version');
  checks(await evaluate(`fetch(${JSON.stringify(building(2))},{headers:{'X-WP-Nonce':'test-nonce'},cache:'no-store'}).then(()=>false,()=>true)`), 'private offline request cannot use public cache');
  await navigate('/public-page');
  checks(await evaluate(`document.getElementById('page-kind')?.textContent === '/public-page'`), 'previously visited page opens offline');
  await navigate('/never-visited');
  checks(await evaluate(`document.getElementById('page-kind')?.textContent === '/offline.html'`), 'unknown page uses offline document');
  disconnected = false;
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  checks(JSON.parse((await get(building(3))).text)[0].id === 3, 'online recovery retries new version');
};
