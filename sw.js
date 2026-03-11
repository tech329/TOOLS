const VERSION = '2.1.0';
const STATIC_CACHE = `tupak-static-${VERSION}`;
const RUNTIME_CACHE = `tupak-runtime-${VERSION}`;
const OFFLINE_URL = './offline.html';
const CORE_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './manifest-pc.webmanifest',
  './manifest-mobile.webmanifest',
  './shared/pwa.js',
  './shared/config.js',
  './shared/auth.js',
  './shared/img/logo.webp',
  './shared/img/lpsolutionswithe.webp',
  './shared/img/lpsolutionsblack.webp',
  './pc/index.html',
  './pc/login.html',
  './pc/css/main.css',
  './pc/js/main.js',
  './pc/js/config.js',
  './mobile/index.html',
  './mobile/login.html',
  './mobile/css/mobile-styles.css',
  './mobile/js/mobile-main.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames
        .filter(name => name.startsWith('tupak-static-') || name.startsWith('tupak-runtime-'))
        .filter(name => name !== STATIC_CACHE && name !== RUNTIME_CACHE)
        .map(name => caches.delete(name))
    );
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => {
      client.postMessage({ type: 'SW_VERSION', version: VERSION });
    });
  })());
});

self.addEventListener('message', event => {
  if (!event.data || typeof event.data !== 'object') {
    return;
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (event.data.type === 'GET_VERSION' && event.source) {
    event.source.postMessage({ type: 'SW_VERSION', version: VERSION });
  }
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const requestUrl = new URL(request.url);
  if (!isSupportedRuntimeUrl(requestUrl)) {
    return;
  }

  if (requestUrl.origin !== self.location.origin && request.destination !== 'style' && request.destination !== 'script' && request.destination !== 'font' && request.destination !== 'image') {
    return;
  }

  event.respondWith(networkFirst(request));
});

function isSupportedRuntimeUrl(requestUrl) {
  return requestUrl.protocol === 'http:' || requestUrl.protocol === 'https:';
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && isSupportedRuntimeUrl(new URL(request.url)) && (networkResponse.ok || networkResponse.type === 'opaque')) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    const cachedResponse = await cache.match(request) || await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    if (request.mode === 'navigate') {
      const offlineResponse = await caches.match(OFFLINE_URL);
      if (offlineResponse) {
        return offlineResponse;
      }
    }

    throw error;
  }
}
