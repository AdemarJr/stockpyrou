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

  static async findCostCenterById(id: string, companyId: string): Promise<CostCenter | null> {
    try {
      const data = await apiClient.get<{ costCenter: CostCenter }>(
        `/costs/centers/${id}`,
        companyId,
      );
      return data.costCenter ?? null;
    } catch {
      return null;
    }
  }

  static async createCostCenter(
    center: Omit<CostCenter, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<CostCenter> {
    const data = await apiClient.post<{ costCenter: CostCenter }>(
      '/costs/centers',
      center,
      center.companyId,
    );
    return data.costCenter;
  }

  static async updateCostCenter(
    id: string,
    updates: Partial<CostCenter>,
    companyId: string,
  ): Promise<CostCenter> {
    const data = await apiClient.put<{ costCenter: CostCenter }>(
      `/costs/centers/${id}`,
      updates,
      companyId,
    );
    return data.costCenter;
  }

  static async deleteCostCenter(id: string, companyId: string): Promise<void> {
    await apiClient.delete(`/costs/centers/${id}`, companyId);
  }

  static async findAllExpenseTypes(companyId: string): Promise<ExpenseType[]> {
    const data = await apiClient.get<{ expenseTypes: ExpenseType[] }>(
      '/costs/types',
      companyId,
    );
    return data.expenseTypes ?? [];
  }

  static async createExpenseType(
    type: Omit<ExpenseType, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<ExpenseType> {
    const data = await apiClient.post<{ expenseType: ExpenseType }>(
      '/costs/types',
      type,
      type.companyId,
    );
    return data.expenseType;
  }

  static async updateExpenseType(
    id: string,
    updates: Partial<ExpenseType>,
    companyId: string,
  ): Promise<ExpenseType> {
    const data = await apiClient.put<{ expenseType: ExpenseType }>(
      `/costs/types/${id}`,
      updates,
      companyId,
    );
    return data.expenseType;
  }

  static async deleteExpenseType(id: string, companyId: string): Promise<void> {
    await apiClient.delete(`/costs/types/${id}`, companyId);
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

  static async getStockPurchasesMonthTotal(
    companyId: string,
    referenceMonth?: string,
  ): Promise<number> {
    const qs = referenceMonth ? `?month=${encodeURIComponent(referenceMonth)}` : '';
    const data = await apiClient.get<{ purchasesMonthTotal: number }>(
      `/costs/metrics/stock${qs}`,
      companyId,
    );
    return Number(data.purchasesMonthTotal) || 0;
  }

  static async getMonthlyFinancialSnapshot(
    companyId: string,
    month: string,
  ): Promise<{ month: string; revenue: number; cogs: number; fiadoReceivable: number }> {
    const data = await apiClient.get<{
      month: string;
      revenue: number;
      cogs: number;
      fiadoReceivable: number;
    }>(`/costs/metrics/financial-snapshot?month=${encodeURIComponent(month)}`, companyId);
    return data;
  }

  static async getCashFlowProjection(
    companyId: string,
    startYmd: string,
    endYmd: string,
  ): Promise<
    Array<{
      date: string;
      inRealized: number;
      inExpected: number;
      outRealized: number;
      outExpected: number;
      net: number;
      projectedBalance: number;
    }>
  > {
    const data = await apiClient.get<{
      days: Array<{
        date: string;
        inRealized: number;
        inExpected: number;
        outRealized: number;
        outExpected: number;
        net: number;
        projectedBalance: number;
      }>;
    }>(
      `/costs/analytics/cash-flow?start=${encodeURIComponent(startYmd)}&end=${encodeURIComponent(endYmd)}`,
      companyId,
    );
    return data.days ?? [];
  }

  static async getDreByMonth(
    companyId: string,
    startMonth: string,
    endMonth: string,
  ): Promise<
    Array<{ month: string; revenue: number; cogs: number; expenses: number; grossProfit: number; net: number }>
  > {
    const data = await apiClient.get<{
      dre: Array<{ month: string; revenue: number; cogs: number; expenses: number; grossProfit: number; net: number }>;
    }>(
      `/costs/analytics/dre?startMonth=${encodeURIComponent(startMonth)}&endMonth=${encodeURIComponent(endMonth)}`,
      companyId,
    );
    return data.dre ?? [];
  }

  static async getCostCenterSummary(companyId: string): Promise<any[]> {
    const data = await apiClient.get<{ summary: any[] }>(
      '/costs/analytics/cost-centers-summary',
      companyId,
    );
    return data.summary ?? [];
  }

  static async getProductCostAnalysis(companyId: string): Promise<any[]> {
    const data = await apiClient.get<{ products: any[] }>(
      '/costs/analytics/product-costs',
      companyId,
    );
    return data.products ?? [];
  }

  static async getWasteAnalysis(companyId: string): Promise<any[]> {
    const data = await apiClient.get<{ waste: any[] }>('/costs/analytics/waste', companyId);
    return data.waste ?? [];
  }
}
