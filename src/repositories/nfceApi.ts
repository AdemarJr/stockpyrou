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

  static async list(companyId?: string, limit = 50) {
    const data = await apiClient.get<{ nfce: NfceSummary[] }>(
      `/fiscal/nfce?limit=${limit}`,
      companyId,
    );
    return data.nfce ?? [];
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
