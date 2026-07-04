/**
 * Feature flag: API própria (server/) em paralelo ao Supabase/Edge.
 * Padrão false — zero mudança de comportamento até VITE_USE_OWN_API=true.
 */
export function useOwnApi(): boolean {
  const raw = import.meta.env.VITE_USE_OWN_API;
  if (raw === undefined || raw === '') return false;
  return raw === 'true' || raw === '1';
}

/** Base da API (ex.: /api com proxy Vite ou http://localhost:3001/api). */
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  return '/api';
}
