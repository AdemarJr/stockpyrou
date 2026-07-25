/** Base da API (ex.: /api com proxy Vite ou URL Railway …/api). */
export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  // Produção: Railway. Local: proxy Vite /api → :3001
  if (import.meta.env.PROD) {
    return 'https://stockpyrou-api-production.up.railway.app/api';
  }
  return '/api';
}
