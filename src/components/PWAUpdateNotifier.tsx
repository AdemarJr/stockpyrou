import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, Download, X } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { APP_NAME } from '../config/branding';
import { safeStorage } from '../utils/safeStorage';

const DISMISSED_SW_KEY = 'stockpyrou_sw_update_dismissed';
const TOAST_ID = 'pwa-update-available';

/**
 * Único registrador do Service Worker.
 * Banner/toast só quando há worker em `waiting` (atualização real pendente).
 */
export function PWAUpdateNotifier() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const promptedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let intervalId = 0;
    let cancelled = false;

    const waitingKey = (reg: ServiceWorkerRegistration) =>
      reg.waiting?.scriptURL || '';

    const wasDismissed = (reg: ServiceWorkerRegistration) => {
      const key = waitingKey(reg);
      return !!key && safeStorage.getItem(DISMISSED_SW_KEY) === key;
    };

    const promptUpdate = (reg: ServiceWorkerRegistration) => {
      if (!reg.waiting || !navigator.serviceWorker.controller) return;
      if (wasDismissed(reg)) return;
      const key = waitingKey(reg);
      if (!key || promptedKeyRef.current === key) return;

      promptedKeyRef.current = key;
      registrationRef.current = reg;
      setRegistration(reg);
      setShowBanner(true);

      toast.info('Nova versão disponível!', {
        id: TOAST_ID,
        description: 'Há uma atualização pronta. Clique para aplicar.',
        duration: 12_000,
        action: {
          label: 'Atualizar',
          onClick: () => applyWaitingWorker(reg),
        },
      });
    };

    const watchInstalling = (reg: ServiceWorkerRegistration) => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller &&
          reg.waiting
        ) {
          promptUpdate(reg);
        }
      });
    };

    const run = async () => {
      try {
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
        registrationRef.current = reg;
        setRegistration(reg);

        if (reg.waiting && navigator.serviceWorker.controller) {
          promptUpdate(reg);
        }

        reg.addEventListener('updatefound', () => watchInstalling(reg));

        void reg.update();
        intervalId = window.setInterval(() => {
          void reg.update().then(() => {
            if (reg.waiting && navigator.serviceWorker.controller) {
              promptUpdate(reg);
            }
          });
        }, 120_000);
      } catch (error) {
        console.log('ℹ️ Service Worker registration skipped:', error);
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  const handleUpdate = () => {
    const reg = registrationRef.current || registration;
    if (reg) applyWaitingWorker(reg);
    else window.location.reload();
  };

  const handleDismiss = () => {
    const reg = registrationRef.current || registration;
    const key = reg?.waiting?.scriptURL;
    if (key) safeStorage.setItem(DISMISSED_SW_KEY, key);
    setShowBanner(false);
    promptedKeyRef.current = key || null;
    toast.dismiss(TOAST_ID);
    toast.message('Atualização adiada', {
      description: 'Você pode atualizar depois recarregando a página.',
      duration: 4000,
    });
  };

  if (!showBanner) return null;

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 md:hidden bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 shadow-2xl z-50 animate-slide-up">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">Nova versão disponível!</p>
              <p className="text-xs opacity-90">Toque para atualizar</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleUpdate}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg font-bold text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Atualizar
            </button>
            <button
              type="button"
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
            <RefreshCw className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-black text-gray-900 mb-1">Nova Versão Disponível!</h3>
            <p className="text-sm text-gray-600 mb-4">
              Uma atualização do {APP_NAME} está pronta. Clique em atualizar para obter as novidades.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUpdate}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Atualizar Agora
              </button>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors"
              >
                Mais Tarde
              </button>
            </div>
          </div>
          <button
            type="button"
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

function applyWaitingWorker(reg: ServiceWorkerRegistration) {
  const waiting = reg.waiting;
  if (!waiting) {
    window.location.reload();
    return;
  }
  safeStorage.removeItem(DISMISSED_SW_KEY);
  toast.dismiss(TOAST_ID);
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      window.location.reload();
    },
    { once: true },
  );
  waiting.postMessage({ type: 'SKIP_WAITING' });
}
