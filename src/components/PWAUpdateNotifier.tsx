import React, { useEffect, useState } from 'react';
import { RefreshCw, Download, X } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

export function PWAUpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    // Verifica se o navegador suporta Service Worker
    if ('serviceWorker' in navigator) {
      // Tenta registrar o Service Worker inline
      registerInlineServiceWorker();
    } else {
      console.log('ℹ️ Service Worker not supported in this browser');
    }
  }, []);

  const registerInlineServiceWorker = async () => {
    try {
      // Service Worker inline como Blob (evita problemas de MIME type)
      const swCode = `
// Service Worker para PyrouStock PWA - Versão Inline
const VERSION = '2.1.0';
const CACHE_NAME = \`pyroustock-v\${VERSION}\`;
const DATA_CACHE_NAME = \`pyroustock-data-v\${VERSION}\`;

const STATIC_CACHE = [
  '/',
  '/styles/globals.css',
];

const API_URLS = [
  '/functions/v1/make-server-8a20b27d/cashier/',
  '/functions/v1/make-server-8a20b27d/products/',
  '/functions/v1/make-server-8a20b27d/stock/',
];

console.log(\`[SW] Service Worker versão \${VERSION} carregando...\`);

// INSTALL
self.addEventListener('install', (event) => {
  console.log(\`[SW] Installing version \${VERSION}...\`);
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static resources');
        return cache.addAll(STATIC_CACHE).catch(() => {
          console.log('[SW] Some resources failed to cache, continuing...');
        });
      })
      .then(() => {
        console.log('[SW] Skip waiting to activate immediately');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Install failed:', error);
      })
  );
});

// ACTIVATE
self.addEventListener('activate', (event) => {
  console.log(\`[SW] Activating version \${VERSION}...\`);
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
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
        return self.clients.claim();
      })
      .then(() => {
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

// FETCH
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (url.origin !== self.location.origin && 
      !url.hostname.includes('supabase.co')) {
    return;
  }

  const isApiRequest = (url) => {
    return API_URLS.some(apiUrl => url.pathname.includes(apiUrl));
  };

  // API - Network First
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
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
          return caches.match(request)
            .then((cachedResponse) => {
              if (cachedResponse) {
                console.log('[SW] Serving API from cache:', url.pathname);
                return cachedResponse;
              }
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

  // Assets - Cache First
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          fetch(request)
            .then((response) => {
              if (response && response.status === 200) {
                caches.open(CACHE_NAME)
                  .then((cache) => {
                    cache.put(request, response);
                  });
              }
            })
            .catch(() => {});
          
          return cachedResponse;
        }

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
            return new Response('Offline', {
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

// MESSAGES
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

console.log(\`[SW] Service Worker versão \${VERSION} pronto!\`);
      `;

      // Cria um Blob com o código do Service Worker
      const blob = new Blob([swCode], { type: 'application/javascript' });
      const swUrl = URL.createObjectURL(blob);

      // Registra o Service Worker
      const reg = await navigator.serviceWorker.register(swUrl, {
        scope: '/',
        updateViaCache: 'none'
      });

      console.log('✅ Inline Service Worker registered successfully');
      setRegistration(reg);

      // Libera o objeto URL após o registro
      URL.revokeObjectURL(swUrl);

      // Verifica atualizações a cada 60 segundos
      setInterval(() => {
        console.log('🔄 Checking for updates...');
        reg.update();
      }, 60000);

      // Listener para atualizações encontradas
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        console.log('🆕 New Service Worker found');

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('✨ New version available!');
              setUpdateAvailable(true);
              setShowBanner(true);
              
              toast.info('Nova versão disponível!', {
                description: 'Clique para atualizar o aplicativo',
                duration: Infinity,
                action: {
                  label: 'Atualizar',
                  onClick: () => handleUpdate()
                }
              });
            }
          });
        }
      });

      // Listener para mensagens do Service Worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        console.log('📨 Message from SW:', event.data);
        
        if (event.data.type === 'SW_UPDATED') {
          console.log('🎉 Service Worker updated to version:', event.data.version);
          setUpdateAvailable(true);
          setShowBanner(true);
        }
      });

      // Não recarregar em todo controllerchange: isso apagava formulários ao ativar SW em segundo plano.
      // O reload só ocorre quando o usuário clica em "Atualizar" (handleUpdate registra listener { once: true }).

    } catch (error) {
      console.log('ℹ️ Service Worker registration skipped:', error);
      // Não mostra erro ao usuário, apenas registra no console
    }
  };

  const handleUpdate = () => {
    if (registration && registration.waiting) {
      console.log('📤 Sending SKIP_WAITING message to SW');
      const reloadOnce = () => {
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', reloadOnce, { once: true });
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setShowBanner(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    toast.info('Atualização adiada', {
      description: 'A página será atualizada no próximo carregamento'
    });
  };

  // Banner de atualização
  if (!showBanner || !updateAvailable) {
    return null;
  }

  return (
    <>
      {/* Banner Mobile (Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-2xl z-50 animate-slide-up">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-5 h-5 animate-spin" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">Nova versão disponível!</p>
              <p className="text-xs opacity-90">Toque para atualizar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpdate}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Atualizar
            </button>
            <button
              onClick={handleDismiss}
              className="w-8 h-8 flex items-center justify-center text-white/80 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Banner Desktop (Top Right) */}
      <div className="hidden md:block fixed top-4 right-4 bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 z-50 max-w-md animate-slide-down">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-gray-900 mb-1">Nova Versão Disponível!</h3>
            <p className="text-sm text-gray-600 mb-4">
              Uma atualização do PyrouStock está pronta. Clique em atualizar para obter as novidades.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleUpdate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Atualizar Agora
              </button>
              <button
                onClick={handleDismiss}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors"
              >
                Mais Tarde
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        @keyframes slide-down {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }

        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </>
  );
}