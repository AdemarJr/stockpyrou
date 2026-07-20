/**
 * Feature flag: API própria (stockpyrou-api / Railway → Postgres EasyPanel).
 *
 * Padrão: true (grava no EasyPanel via Railway).
 * Para voltar ao Supabase client + Edge: VITE_USE_OWN_API=false
 *
 * Ainda no Supabase (não migrados para a API):
 * - CostRepository (despesas/custos)
 * - Edge ZIG / Admin (funções make-server-8a20b27d)
 */
export function useOwnApi(): boolean {
  const raw = import.meta.env.VITE_USE_OWN_API;
  // Sem variável = own API (EasyPanel). Só desliga com false/0.
  if (raw === undefined || raw === '') return true;
  return raw === 'true' || raw === '1';
}

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
