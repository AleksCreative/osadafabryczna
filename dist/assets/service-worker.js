const SERVICE_WORKER_VERSION = 'osada-fabryczna-v2';
const STATIC_CACHE = `${SERVICE_WORKER_VERSION}-static`;
const RUNTIME_CACHE = `${SERVICE_WORKER_VERSION}-runtime`;
const OFFLINE_URL = OSADA_PWA_CONFIG.offlineUrl;
const THEME_URL = new URL(OSADA_PWA_CONFIG.themeUrl);

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.add(OFFLINE_URL);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function (cacheName) {
            return cacheName.startsWith('osada-fabryczna-') && ![STATIC_CACHE, RUNTIME_CACHE].includes(cacheName);
          })
          .map(function (cacheName) {
            return caches.delete(cacheName);
          })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  const url = new URL(request.url);

  if ('GET' !== request.method || url.origin !== self.location.origin || isExcludedPath(url)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (url.pathname.startsWith(THEME_URL.pathname) || url.pathname.includes('/wp-json/')) {
    event.respondWith(cacheFirstAsset(request));
  }
});

function isExcludedPath(url) {
  return url.pathname.includes('/wp-admin/')
    || url.pathname.includes('/wp-login.php')
    || url.pathname.includes('/wp-cron.php')
    || url.searchParams.has('preview');
}

async function networkFirstPage(request) {
  const runtimeCache = await caches.open(RUNTIME_CACHE);

  try {
    const response = await fetch(request);

    if (response.ok && !request.headers.get('Cookie')?.includes('wordpress_logged_in')) {
      runtimeCache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    return (await runtimeCache.match(request))
      || (await caches.match(OFFLINE_URL))
      || Response.error();
  }
}

async function cacheFirstAsset(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (response.ok) {
    const runtimeCache = await caches.open(RUNTIME_CACHE);
    runtimeCache.put(request, response.clone());
  }

  return response;
}
