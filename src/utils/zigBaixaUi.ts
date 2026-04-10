/** Preferência local: desliga só o fluxo «Buscar vendas / baixa» em Vendas/Baixa (por empresa, neste navegador). */

const storageKey = (companyId: string) => `stockpyrou:zigBaixaUiDisabled:${companyId}`;

export const ZIG_BAIXA_UI_EVENT = 'stockpyrou-zig-baixa-ui';

export function readZigBaixaUiDisabled(companyId: string): boolean {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(storageKey(companyId)) === '1';
}

export function writeZigBaixaUiDisabled(companyId: string, disabled: boolean): void {
  if (typeof localStorage === 'undefined') return;
  if (disabled) localStorage.setItem(storageKey(companyId), '1');
  else localStorage.removeItem(storageKey(companyId));
  window.dispatchEvent(
    new CustomEvent(ZIG_BAIXA_UI_EVENT, { detail: { companyId } }),
  );
}
