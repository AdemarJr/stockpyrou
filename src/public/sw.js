// Service Worker StockPyrou PWA — network-first no HTML para não travar em versão antiga
const VERSION = '2.3.1'; // Incrementar a cada atualização
const CACHE_NAME = `stockpyrou-v${VERSION}`;
const DATA_CACHE_NAME = `stockpyrou-data-v${VERSION}`;

function isAppCache(name) {
  return name.startsWith('pyroustock-') || name.startsWith('stockpyrou-');
}

// Não pré-cachear '/' — senão o index.html fica preso e o app não atualiza.
const STATIC_CACHE = [];

// URLs de API que podem ter fallback de cache (somente GET de leitura)
const API_URLS = [
  '/api/cashier/',
  '/api/products/',
  '/api/stock/',
];

console.log(`[SW] Service Worker versão ${VERSION} carregando...`);

self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${VERSION}...`);
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        if (STATIC_CACHE.length === 0) return undefined;
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => self.skipWaiting())
      .catch((error) => {
        console.error('[SW] Install failed:', error);
      }),
  );
});

self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${VERSION}...`);
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (isAppCache(cacheName) && cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
              console.log('[SW] Removing old cache:', cacheName);
              return caches.delete(cacheName);
            }
            return undefined;
          }),
        ),
      )
      .then(() => self.clients.claim())
      .then(() =>
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_UPDATED', version: VERSION });
          });
        }),
      ),
  );
});

function isApiRequest(url) {
  return API_URLS.some((apiUrl) => url.pathname.includes(apiUrl));
}

function isNavigationRequest(request) {
  return (
    request.mode === 'navigate' ||
    (request.method === 'GET' &&
      request.headers.get('accept') &&
      request.headers.get('accept').includes('text/html'))
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  // Login e auth nunca devem passar pelo SW
  if (url.pathname.includes('/auth/')) {
    return;
  }

  if (url.origin !== self.location.origin && !url.hostname.includes('railway.app')) {
    return;
  }

  // HTML / navegação: SEMPRE rede primeiro (evita tela branca e login antigo)
  if (isNavigationRequest(request) || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) =>
              cached ||
              new Response('Offline', {
                status: 503,
                headers: { 'Content-Type': 'text/plain' },
              }),
          ),
        ),
    );
    return;
  }

  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(DATA_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return new Response(
              JSON.stringify({
                error: 'Offline - Dados não disponíveis no cache',
                offline: true,
              }),
              { status: 503, headers: { 'Content-Type': 'application/json' } },
            );
          }),
        ),
    );
    return;
  }

  // Assets com hash: cache first + atualização em background
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => cachedResponse || new Response('Offline', { status: 503 }));

      // JS/CSS: prefere rede se houver cache antigo sem hash conhecido — usa stale-while-revalidate
      if (cachedResponse) {
        void networkFetch;
        return cachedResponse;
      }
      return networkFetch;
    }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames.map((cacheName) => {
              if (isAppCache(cacheName)) return caches.delete(cacheName);
              return undefined;
            }),
          ),
        )
        .then(() => {
          event.ports[0].postMessage({ cleared: true });
        }),
    );
  }
});

console.log(`[SW] Service Worker versão ${VERSION} pronto!`);
