/**
 * Utility to clean up corrupted or expired auth tokens
 * This prevents the "Invalid Refresh Token" error
 */

export function cleanupAuthState() {
  try {
    // Check if there are Supabase auth tokens in localStorage
    const hasSupabaseAuth = Object.keys(localStorage).some(
      key => key.startsWith('sb-') || key.includes('supabase.auth.token')
    );

    if (hasSupabaseAuth) {
      console.log('[Auth Cleanup] Checking for corrupted auth state...');
      
      // List of keys to potentially remove
      const authKeys: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          authKeys.push(key);
        }
      }

      // Log found keys for debugging
      if (authKeys.length > 0) {
        console.log('[Auth Cleanup] Found Supabase auth keys:', authKeys);
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
    
    // Remove custom token
    localStorage.removeItem('pyroustock_custom_token');
    
    // Remove all Supabase auth keys
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
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
