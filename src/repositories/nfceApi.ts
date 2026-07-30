import { apiClient } from '../lib/apiClient';

export interface NfceSummary {
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
  qrCodeUrl: string | null;
  dataEmissao?: string;
  dataAutorizacao?: string | null;
  hasAuthorizedXml?: boolean;
  hasDanfe?: boolean;
}

export interface NfcePendingSale {
  saleId: string;
  total: number;
  paymentMethod: string | null;
  timestamp?: string;
  emitNfce: boolean;
  customerId: string | null;
  customerName: string | null;
  lastNfceStatus: string | null;
  lastNfceId: string | null;
  lastNfceMotivo: string | null;
}

export class NfceApi {
  static async emitFromSale(saleId: string, companyId?: string) {
    return apiClient.post<{ success: boolean; message: string; nfce: NfceSummary; error?: string }>(
      '/fiscal/nfce',
      { saleId },
      companyId,
    );
  }

  static async getBySale(saleId: string, companyId?: string) {
    const data = await apiClient.get<{ nfce: NfceSummary[] }>(
      `/fiscal/nfce/by-sale/${saleId}`,
      companyId,
    );
    return data.nfce ?? [];
  }

  static async get(id: string, companyId?: string) {
    const data = await apiClient.get<{ nfce: NfceSummary }>(`/fiscal/nfce/${id}`, companyId);
    return data.nfce;
  }

  static async getDanfe(id: string, companyId?: string) {
    return apiClient.get<{ html: string; status: string; chaveAcesso?: string }>(
      `/fiscal/nfce/${id}/danfe`,
      companyId,
    );
  }

  static async getXml(id: string, companyId?: string) {
    return apiClient.get<{ xml: string; status: string; chaveAcesso?: string }>(
      `/fiscal/nfce/${id}/xml`,
      companyId,
    );
  }

  static async cancel(id: string, justification: string, companyId?: string) {
    return apiClient.post<{ success: boolean; message: string; nfce: NfceSummary }>(
      `/fiscal/nfce/${id}/cancel`,
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
    const data = await apiClient.get<{ nfce: NfceSummary[] }>(
      `/fiscal/nfce?${params.toString()}`,
      companyId,
    );
    return data.nfce ?? [];
  }

  static async listPendingSales(
    companyId?: string,
    opts: { from?: string; to?: string; mode?: 'requested' | 'all'; limit?: number } = {},
  ) {
    const params = new URLSearchParams();
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.mode) params.set('mode', opts.mode);
    if (opts.limit) params.set('limit', String(opts.limit));
    const data = await apiClient.get<{ sales: NfcePendingSale[] }>(
      `/fiscal/nfce/pending-sales?${params.toString()}`,
      companyId,
    );
    return data.sales ?? [];
  }
}

export function openDanfePrintWindow(html: string) {
  const w = window.open('', '_blank', 'noopener,noreferrer,width=480,height=800');
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    try {
      w.print();
    } catch {
      /* ignore */
    }
  }, 400);
  return true;
}
