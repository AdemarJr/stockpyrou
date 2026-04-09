/** Nome exibido na aplicação (login, PWA, recibos, e-mails transacionais). */
export const APP_NAME = 'StockPyrou';

/** URL canônica do site (sem barra final): https://stockpyrou.com.br */
export const APP_ORIGIN = 'https://stockpyrou.com.br';

/** Base com barra final (Open Graph, canonical, links absolutos). */
export const APP_SITE_URL = `${APP_ORIGIN}/`;

export const LAST_COMPANY_STORAGE_KEY = 'stockpyrou_last_company_id';
export const LEGACY_LAST_COMPANY_STORAGE_KEY = 'stockwise_last_company_id';

export function readLastCompanyId(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem(LAST_COMPANY_STORAGE_KEY) ??
    localStorage.getItem(LEGACY_LAST_COMPANY_STORAGE_KEY)
  );
}

export function writeLastCompanyId(id: string): void {
  localStorage.setItem(LAST_COMPANY_STORAGE_KEY, id);
  localStorage.removeItem(LEGACY_LAST_COMPANY_STORAGE_KEY);
}

export function clearLastCompanyId(): void {
  localStorage.removeItem(LAST_COMPANY_STORAGE_KEY);
  localStorage.removeItem(LEGACY_LAST_COMPANY_STORAGE_KEY);
}
