import { readLastCompanyId } from '../config/branding';
import { CostApi } from './costApi';
import type {
  CostCenter,
  ExpenseType,
  OperationalExpense,
  PaymentMethod
} from '../types/costs';
import { ProductRepository } from './ProductRepository';

export class CostRepository {
  // ==================== COST CENTERS ====================

  static async findAllCostCenters(companyId: string): Promise<CostCenter[]> {
    return CostApi.findAllCostCenters(companyId);
  }

  static async findCostCenterById(id: string, companyId?: string): Promise<CostCenter | null> {
    const cid = companyId || readLastCompanyId();
    if (!cid) throw new Error('Empresa não selecionada');
    return CostApi.findCostCenterById(id, cid);
  }

  static async createCostCenter(center: Omit<CostCenter, 'id' | 'createdAt' | 'updatedAt'>): Promise<CostCenter> {
    return CostApi.createCostCenter(center);
  }

  static async updateCostCenter(
    id: string,
    updates: Partial<CostCenter>,
    companyId?: string
  ): Promise<CostCenter> {
    const cid = companyId || updates.companyId || readLastCompanyId();
    if (!cid) throw new Error('Empresa não selecionada');
    return CostApi.updateCostCenter(id, updates, cid);
  }

  static async deleteCostCenter(id: string, companyId?: string): Promise<void> {
    const cid = companyId || readLastCompanyId();
    if (!cid) throw new Error('Empresa não selecionada');
    await CostApi.deleteCostCenter(id, cid);
  }

  /** Cria centros padrão no Postgres se a empresa ainda não tiver nenhum ativo. */
  static async seedDefaultCostCentersIfEmpty(companyId: string): Promise<{ created: number }> {
    const existing = await this.findAllCostCenters(companyId);
    if (existing.length > 0) {
      return { created: 0 };
    }

    const defaults: Array<{ code: string; name: string; description: string }> = [
      { code: 'PROD', name: 'Produção', description: 'Produção e manufatura' },
      { code: 'ADM', name: 'Administrativo', description: 'Administrativo' },
      { code: 'VEN', name: 'Vendas', description: 'Vendas e marketing' },
      { code: 'LOG', name: 'Logística', description: 'Logística e distribuição' },
      { code: 'TI', name: 'Tecnologia', description: 'TI e infraestrutura' }
    ];

    for (const d of defaults) {
      await this.createCostCenter({
        companyId,
        name: d.name,
        code: d.code,
        description: d.description,
        parentId: undefined,
        isActive: true
      });
    }

    return { created: defaults.length };
  }

  // ==================== EXPENSE TYPES ====================

  static async findAllExpenseTypes(companyId: string): Promise<ExpenseType[]> {
    return CostApi.findAllExpenseTypes(companyId);
  }

  static async createExpenseType(type: Omit<ExpenseType, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExpenseType> {
    return CostApi.createExpenseType(type);
  }

  static async updateExpenseType(
    id: string,
    updates: Partial<ExpenseType>,
    companyId?: string
  ): Promise<ExpenseType> {
    const cid = companyId || updates.companyId || readLastCompanyId();
    if (!cid) throw new Error('Empresa não selecionada');
    return CostApi.updateExpenseType(id, updates, cid);
  }

  static async deleteExpenseType(id: string, companyId?: string): Promise<void> {
    const cid = companyId || readLastCompanyId();
    if (!cid) throw new Error('Empresa não selecionada');
    await CostApi.deleteExpenseType(id, cid);
  }

  // ==================== OPERATIONAL EXPENSES ====================

  static async findAllExpenses(
    companyId: string,
    filters?: {
      /** Inclusive, por data de vencimento (YYYY-MM-DD). Preferir a string para evitar fuso. */
      dueDateFrom?: string;
      /** Inclusive, por data de vencimento (YYYY-MM-DD). */
      dueDateTo?: string;
      startDate?: Date;
      endDate?: Date;
      costCenterId?: string;
      expenseTypeId?: string;
      supplierId?: string;
      paymentStatus?: string;
    }
  ): Promise<OperationalExpense[]> {
    return CostApi.findAllExpenses(companyId, filters);
  }

  /**
   * Valor estimado do inventário (estoque × custo médio) e total de compras (entradas) no mês corrente.
   */
  /** Métricas de estoque/custos para o mês (YYYY-MM). Se omitido, usa mês atual. */
  static async getStockCostMetrics(
    companyId: string,
    referenceMonth?: string
  ): Promise<{
    inventoryValue: number;
    purchasesMonthTotal: number;
  }> {
    const [inventoryValue, purchasesMonthTotal] = await Promise.all([
      ProductRepository.sumInventoryValue(companyId),
      CostApi.getStockPurchasesMonthTotal(companyId, referenceMonth)
    ]);
    return { inventoryValue, purchasesMonthTotal };
  }

  /** YYYY-MM (ex.: 2026-04) */
  static async getMonthlyFinancialSnapshot(
    companyId: string,
    month: string
  ): Promise<{
    month: string;
    revenue: number;
    cogs: number;
    fiadoReceivable: number;
  }> {
    const m = month.trim();
    if (!/^\d{4}-\d{2}$/.test(m)) {
      throw new Error('Mês inválido. Use o formato YYYY-MM.');
    }
    return CostApi.getMonthlyFinancialSnapshot(companyId, m);
  }

  /**
   * Projeção simples de fluxo de caixa: soma entradas/saídas por dia (realizado usa cash_date; previsto usa due_date).
   */
  static async getCashFlowProjection(
    companyId: string,
    startYmd: string,
    endYmd: string
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
    const start = startYmd.trim();
    const end = endYmd.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || start > end) {
      throw new Error('Intervalo inválido. Use YYYY-MM-DD (início <= fim).');
    }
    return CostApi.getCashFlowProjection(companyId, start, end);
  }

