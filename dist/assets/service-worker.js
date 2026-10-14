// Do not reuse v4 responses: their public/private origin cannot be established.
const SERVICE_WORKER_VERSION = 'osada-fabryczna-v5';
const STATIC_CACHE = `${SERVICE_WORKER_VERSION}-static`;
const RUNTIME_CACHE = `${SERVICE_WORKER_VERSION}-runtime`;
const BUILDINGS_CACHE = `${SERVICE_WORKER_VERSION}-buildings`;
const OFFLINE_URL = OSADA_PWA_CONFIG.offlineUrl;
const THEME_URL = new URL(OSADA_PWA_CONFIG.themeUrl);

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.add(OFFLINE_URL);
    }).catch(function (error) {
      console.warn('Offline page unavailable:', error);
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
            return cacheName.startsWith('osada-fabryczna-') && ![STATIC_CACHE, RUNTIME_CACHE, BUILDINGS_CACHE].includes(cacheName);
          })
          .map(function (cacheName) {
            return caches.delete(cacheName);
          })
      );
    }).catch(function (error) {
      console.warn('Old cache cleanup unavailable:', error);
    }).then(migrateBuildingsCache).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  const url = new URL(request.url);

  if ('GET' !== request.method || url.origin !== self.location.origin
    || isExcludedPath(url) || isPrivateRequest(request)) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (url.pathname.includes('/wp-json/')) {
    event.respondWith(getBuildingsCacheKey(request)
      ? versionedBuildingsData(request)
      : networkFirstData(request));
    return;
  }

  if (url.pathname.startsWith(THEME_URL.pathname)) {
    event.respondWith(cacheFirstAsset(request));
  }
});

function isExcludedPath(url) {
  return /\/wp-admin(?:\/|$)/.test(url.pathname)
    || url.pathname.includes('/wp-login.php')
    || url.pathname.includes('/wp-cron.php')
    || url.searchParams.has('preview');
}

