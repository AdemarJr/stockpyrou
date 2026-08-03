import { apiClient } from '../lib/apiClient';

export interface InboundNfeNote {
  id: string;
  companyId: string;
  chaveAcesso: string;
  nsu: string | null;
  schemaType: string | null;
  numero: number | null;
  serie: number | null;
  modelo: string;
  emitCnpj: string | null;
  emitNome: string | null;
  destCnpj: string | null;
  dataEmissao?: string;
  valorTotal: number;
  status: string;
  ambiente?: 'homologation' | 'production';
  manifestStatus: string | null;
  errorMessage: string | null;
  hasFullXml: boolean;
  itemCount: number | null;
  importedAt?: string;
  createdAt?: string;
}

export interface InboundPreviewItem {
  line: number;
  cProd: string;
  cEAN: string;
  xProd: string;
  ncm: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  batchNumber?: string;
  expirationDate?: string;
  productId: string | null;
  productName: string | null;
  matchType: 'barcode' | 'code' | 'name' | 'none';
}

export class InboundNfeApi {
  static async sync(companyId?: string) {
    return apiClient.post<{
      success: boolean;
      ultNsu: string;
      newDocuments: number;
      downloadedFullXml: number;
      messages: string[];
      notes: InboundNfeNote[];
      environment?: 'homologation' | 'production';
      cnpj?: string;
      uf?: string;
      error?: string;
    }>('/fiscal/inbound/sync', {}, companyId);
  }

  static async resetNsu(companyId?: string) {
    return apiClient.post<{ success: boolean; ultNsu: string }>(
      '/fiscal/inbound/reset-nsu',
      {},
      companyId,
    );
  }

  static async list(companyId?: string, status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    const data = await apiClient.get<{ notes: InboundNfeNote[]; needsMigration?: boolean }>(
      `/fiscal/inbound${q}`,
      companyId,
    );
    return data;
  }

  static async preview(id: string, companyId?: string) {
    return apiClient.get<{
      note: InboundNfeNote;
      items: InboundPreviewItem[];
      suggestedSupplierId: string | null;
      suggestedSupplierName: string | null;
    }>(`/fiscal/inbound/${id}/preview`, companyId);
  }

  static async resolveSupplier(id: string, supplierId?: string | null, companyId?: string) {
    return apiClient.post<{ supplierId: string; note: InboundNfeNote }>(
      `/fiscal/inbound/${id}/resolve-supplier`,
      { supplierId: supplierId ?? null },
      companyId,
    );
  }

  static async markImported(id: string, companyId?: string) {
    return apiClient.post<{ note: InboundNfeNote }>(
      `/fiscal/inbound/${id}/mark-imported`,
      {},
      companyId,
    );
  }

  static async ignore(id: string, companyId?: string) {
    return apiClient.post<{ note: InboundNfeNote }>(
      `/fiscal/inbound/${id}/ignore`,
      {},
      companyId,
    );
  }
}
