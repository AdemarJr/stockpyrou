import { useEffect, useState } from 'react';
import { apiClient } from '../lib/apiClient';
import { useCompany } from '../contexts/CompanyContext';
import { FISCAL_CONFIG_UPDATED_EVENT } from './useFiscalReadiness';

/** Logo da empresa salva em Configurações → Fiscal (`fiscal_config.logo_url`). */
export function useCompanyLogo(): string | null {
  const { currentCompany } = useCompany();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!currentCompany?.id) {
      setLogoUrl(null);
      return;
    }

    let cancelled = false;
    const load = () => {
      void apiClient
        .get<{ config: { logoUrl?: string | null } | null }>('/fiscal/config')
        .then((data) => {
          if (cancelled) return;
          const url = data.config?.logoUrl ? String(data.config.logoUrl) : '';
          setLogoUrl(url || null);
        })
        .catch(() => {
          if (!cancelled) setLogoUrl(null);
        });
    };

    load();
    const onUpdate = () => load();
    window.addEventListener(FISCAL_CONFIG_UPDATED_EVENT, onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener(FISCAL_CONFIG_UPDATED_EVENT, onUpdate);
    };
  }, [currentCompany?.id]);

  return logoUrl;
}
