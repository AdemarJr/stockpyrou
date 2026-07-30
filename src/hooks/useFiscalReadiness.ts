import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { useCompany } from '../contexts/CompanyContext';

/** Disparado após salvar config/cert fiscal — PDV atualiza a opção NFC-e. */
export const FISCAL_CONFIG_UPDATED_EVENT = 'stockpyrou:fiscal-config-updated';

export function notifyFiscalConfigUpdated() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FISCAL_CONFIG_UPDATED_EVENT));
}

export interface FiscalReadinessState {
  moduleEnabled: boolean;
  configComplete: boolean;
  ready: boolean;
  emissionAvailable: boolean;
  reasons: string[];
  loading: boolean;
}

const initial: FiscalReadinessState = {
  moduleEnabled: false,
  configComplete: false,
  ready: false,
  emissionAvailable: false,
  reasons: [],
  loading: true,
};

/** Prontidão fiscal da empresa atual (para opção NFC-e no PDV). */
export function useFiscalReadiness(opts?: {
  /** Reconsulta ao abrir o modal de pagamento */
  refreshKey?: number | boolean;
}): FiscalReadinessState & { refresh: () => void } {
  const { currentCompany } = useCompany();
  const [state, setState] = useState<FiscalReadinessState>(initial);

  const refresh = useCallback(() => {
    if (!currentCompany?.id) {
      setState({
        ...initial,
        loading: false,
        reasons: ['Empresa não selecionada'],
      });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    void apiClient
      .get<{
        moduleEnabled?: boolean;
        configComplete?: boolean;
        ready: boolean;
        emissionAvailable: boolean;
        reasons: string[];
      }>('/fiscal/readiness')
      .then((data) => {
        const moduleEnabled = data.moduleEnabled ?? !!data.ready;
        setState({
          moduleEnabled,
          configComplete: !!data.configComplete,
          ready: moduleEnabled || !!data.ready,
          emissionAvailable: !!data.emissionAvailable,
          reasons: Array.isArray(data.reasons) ? data.reasons : [],
          loading: false,
        });
      })
      .catch(() => {
        setState({
          moduleEnabled: false,
          configComplete: false,
          ready: false,
          emissionAvailable: false,
          reasons: ['Não foi possível verificar o módulo fiscal'],
          loading: false,
        });
      });
  }, [currentCompany?.id]);

  useEffect(() => {
    refresh();
  }, [refresh, opts?.refreshKey]);

  useEffect(() => {
    const onUpdate = () => refresh();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener(FISCAL_CONFIG_UPDATED_EVENT, onUpdate);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onUpdate);
    return () => {
      window.removeEventListener(FISCAL_CONFIG_UPDATED_EVENT, onUpdate);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onUpdate);
    };
  }, [refresh]);

  return { ...state, refresh };
}
