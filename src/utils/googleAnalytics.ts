/**
 * Google Analytics 4 (gtag) — carregamento sob demanda.
 * Defina `VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX` no `.env.local` (Vite só expõe variáveis com prefixo VITE_).
 */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function getGaMeasurementId(): string | undefined {
  const id = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();
  // Fallback: ID fixo solicitado para a LandingPage
  return id || 'G-D4BSSTQC1V';
}

/**
 * Injeta gtag.js e envia o page_view inicial (GA4).
 * Seguro chamar mais de uma vez — só executa na primeira vez com ID válido.
 */
export function initGoogleAnalytics(): void {
  if (initialized || typeof window === 'undefined') return;
  const measurementId = getGaMeasurementId();
  if (!measurementId) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: true,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  initialized = true;
}
