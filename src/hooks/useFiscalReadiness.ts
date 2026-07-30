import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { useCompany } from '../contexts/CompanyContext';

export interface FiscalReadinessState {
  ready: boolean;
  emissionAvailable: boolean;
  reasons: string[];
  loading: boolean;
}

const initial: FiscalReadinessState = {
  ready: false,
  emissionAvailable: false,
  reasons: [],
  loading: true,
};

/** Prontidão fiscal da empresa atual (para checkbox NFC-e no PDV). */
export function useFiscalReadiness(): FiscalReadinessState & { refresh: () => void } {
  const { currentCompany } = useCompany();
  const [state, setState] = useState<FiscalReadinessState>(initial);

  const refresh = useCallback(() => {
    if (!currentCompany?.id) {
      setState({ ...initial, loading: false, reasons: ['Empresa não selecionada'] });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    void apiClient
      .get<{
        ready: boolean;
        emissionAvailable: boolean;
        reasons: string[];
      }>('/fiscal/readiness')
      .then((data) => {
        setState({
          ready: !!data.ready,
          emissionAvailable: !!data.emissionAvailable,
          reasons: Array.isArray(data.reasons) ? data.reasons : [],
          loading: false,
        });
      })
      .catch(() => {
        setState({
          ready: false,
          emissionAvailable: false,
          reasons: ['Não foi possível verificar o módulo fiscal'],
          loading: false,
        });
      });
  }, [currentCompany?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...state, refresh };
}
