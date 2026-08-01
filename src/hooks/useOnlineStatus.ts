import { useEffect, useState } from 'react';

/** Estado de conectividade do navegador (navigator.onLine + eventos online/offline). */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  );

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

export function assertOnline(actionLabel = 'esta ação'): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false;
  }
  return true;
}

export function offlineActionMessage(actionLabel = 'esta ação'): string {
  return `Sem internet. Não é possível ${actionLabel} offline. Reconecte e tente novamente.`;
}
