import { apiClient } from '../lib/apiClient';
import type {
  CostCenter,
  ExpenseType,
  OperationalExpense,
  PaymentMethod,
} from '../types/costs';

export type ExpenseFilters = {
  dueDateFrom?: string;
  dueDateTo?: string;
  startDate?: Date;
  endDate?: Date;
  costCenterId?: string;
  expenseTypeId?: string;
  supplierId?: string;
  paymentStatus?: string;
};

function ymd(d?: Date): string | undefined {
  if (!d) return undefined;
  return d.toISOString().split('T')[0];
}

export class CostApi {
  static async findAllCostCenters(companyId: string): Promise<CostCenter[]> {
    const data = await apiClient.get<{ costCenters: CostCenter[] }>(
      '/costs/centers',
      companyId,
    );
    return data.costCenters ?? [];
  }

  static async findAllExpenseTypes(companyId: string): Promise<ExpenseType[]> {
    const data = await apiClient.get<{ expenseTypes: ExpenseType[] }>(
      '/costs/types',
      companyId,
    );
    return data.expenseTypes ?? [];
  }

  static async findAllExpenses(
    companyId: string,
    filters?: ExpenseFilters,
  ): Promise<OperationalExpense[]> {
    const params = new URLSearchParams();
    const from = filters?.dueDateFrom ?? ymd(filters?.startDate);
    const to = filters?.dueDateTo ?? ymd(filters?.endDate);
    if (from) params.set('dueDateFrom', from);
    if (to) params.set('dueDateTo', to);
    if (filters?.costCenterId) params.set('costCenterId', filters.costCenterId);
    if (filters?.expenseTypeId) params.set('expenseTypeId', filters.expenseTypeId);
    if (filters?.supplierId) params.set('supplierId', filters.supplierId);
    if (filters?.paymentStatus) params.set('paymentStatus', filters.paymentStatus);
    const qs = params.toString();
    const data = await apiClient.get<{ expenses: OperationalExpense[] }>(
      `/costs/expenses${qs ? `?${qs}` : ''}`,
      companyId,
    );
    return data.expenses ?? [];
  }

  static async createExpense(
    expense: Omit<OperationalExpense, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<OperationalExpense> {
    const data = await apiClient.post<{ expense: OperationalExpense }>(
      '/costs/expenses',
      expense,
      expense.companyId,
    );
    return data.expense;
  }

  static async createExpensesBatch(
    items: Array<Omit<OperationalExpense, 'id' | 'createdAt' | 'updatedAt'>>,
  ): Promise<OperationalExpense[]> {
    if (items.length === 0) return [];
    const companyId = items[0].companyId;
    const data = await apiClient.post<{ expenses: OperationalExpense[] }>(
      '/costs/expenses',
      { expenses: items },
      companyId,
    );
    return data.expenses ?? [];
  }

  static async updateExpense(
    id: string,
    updates: Partial<OperationalExpense>,
    companyId: string,
  ): Promise<OperationalExpense> {
    const data = await apiClient.put<{ expense: OperationalExpense }>(
      `/costs/expenses/${id}`,
      updates,
      companyId,
    );
    return data.expense;
  }

  static async deleteExpense(id: string, companyId: string): Promise<void> {
    await apiClient.delete(`/costs/expenses/${id}`, companyId);
  }

  static async deleteExpenseGroup(companyId: string, groupId: string): Promise<void> {
    await apiClient.delete(`/costs/expenses/group/${groupId}`, companyId);
  }

  static async findExpensePayments(
    companyId: string,
    expenseId: string,
  ): Promise<
    Array<{ id: string; amount: number; payment_date: string; payment_method: string | null }>
  > {
    const data = await apiClient.get<{
      payments: Array<{
        id: string;
        amount: number;
        payment_date: string;
        payment_method: string | null;
      }>;
    }>(`/costs/expenses/${expenseId}/payments`, companyId);
    return data.payments ?? [];
  }

  static async registerExpensePayment(
    id: string,
    payNow: number,
    paymentMethod: PaymentMethod,
    companyId: string,
  ): Promise<OperationalExpense> {
    const data = await apiClient.post<{ expense: OperationalExpense }>(
      `/costs/expenses/${id}/payments`,
      { amount: payNow, paymentMethod },
      companyId,
    );
    return data.expense;
  }
}
