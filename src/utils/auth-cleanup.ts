/**
 * Limpa tokens de autenticação legados / corrompidos no browser.
 * Remove chaves antigas `sb-*` de sessões de provedor anterior.
 */

function isLegacyAuthKey(key: string): boolean {
  return key.startsWith('sb-');
}

export function cleanupAuthState() {
  try {
    const hasLegacyAuth = Object.keys(localStorage).some(isLegacyAuthKey);

    if (hasLegacyAuth) {
      console.log('[Auth Cleanup] Checking for corrupted auth state...');

      const authKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && isLegacyAuthKey(key)) {
          authKeys.push(key);
        }
      }

      if (authKeys.length > 0) {
        console.log('[Auth Cleanup] Found legacy auth keys:', authKeys);
      }
    }
  } catch (error) {
    console.error('[Auth Cleanup] Error during cleanup:', error);
  }
}

/**
 * Force clear all authentication state
 * Use this when user explicitly wants to reset auth
 */
export function forceLogout() {
  try {
    console.log('[Auth Cleanup] Force clearing all auth state...');

    localStorage.removeItem('pyroustock_custom_token');

    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isLegacyAuthKey(key)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach((key) => {
      console.log('[Auth Cleanup] Removing key:', key);
      localStorage.removeItem(key);
    });

    console.log('[Auth Cleanup] Auth state cleared successfully');
    return true;
  } catch (error) {
    console.error('[Auth Cleanup] Error during force logout:', error);
    return false;
  }
}

/** Remove Service Worker + caches do PWA (corrige login/tela branca com JS antigo). */
export async function forceAppRefresh(): Promise<boolean> {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    forceLogout();
    return true;
  } catch (error) {
    console.error('[Auth Cleanup] Error during force app refresh:', error);
    return false;
  }
}
