import { getApiBaseUrl } from './apiConfig';

/** Raiz da API (stockpyrou-api via Railway → Postgres EasyPanel). */
export function getBackendApiRoot(): string {
  return getApiBaseUrl();
}

/**
 * Monta URL de backend para uma rota da API própria.
 * Ex.: getBackendUrl('/cashier/sale') → /api/cashier/sale.
 */
export function getBackendUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${p}`;
}
