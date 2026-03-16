// Service Worker para PyrouStock PWA - Offline First com Auto-Update
const VERSION = '2.1.0'; // Incrementar a cada atualização
const CACHE_NAME = `pyroustock-v${VERSION}`;
const DATA_CACHE_NAME = `pyroustock-data-v${VERSION}`;

// Recursos estáticos para cache imediato
const STATIC_CACHE = [
  '/',
  '/styles/globals.css',
];

// URLs de API que devem ser cacheadas
const API_URLS = [
  '/functions/v1/make-server-8a20b27d/cashier/',
  '/functions/v1/make-server-8a20b27d/products/',
  '/functions/v1/make-server-8a20b27d/stock/',
];

console.log(`[SW] Service Worker versão ${VERSION} carregando...`);

// ========================================
// INSTALL - Cacheia recursos estáticos
// ========================================
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version ${VERSION}...`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static resources');
        return cache.addAll(STATIC_CACHE);
      })
      .then(() => {
        console.log('[SW] Skip waiting to activate immediately');
        return self.skipWaiting(); // Ativa imediatamente a nova versão
      })
      .catch((error) => {
        console.error('[SW] Install failed:', error);
      })
  );
});

// ========================================
// ACTIVATE - Remove caches antigos
// ========================================
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version ${VERSION}...`);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Remove todos os caches que não são a versão atual
            if (cacheName.startsWith('pyroustock-') && 
                cacheName !== CACHE_NAME && 
                cacheName !== DATA_CACHE_NAME) {
              console.log('[SW] Removing old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients for immediate control');
        return self.clients.claim(); // Assume controle de todas as abas
      })
      .then(() => {
        // Notifica todas as abas abertas sobre a nova versão
        return self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'SW_UPDATED',
              version: VERSION
            });
          });
        });
      })
  );
});

// ========================================
// FETCH - Estratégia de cache
// ========================================
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requisições que não são GET (POST, PUT, DELETE precisam passar sempre)
  if (request.method !== 'GET') {
    return;
  }

  // Ignora requisições para outros domínios (exceto Supabase)
  if (url.origin !== self.location.origin && 
      !url.hostname.includes('supabase.co')) {
    return;
  }

  // ========================================
  // Estratégia 1: API - Network First, Cache Fallback
  // ========================================
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Se a resposta for válida, clona e cacheia
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(DATA_CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });
          }
          return response;
        })
        .catch(() => {
          // Se falhar, tenta buscar do cache
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                console.log('[SW] Serving API from cache:', url.pathname);
                return cachedResponse;
              }
              // Retorna resposta offline
              return new Response(
                JSON.stringify({ 
                  error: 'Offline - Dados não disponíveis no cache',
                  offline: true 
                }), 
                {
                  status: 503,
                  headers: { 'Content-Type': 'application/json' }
                }
              );
            });
        })
    );
    return;
  }

  // ========================================
  // Estratégia 2: Assets estáticos - Cache First
  // ========================================
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Retorna do cache, mas atualiza em background
          fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, response);
                  });
              }
            })
            .catch(() => {
              // Silenciosamente falha se offline
            });
          
          return cachedResponse;
        }

        // Se não está no cache, busca da rede e cacheia
        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200) {
              return response;
            }

            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Offline e não está no cache
            return new Response('Offline - Recurso não disponível', {
              status: 503,
              statusText: 'Service Unavailable',
              headers: new Headers({
                'Content-Type': 'text/plain'
              })
            });
          });
      })
  );
});

// ========================================
// MENSAGENS - Comunicação com a aplicação
// ========================================
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skipping waiting on message');
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: VERSION });
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.startsWith('pyroustock-')) {
              return caches.delete(cacheName);
            }
          })
        );
      }).then(() => {
        event.ports[0].postMessage({ cleared: true });
      })
    );
  }
});

// ========================================
// SYNC - Background Sync (futuro)
// ========================================
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-sales') {
    event.waitUntil(syncPendingSales());
  }
});

// ========================================
// Funções auxiliares
// ========================================
function isApiRequest(url) {
  return API_URLS.some(apiUrl => url.pathname.includes(apiUrl));
}

function syncPendingSales() {
  // Implementação futura para sincronizar vendas offline
  return Promise.resolve();
}

// ========================================
// PUSH NOTIFICATIONS (futuro)
// ========================================
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  
  const title = data.title || 'PyrouStock';
  const options = {
    body: data.body || 'Nova notificação',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

console.log(`[SW] Service Worker versão ${VERSION} pronto!`);