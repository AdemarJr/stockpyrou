import React, { useEffect, useState } from 'react';
import { RefreshCw, Download, X } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { APP_NAME } from '../config/branding';

/**
 * Registra /sw.js do servidor (não Blob).
 * Blob SW não atualiza com reg.update() e deixava o app preso em JS antigo.
 */
export function PWAUpdateNotifier() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      console.log('ℹ️ Service Worker not supported in this browser');
      return;
    }

    let intervalId = 0;
    let cancelled = false;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SW_UPDATED') {
        setUpdateAvailable(true);
        setShowBanner(true);
      }
    };

    const run = async () => {
      try {
        // Remove registros Blob antigos (object URL) que travavam a atualização
        const existing = await navigator.serviceWorker.getRegistrations();
        for (const reg of existing) {
          const scriptUrl =
            reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL || '';
          if (scriptUrl.startsWith('blob:')) {
            console.log('[SW] Unregistering legacy blob SW:', scriptUrl);
            await reg.unregister();
          }
        }

        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });
        if (cancelled) return;

        console.log('✅ Service Worker registered (/sw.js)');
        setRegistration(reg);
        void reg.update();

        intervalId = window.setInterval(() => {
          void reg.update();
        }, 60_000);

        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
              setShowBanner(true);
              toast.info('Nova versão disponível!', {
                description: 'Clique para atualizar o aplicativo',
                duration: Infinity,
                action: {
                  label: 'Atualizar',
                  onClick: () => {
                    if (reg.waiting) {
                      navigator.serviceWorker.addEventListener(
                        'controllerchange',
                        () => window.location.reload(),
                        { once: true },
                      );
                      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                    } else {
                      window.location.reload();
                    }
                  },
                },
              });
            }
          });
        });

        navigator.serviceWorker.addEventListener('message', onMessage);
      } catch (error) {
        console.log('ℹ️ Service Worker registration skipped:', error);
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, []);

  const handleUpdate = () => {
    if (registration?.waiting) {
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => window.location.reload(),
        { once: true },
      );
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      setShowBanner(false);
      return;
    }
    window.location.reload();
  };

  const handleDismiss = () => {
    setShowBanner(false);
    toast.info('Atualização adiada', {
      description: 'A página será atualizada no próximo carregamento',
    });
  };

  if (!showBanner || !updateAvailable) {
    return null;
  }

  return (
    <>
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

      <div className="hidden md:block fixed top-4 right-4 bg-white rounded-2xl shadow-2xl border border-gray-200 p-5 z-50 max-w-md animate-slide-down">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-gray-900 mb-1">Nova Versão Disponível!</h3>
            <p className="text-sm text-gray-600 mb-4">
              Uma atualização do {APP_NAME} está pronta. Clique em atualizar para obter as novidades.
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
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up { animation: slide-up 0.3s ease-out; }
        .animate-slide-down { animation: slide-down 0.3s ease-out; }
      `}</style>
    </>
  );
}