function isPrivateRequest(request) {
  const url = new URL(request.url);
  return request.headers.has('X-WP-Nonce') || request.headers.has('Authorization')
    || [...url.searchParams.keys()].some(key =>
      /^(?:_wpnonce|_ajax_nonce|nonce|preview|preview_id|preview_nonce|password)(?:\[|$)/i.test(key))
    || url.searchParams.getAll('context').some(value => !['view', 'embed'].includes(value))
    || url.searchParams.getAll('status').some(value => value !== 'publish')
    || [...url.searchParams.keys()].some(key => /^(?:context|status)\[/.test(key));
}

function isCacheableResponse(response, requirePublic = true) {
  return response && response.ok && !response.redirected
    && response.headers.get('X-Osada-Holding') !== '1'
    && response.headers.get('X-Osada-PWA-Cache') !== 'private'
    && !/(?:^|,)\s*(?:private|no-store)\b/i.test(response.headers.get('Cache-Control') || '')
    && (!requirePublic || response.headers.get('X-Osada-PWA-Cache') === 'public');
}

async function readCache(name, request) {
  try {
    return await (await caches.open(name)).match(request);
  } catch (error) {
    return undefined;
  }
}

async function writeCache(name, request, response) {
  try {
    await (await caches.open(name)).put(request, response.clone());
  } catch (error) {
    console.warn('Cache write unavailable:', error);
  }
}

async function networkFirstPage(request) {
  let response;
  try {
    response = await fetch(request);
  } catch (error) {
    return (await readCache(RUNTIME_CACHE, request))
      || (await readCache(STATIC_CACHE, OFFLINE_URL))
      || Response.error();
  }
  if (isCacheableResponse(response)) await writeCache(RUNTIME_CACHE, request, response);
  return response;
}

async function networkFirstData(request) {
  let response;
  try {
    // Always revalidate WordPress REST data. The cached response is used only
    // when the visitor is offline, so published and edited buildings appear
    // on the next map load without manually clearing the PWA cache.
    response = await fetch(request, { cache: 'no-store' });
  } catch (error) {
    return (await readCache(RUNTIME_CACHE, request)) || Response.error();
  }
  if (isCacheableResponse(response)) await writeCache(RUNTIME_CACHE, request, response);
  return response;
}

function getBuildingsCacheKey(request) {
  const url = new URL(request.url);
  const version = url.searchParams.get('content_version');
  if (request.method !== 'GET' || url.origin !== self.location.origin
    || !/\/wp-json\/wp\/v2\/budynek\/?$/.test(url.pathname)
    || !/^[1-9]\d*$/.test(version || '') || !Number.isSafeInteger(Number(version))
    || !['pl', 'en'].includes(url.searchParams.get('language'))
    || isPrivateRequest(request)
    || !['view', null].includes(url.searchParams.get('context'))
    || !['publish', null].includes(url.searchParams.get('status'))) {
    return null;
  }
  url.searchParams.sort();
  const key = url.href;
  url.searchParams.delete('content_version');
  // Language, page size, page and all other filters remain part of the identity.
  return { key, family: url.href, version: Number(version) };
}

async function isBuildingsResponse(response) {
  if (!isCacheableResponse(response)) return false;
  try {
    return Array.isArray(await response.clone().json());
  } catch (error) {
    return false;
  }
}

async function matchingBuildingKeys(cache, identity) {
  return (await cache.keys())
    .map(request => ({ request, identity: getBuildingsCacheKey(request) }))
    .filter(entry => entry.identity && entry.identity.family === identity.family)
    .sort((a, b) => b.identity.version - a.identity.version);
}

async function latestBuildingsResponse(cache, identity) {
  for (const entry of await matchingBuildingKeys(cache, identity)) {
    const response = await cache.match(entry.request);
    if (await isBuildingsResponse(response)) return response;
  }
  return null;
}

// On the first offline visit after this update, the old full response can still
// supply the new map-only fields. Never reverse this (map data is not full data).
async function legacyMapOnlyResponse(cache, identity) {
  const url = new URL(identity.key);
  const fields = [
    'id', 'link', 'title.rendered', 'marker_icon_width', 'acf.latitude',
    'acf.longitude', 'acf.marker_icon', 'acf.subtitle', 'acf.short_description'
  ];
  const requestedFields = (url.searchParams.get('_fields') || '').split(',').sort();
  if (requestedFields.join(',') !== fields.slice().sort().join(',')
    || url.searchParams.has('_embed') || url.searchParams.get('acf_format') !== 'standard') {
    return null;
  }
  url.searchParams.delete('_fields');
  url.searchParams.set('_embed', '1');
  const legacyIdentity = getBuildingsCacheKey(new Request(url.href));
  const response = legacyIdentity && await latestBuildingsResponse(cache, legacyIdentity);
  if (!response) return null;
  const buildings = await response.json();
  const projected = buildings.map(building => {
    const result = { acf: {} };
    fields.forEach(field => {
      const [key, nestedKey] = field.split('.');
      if (nestedKey) {
        result[key] = result[key] || {};
        if (building[key] && nestedKey in building[key]) result[key][nestedKey] = building[key][nestedKey];
      } else if (key in building) {
        result[key] = building[key];
      }
    });
    return result;
  });
  const headers = new Headers(response.headers);
  headers.delete('Content-Length');
  headers.delete('Content-Encoding');
  headers.set('Content-Type', 'application/json; charset=UTF-8');
  return new Response(JSON.stringify(projected), { headers });
}

async function storeBuildingsResponse(cache, identity, response) {
  // Save successfully before pruning; never discard the last working offline copy.
  await cache.put(identity.key, response.clone());
  const entries = await matchingBuildingKeys(cache, identity);
  const newestVersion = entries[0].identity.version;
  await Promise.all(entries
    .filter(entry => entry.identity.version < newestVersion)
    .map(entry => cache.delete(entry.request)));
}

async function migrateBuildingsCache() {
  try {
    const runtimeCache = await caches.open(RUNTIME_CACHE);
    const buildingsCache = await caches.open(BUILDINGS_CACHE);
    for (const request of await runtimeCache.keys()) {
      const identity = getBuildingsCacheKey(request);
      if (!identity) continue;
      const response = await runtimeCache.match(request);
      if (!await isBuildingsResponse(response)) continue;
      await storeBuildingsResponse(buildingsCache, identity, response);
      await runtimeCache.delete(request);
    }
  } catch (error) {
    // Storage/quota failure must not block activation or remove the runtime copy.
    console.warn('Building cache migration unavailable:', error);
  }
}

async function versionedBuildingsData(request) {
  const identity = getBuildingsCacheKey(request);
  let buildingsCache;
  try {
    buildingsCache = await caches.open(BUILDINGS_CACHE);
    const cached = await buildingsCache.match(identity.key);
    if (cached) return cached;
  } catch (error) {
    console.warn('Building cache unavailable:', error);
  }

  let networkResponse;
  try {
    networkResponse = await fetch(request, { cache: 'no-store' });
    // An access denial or private response must never turn into public offline data.
    if ([401, 403].includes(networkResponse.status)
      || (networkResponse.ok && !isCacheableResponse(networkResponse))) return networkResponse;
    if (await isBuildingsResponse(networkResponse)) {
      if (buildingsCache) {
        try {
          await storeBuildingsResponse(buildingsCache, identity, networkResponse);
        } catch (error) {
          console.warn('Building cache write unavailable:', error);
        }
      }
      return networkResponse;
    }
  } catch (error) {
    // Network unavailable: use the latest matching language/filter combination.
  }

  try {
    const fallback = buildingsCache && await latestBuildingsResponse(buildingsCache, identity);
    if (fallback) return fallback;
    const oldMapFallback = buildingsCache && await legacyMapOnlyResponse(buildingsCache, identity);
    if (oldMapFallback) return oldMapFallback;
    // Also supports an older tab writing to the pre-migration runtime cache.
    const runtimeCache = await caches.open(RUNTIME_CACHE);
    const legacyFallback = await latestBuildingsResponse(runtimeCache, identity);
    if (legacyFallback) return legacyFallback;
    const oldRuntimeMapFallback = await legacyMapOnlyResponse(runtimeCache, identity);
    if (oldRuntimeMapFallback) return oldRuntimeMapFallback;
  } catch (error) {
    console.warn('Offline building data unavailable:', error);
  }
  // Never save old data under the requested new version: retry on the next load.
  return networkResponse || Response.error();
}

async function cacheFirstAsset(request) {
  // Only inspect this version's cache, even if cleanup of an old cache failed.
  const cachedResponse = await readCache(RUNTIME_CACHE, request);

  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);

  if (isCacheableResponse(response, false)) await writeCache(RUNTIME_CACHE, request, response);

  return response;
}
