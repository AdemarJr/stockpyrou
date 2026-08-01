// Service Worker StockPyrou PWA
// - HTML network-first (não prende versão antiga)
// - Atualização só com SKIP_WAITING (usuário clica "Atualizar")
// - Offline: shell + assets já visitados + alguns GET de leitura
const VERSION = '2.4.0';
const CACHE_NAME = `stockpyrou-v${VERSION}`;
const DATA_CACHE_NAME = `stockpyrou-data-v${VERSION}`;

function isAppCache(name) {
  return name.startsWith('pyroustock-') || name.startsWith('stockpyrou-');
}

const API_URLS = ['/api/cashier/', '/api/products/', '/api/stock/'];

console.log(`[SW] Service Worker versão ${VERSION} carregando...`);

self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${VERSION} (aguarda SKIP_WAITING)...`);
  // NÃO chama skipWaiting aqui — o app só troca de versão quando o usuário confirma.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/', '/manifest.json', '/favicon.svg']).catch(() => undefined),
    ),
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
      .then(() => self.clients.claim()),
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

  // Auth nunca pelo SW
  if (url.pathname.includes('/auth/')) {
    return;
  }

  // Não intercepta API cross-origin (Railway) — evita CORS/offline estranho no login
  if (url.origin !== self.location.origin) {
    return;
  }

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
              caches.match('/').then(
                (home) =>
                  home ||
                  new Response(
                    '<!doctype html><html><body style="font-family:sans-serif;padding:2rem"><h1>Offline</h1><p>Sem conexão. Reconecte e atualize a página.</p></body></html>',
                    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
                  ),
              ),
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

  // Assets: stale-while-revalidate
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

      if (cachedResponse) {
        void networkFetch;
        return cachedResponse;
      }
      return networkFetch;
    }),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (data.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: VERSION });
  }

  if (data.type === 'CLEAR_CACHE') {
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
          event.ports[0]?.postMessage({ cleared: true, version: VERSION });
        }),
    );
  }
});

console.log(`[SW] Service Worker versão ${VERSION} pronto!`);