  static async getDreByMonth(
    companyId: string,
    startMonth: string,
    endMonth: string,
  ): Promise<Array<{ month: string; revenue: number; cogs: number; expenses: number; grossProfit: number; net: number }>> {
    const sm = startMonth.trim();
    const em = endMonth.trim();
    if (!/^\d{4}-\d{2}$/.test(sm) || !/^\d{4}-\d{2}$/.test(em) || sm > em) {
      throw new Error('Intervalo inválido. Use YYYY-MM (início <= fim).');
    }
    return CostApi.getDreByMonth(companyId, sm, em);
  }

  static async createExpense(expense: Omit<OperationalExpense, 'id' | 'createdAt' | 'updatedAt'>): Promise<OperationalExpense> {
    return CostApi.createExpense(expense);
  }

  /** Várias despesas em um insert (ex.: parcelas da mesma NF). */
  static async createExpensesBatch(
    items: Array<Omit<OperationalExpense, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<OperationalExpense[]> {
    if (items.length === 0) return [];
    return CostApi.createExpensesBatch(items);
  }

  static async updateExpense(id: string, updates: Partial<OperationalExpense>): Promise<OperationalExpense> {
    const companyId = updates.companyId || readLastCompanyId();
    if (!companyId) throw new Error('Empresa não selecionada');
    return CostApi.updateExpense(id, updates, companyId);
  }

  /**
   * Registra um pagamento (total ou parcial). Atualiza paid_amount, payment_status e datas.
   */
  static async registerExpensePayment(
    id: string,
    payNow: number,
    paymentMethod: PaymentMethod
  ): Promise<OperationalExpense> {
    const companyId = readLastCompanyId();
    if (!companyId) throw new Error('Empresa não selecionada');
    if (!Number.isFinite(payNow) || payNow <= 0) {
      throw new Error('Informe um valor maior que zero');
    }
    return CostApi.registerExpensePayment(id, payNow, paymentMethod, companyId);
  }

  static async findExpensePayments(companyId: string, expenseId: string): Promise<
    Array<{
      id: string;
      expense_id: string;
      amount: number;
      payment_date: string;
      payment_method: string | null;
      notes: string | null;
      created_at: string;
    }>
  > {
    return CostApi.findExpensePayments(companyId, expenseId) as Promise<
      Array<{
        id: string;
        expense_id: string;
        amount: number;
        payment_date: string;
        payment_method: string | null;
        notes: string | null;
        created_at: string;
      }>
    >;
  }

  static async deleteExpense(id: string): Promise<void> {
    const companyId = readLastCompanyId();
    if (!companyId) throw new Error('Empresa não selecionada');
    await CostApi.deleteExpense(id, companyId);
  }

  /** Remove todas as parcelas do mesmo grupo (mesma NF). */
  static async deleteExpenseGroup(companyId: string, expenseGroupId: string): Promise<void> {
    await CostApi.deleteExpenseGroup(companyId, expenseGroupId);
  }

  // ==================== ANALYTICS ====================

  static async getCostCenterSummary(companyId: string): Promise<any[]> {
    return CostApi.getCostCenterSummary(companyId);
  }

  static async getProductCostAnalysis(companyId: string): Promise<any[]> {
    return CostApi.getProductCostAnalysis(companyId);
  }

  static async getWasteAnalysis(companyId: string): Promise<any[]> {
    return CostApi.getWasteAnalysis(companyId);
  }
}
