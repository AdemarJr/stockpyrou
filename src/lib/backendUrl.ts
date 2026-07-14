import { projectId } from '../utils/supabase/env';
import { getApiBaseUrl, useOwnApi } from './apiConfig';

const LEGACY_PREFIX = '/make-server-8a20b27d';

/** Raiz da API (Edge Function ou server/ próprio). */
export function getBackendApiRoot(): string {
  if (useOwnApi()) return getApiBaseUrl();
  return `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d`;
}

/**
 * Monta URL de backend compatível com rotas legadas da Edge Function.
 * Ex.: getBackendUrl('/cashier/sale') → /api/cashier/sale (flag on) ou Edge URL (flag off).
 */
export function getBackendUrl(path: string): string {
  let p = path.startsWith('/') ? path : `/${path}`;
  if (p.startsWith(LEGACY_PREFIX)) {
    p = p.slice(LEGACY_PREFIX.length);
  }
  if (useOwnApi()) {
    return `${getApiBaseUrl()}${p}`;
  }
  return `${getBackendApiRoot()}${p}`;
}
