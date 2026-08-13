import { apiClient } from '../lib/apiClient';
import { openDanfePrintWindow } from './nfceApi';

export interface NfeSummary {
  id: string;
  companyId: string;
  saleId: string | null;
  customerId: string | null;
  chaveAcesso: string | null;
  numero: number;
  serie: number;
  modelo: string;
  ambiente: string;
  status: string;
  protocolo: string | null;
  codigoStatus: string | null;
  motivoStatus: string | null;
  dataEmissao?: string;
  dataAutorizacao?: string | null;
  hasAuthorizedXml?: boolean;
  hasDanfe?: boolean;
}

export class NfeApi {
  static async emitFromSale(saleId: string, companyId?: string) {
    return apiClient.post<{ success: boolean; message: string; nfe: NfeSummary; error?: string }>(
      '/fiscal/nfe',
      { saleId },
      companyId,
    );
  }

  static async getBySale(saleId: string, companyId?: string) {
    const data = await apiClient.get<{ nfe: NfeSummary[] }>(
      `/fiscal/nfe/by-sale/${saleId}`,
      companyId,
    );
    return data.nfe ?? [];
  }

  static async get(id: string, companyId?: string) {
    const data = await apiClient.get<{ nfe: NfeSummary }>(`/fiscal/nfe/${id}`, companyId);
    return data.nfe;
  }

  static async getDanfe(id: string, companyId?: string) {
    return apiClient.get<{ html: string; status: string; chaveAcesso?: string }>(
      `/fiscal/nfe/${id}/danfe`,
      companyId,
    );
  }

  static async getXml(id: string, companyId?: string) {
    return apiClient.get<{ xml: string; status: string; chaveAcesso?: string }>(
      `/fiscal/nfe/${id}/xml`,
      companyId,
    );
  }

  static async cancel(id: string, justification: string, companyId?: string) {
    return apiClient.post<{ success: boolean; message: string; nfe: NfeSummary }>(
      `/fiscal/nfe/${id}/cancel`,
      { justification },
      companyId,
    );
  }

  static async list(
    companyId?: string,
    opts: { limit?: number; from?: string; to?: string; status?: string } | number = 50,
  ) {
    const q =
      typeof opts === 'number'
        ? { limit: opts }
        : { limit: opts.limit ?? 50, from: opts.from, to: opts.to, status: opts.status };
    const params = new URLSearchParams();
    params.set('limit', String(q.limit ?? 50));
    if (q.from) params.set('from', q.from);
    if (q.to) params.set('to', q.to);
    if (q.status) params.set('status', q.status);
    const data = await apiClient.get<{ nfe: NfeSummary[] }>(
      `/fiscal/nfe?${params.toString()}`,
      companyId,
    );
    return data.nfe ?? [];
  }
}

export { openDanfePrintWindow };
