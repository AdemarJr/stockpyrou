import { apiClient } from '../lib/apiClient';
import type {
  AccountsReceivable,
  AccountsReceivablePayment,
  PaymentMethod,
  ReceivablesSummary,
} from '../types/costs';

export type ReceivableFilters = {
  paymentStatus?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  q?: string;
};

export class ReceivableApi {
  static async list(
    companyId: string,
    filters?: ReceivableFilters,
  ): Promise<AccountsReceivable[]> {
    const params = new URLSearchParams();
    if (filters?.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
    if (filters?.dueDateFrom) params.set('dueDateFrom', filters.dueDateFrom);
    if (filters?.dueDateTo) params.set('dueDateTo', filters.dueDateTo);
    if (filters?.q) params.set('q', filters.q);
    const qs = params.toString();
    const data = await apiClient.get<{ receivables: AccountsReceivable[] }>(
      `/receivables${qs ? `?${qs}` : ''}`,
      companyId,
    );
    return data.receivables ?? [];
  }

  static async summary(companyId: string): Promise<ReceivablesSummary> {
    return apiClient.get<ReceivablesSummary>('/receivables/summary', companyId);
  }

  static async create(
    companyId: string,
    payload: {
      amount: number;
      dueDate: string;
      customerName?: string;
      description?: string;
      referenceNumber?: string;
      notes?: string;
      installmentCount?: number;
    },
  ): Promise<AccountsReceivable> {
    const data = await apiClient.post<{ receivable: AccountsReceivable }>(
      '/receivables',
      payload,
      companyId,
    );
    return data.receivable;
  }

  static async update(
    id: string,
    companyId: string,
    payload: Partial<{
      customerName: string;
      description: string;
      referenceNumber: string;
      notes: string;
      dueDate: string;
      paymentStatus: string;
    }>,
  ): Promise<AccountsReceivable> {
    const data = await apiClient.put<{ receivable: AccountsReceivable }>(
      `/receivables/${id}`,
      payload,
      companyId,
    );
    return data.receivable;
  }

  static async remove(id: string, companyId: string): Promise<void> {
    await apiClient.delete(`/receivables/${id}`, companyId);
  }

  static async listPayments(
    id: string,
    companyId: string,
  ): Promise<AccountsReceivablePayment[]> {
    const data = await apiClient.get<{ payments: AccountsReceivablePayment[] }>(
      `/receivables/${id}/payments`,
      companyId,
    );
    return data.payments ?? [];
  }

  static async receivePayment(
    id: string,
    companyId: string,
    payload: { amount: number; paymentMethod?: PaymentMethod; notes?: string },
  ): Promise<AccountsReceivable> {
    const data = await apiClient.post<{ receivable: AccountsReceivable }>(
      `/receivables/${id}/payments`,
      payload,
      companyId,
    );
    return data.receivable;
  }
}
