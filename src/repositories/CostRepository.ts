import { supabase } from '../utils/supabase/client';
import type {
  CostCenter,
  ExpenseType,
  OperationalExpense,
  Budget,
  BudgetItem,
  CostTarget,
  PaymentMethod,
  PaymentStatus
} from '../types/costs';
import { messageFromUnknownError } from '../utils/errorMessage';
import {
  isPaidAmountColumnMissingError,
  mergeNotesWithPaidAmount,
  paidAmountFromExpenseRow
} from '../utils/expensePaidAmount';
import { ProductRepository } from './ProductRepository';

export class CostRepository {
  private static isExpenseGroupColumnsMissingError(message: string): boolean {
    const m = String(message || '');
    return (
      /expense_group_id/i.test(m) &&
      (/schema cache/i.test(m) || /column/i.test(m) || /operational_expenses/i.test(m))
    );
  }
  // ==================== COST CENTERS ====================
  
  static async findAllCostCenters(companyId: string): Promise<CostCenter[]> {
    const { data, error } = await supabase
      .from('cost_centers')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('code', { ascending: true });

    if (error) throw error;
    return data as CostCenter[];
  }

  static async findCostCenterById(id: string): Promise<CostCenter | null> {
    const { data, error } = await supabase
      .from('cost_centers')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as CostCenter;
  }

  static async createCostCenter(center: Omit<CostCenter, 'id' | 'createdAt' | 'updatedAt'>): Promise<CostCenter> {
    const { data, error } = await supabase
      .from('cost_centers')
      .insert({
        company_id: center.companyId,
        name: center.name,
        code: center.code,
        description: center.description,
        parent_id: center.parentId,
        is_active: center.isActive ?? true
      })
      .select()
      .single();

    if (error) throw error;
    return data as CostCenter;
  }

  static async updateCostCenter(id: string, updates: Partial<CostCenter>): Promise<CostCenter> {
    const { data, error } = await supabase
      .from('cost_centers')
      .update({
        name: updates.name,
        code: updates.code,
        description: updates.description,
        parent_id: updates.parentId,
        is_active: updates.isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as CostCenter;
  }

  static async deleteCostCenter(id: string): Promise<void> {
    const { error } = await supabase
      .from('cost_centers')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
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
    const { data, error } = await supabase
      .from('expense_types')
      .select('*, cost_centers(name, code)')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data as ExpenseType[];
  }

  static async createExpenseType(type: Omit<ExpenseType, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExpenseType> {
    const { data, error } = await supabase
      .from('expense_types')
      .insert({
        company_id: type.companyId,
        name: type.name,
        category: type.category,
        cost_center_id: type.costCenterId,
        is_recurring: type.isRecurring,
        recurrence_day: type.isRecurring ? type.recurrenceDay ?? null : null,
        is_active: type.isActive ?? true
      })
      .select()
      .single();

    if (error) throw error;
    return data as ExpenseType;
  }

  static async updateExpenseType(id: string, updates: Partial<ExpenseType>): Promise<ExpenseType> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.category !== undefined) patch.category = updates.category;
    if (updates.costCenterId !== undefined) patch.cost_center_id = updates.costCenterId;
    if (updates.isRecurring !== undefined) patch.is_recurring = updates.isRecurring;
    if (updates.isRecurring === false) {
      patch.recurrence_day = null;
    } else if (updates.recurrenceDay !== undefined) {
      patch.recurrence_day = updates.recurrenceDay;
    }
    if (updates.isActive !== undefined) patch.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('expense_types')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as ExpenseType;
  }

  static async deleteExpenseType(id: string): Promise<void> {
    const { error } = await supabase
      .from('expense_types')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
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
    let query = supabase
      .from('operational_expenses')
      .select(`
        *,
        expense_types(name, category),
        cost_centers(name, code),
        suppliers(name)
      `)
      .eq('company_id', companyId);

    const fromYmd =
      filters?.dueDateFrom ??
      (filters?.startDate ? filters.startDate.toISOString().split('T')[0] : undefined);
    const toYmd =
      filters?.dueDateTo ??
      (filters?.endDate ? filters.endDate.toISOString().split('T')[0] : undefined);

    if (fromYmd) {
      query = query.gte('due_date', fromYmd);
    }
    if (toYmd) {
      query = query.lte('due_date', toYmd);
    }
    if (filters?.costCenterId) {
      query = query.eq('cost_center_id', filters.costCenterId);
    }
    if (filters?.expenseTypeId) {
      query = query.eq('expense_type_id', filters.expenseTypeId);
    }
    if (filters?.supplierId) {
      query = query.eq('supplier_id', filters.supplierId);
    }
    if (filters?.paymentStatus) {
      query = query.eq('payment_status', filters.paymentStatus);
    }

    const { data, error } = await query.order('due_date', { ascending: false });

    if (error) throw error;
    return (await this.attachLinkedStockEntries(companyId, data || [])) as OperationalExpense[];
  }

  /** Enriquece despesas com dados da entrada de estoque vinculada (produto, valor, data). */
  private static async attachLinkedStockEntries(companyId: string, rows: any[]): Promise<any[]> {
    const ids = [...new Set(rows.map((r) => r.stock_entry_id).filter(Boolean))];
    if (ids.length === 0) return rows;
    const { data: entries, error } = await supabase
      .from('stock_entries')
      .select('id, total_cost, entry_date, product_id, supplier_id, products(name)')
      .eq('company_id', companyId)
      .in('id', ids);
    if (error) {
      console.warn('[CostRepository] attachLinkedStockEntries:', error.message);
      return rows;
    }
    const map = new Map((entries || []).map((e: any) => [e.id, e]));
    return rows.map((r) => ({
      ...r,
      linked_stock_entry: r.stock_entry_id ? map.get(r.stock_entry_id) ?? null : null
    }));
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
    const inventoryValue = await ProductRepository.sumInventoryValue(companyId);
    const month = referenceMonth?.trim();
    const startIso = (() => {
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        const startYmd = `${month}-01`;
        const start = new Date(`${startYmd}T00:00:00.000Z`);
        return start.toISOString();
      }
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return start.toISOString();
    })();
    const { data, error } = await supabase
      .from('stock_entries')
      .select('total_cost')
      .eq('company_id', companyId)
      .gte('entry_date', startIso);
    if (error) throw error;
    const purchasesMonthTotal = (data || []).reduce(
      (s, e: any) => s + parseFloat(String(e.total_cost ?? 0)),
      0
    );
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
  }> {
    const m = month.trim();
    if (!/^\d{4}-\d{2}$/.test(m)) {
      throw new Error('Mês inválido. Use o formato YYYY-MM.');
    }

    const startYmd = `${m}-01`;
    const start = new Date(`${startYmd}T00:00:00.000Z`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const startIso = start.toISOString();
    const endIso = end.toISOString();

    // Receita: tabela sales
    const { data: salesRows, error: salesErr } = await supabase
      .from('sales')
      .select('total')
      .eq('company_id', companyId)
      .gte('timestamp', startIso)
      .lt('timestamp', endIso);

    if (salesErr) throw salesErr;
    const revenue = (salesRows || []).reduce(
      (sum, r: any) => sum + (parseFloat(String(r.total ?? 0)) || 0),
      0
    );

    // COGS: baixa de estoque gerada por vendas (stock_movements com type='venda')
    const { data: movRows, error: movErr } = await supabase
      .from('stock_movements')
      .select('total_value, unit_cost, quantity, type, movement_date')
      .eq('company_id', companyId)
      .eq('type', 'venda')
      .gte('movement_date', startIso)
      .lt('movement_date', endIso);

    if (movErr) {
      // Se o schema/colunas estiverem diferentes, não quebra o dashboard inteiro.
      console.warn('[CostRepository] getMonthlyFinancialSnapshot cogs:', movErr.message);
    }

    const cogs = (movRows || []).reduce((sum: number, r: any) => {
      const tv = r.total_value;
      const totalValue = tv != null && tv !== '' ? Number(tv) : NaN;
      if (Number.isFinite(totalValue)) return sum + totalValue;
      const qty = Number(r.quantity) || 0;
      const uc = Number(r.unit_cost) || 0;
      return sum + qty * uc;
    }, 0);

    return {
      month: m,
      revenue,
      cogs
    };
  }

  /**
   * Monta linha para insert. Colunas de grupo de parcelas só entram quando há grupo —
   * assim o insert funciona mesmo sem migration `add_expense_group_installments.sql`.
   */
  private static expenseInsertRow(expense: Omit<OperationalExpense, 'id' | 'createdAt' | 'updatedAt'>) {
    const row: Record<string, unknown> = {
      company_id: expense.companyId,
      expense_type_id: expense.expenseTypeId,
      cost_center_id: expense.costCenterId,
      amount: expense.amount,
      description: expense.description ?? null,
      reference_number: expense.referenceNumber ?? null,
      due_date: expense.dueDate,
      payment_date: expense.paymentDate ?? null,
      payment_status: expense.paymentStatus,
      payment_method: expense.paymentMethod ?? null,
      payment_terms_type: expense.paymentTermsType ?? 'avista',
      invoice_days: expense.paymentTermsType === 'faturado' ? expense.invoiceDays ?? null : null,
      installment_count:
        expense.paymentTermsType === 'parcelado' ? expense.installmentCount ?? null : null,
      supplier_id: expense.supplierId ?? null,
      stock_entry_id: expense.stockEntryId ?? null,
      user_id: expense.userId,
      attachments: expense.attachments ?? null,
      tags: expense.tags ?? null,
      notes: expense.notes ?? null
    };

    if (
      expense.expenseGroupId != null ||
      expense.installmentIndex != null ||
      expense.installmentOf != null
    ) {
      row.expense_group_id = expense.expenseGroupId ?? null;
      row.installment_index = expense.installmentIndex ?? null;
      row.installment_of = expense.installmentOf ?? null;
    }

    return row;
  }

  static async createExpense(expense: Omit<OperationalExpense, 'id' | 'createdAt' | 'updatedAt'>): Promise<OperationalExpense> {
    const { data, error } = await supabase
      .from('operational_expenses')
      .insert(this.expenseInsertRow(expense))
      .select()
      .single();

    if (error) {
      const msg = messageFromUnknownError(error);
      if (this.isExpenseGroupColumnsMissingError(msg)) {
        throw new Error(
          `${msg} — Seu banco ainda não tem as colunas de parcelamento. Execute ` +
            `\`scripts/add_expense_group_installments.sql\` no Supabase (SQL Editor) e recarregue o app.`,
        );
      }
      throw error;
    }
    return data as OperationalExpense;
  }

  /** Várias despesas em um insert (ex.: parcelas da mesma NF). */
  static async createExpensesBatch(
    items: Array<Omit<OperationalExpense, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<OperationalExpense[]> {
    if (items.length === 0) return [];
    const rows = items.map((e) => this.expenseInsertRow(e));
    const { data, error } = await supabase.from('operational_expenses').insert(rows).select();

    if (error) {
      const msg = messageFromUnknownError(error);
      if (this.isExpenseGroupColumnsMissingError(msg)) {
        throw new Error(
          `${msg} — Para usar faturas parceladas (2x, 3x…), rode ` +
            `\`scripts/add_expense_group_installments.sql\` no Supabase (SQL Editor).`,
        );
      }
      throw error;
    }
    return (data || []) as OperationalExpense[];
  }

  static async updateExpense(id: string, updates: Partial<OperationalExpense>): Promise<OperationalExpense> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (updates.expenseTypeId !== undefined) patch.expense_type_id = updates.expenseTypeId;
    if (updates.costCenterId !== undefined) patch.cost_center_id = updates.costCenterId;
    if (updates.amount !== undefined) patch.amount = updates.amount;
    if (updates.paidAmount !== undefined) patch.paid_amount = updates.paidAmount;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.referenceNumber !== undefined) patch.reference_number = updates.referenceNumber;
    if (updates.dueDate !== undefined) patch.due_date = updates.dueDate;

    if (updates.paymentStatus !== undefined) {
      patch.payment_status = updates.paymentStatus;
      patch.payment_date =
        updates.paymentStatus === 'paid' ? updates.paymentDate ?? null : null;
      // Não zera payment_method ao marcar como pago sem enviar método (evita NOT NULL / CHECK no banco).
      if (updates.paymentMethod !== undefined) {
        patch.payment_method =
          updates.paymentStatus === 'paid' ? updates.paymentMethod ?? null : null;
      } else if (updates.paymentStatus !== 'paid') {
        patch.payment_method = null;
      }
    } else {
      if (updates.paymentDate !== undefined) patch.payment_date = updates.paymentDate;
      if (updates.paymentMethod !== undefined) patch.payment_method = updates.paymentMethod;
    }

    if (updates.paymentTermsType !== undefined) {
      patch.payment_terms_type = updates.paymentTermsType;
      patch.invoice_days =
        updates.paymentTermsType === 'faturado' ? updates.invoiceDays ?? null : null;
      patch.installment_count =
        updates.paymentTermsType === 'parcelado' ? updates.installmentCount ?? null : null;
    }
    if (updates.expenseGroupId !== undefined) patch.expense_group_id = updates.expenseGroupId;
    if (updates.installmentIndex !== undefined) patch.installment_index = updates.installmentIndex;
    if (updates.installmentOf !== undefined) patch.installment_of = updates.installmentOf;

    if (updates.supplierId !== undefined) {
      patch.supplier_id = updates.supplierId ?? null;
    }
    if (updates.stockEntryId !== undefined) {
      patch.stock_entry_id = updates.stockEntryId ?? null;
    }
    if (updates.attachments !== undefined) patch.attachments = updates.attachments;
    if (updates.tags !== undefined) patch.tags = updates.tags;
    if (updates.notes !== undefined) patch.notes = updates.notes;

    const { data, error } = await supabase.from('operational_expenses').update(patch).eq('id', id).select().single();

    if (error) throw error;
    return data as OperationalExpense;
  }

  /**
   * Registra um pagamento (total ou parcial). Atualiza paid_amount, payment_status e datas.
   */
  static async registerExpensePayment(
    id: string,
    payNow: number,
    paymentMethod: PaymentMethod
  ): Promise<OperationalExpense> {
    if (!Number.isFinite(payNow) || payNow <= 0) {
      throw new Error('Informe um valor maior que zero');
    }

    const { data: row, error: fetchErr } = await supabase
      .from('operational_expenses')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr) {
      throw new Error(messageFromUnknownError(fetchErr));
    }
    if (!row) {
      throw new Error('Despesa não encontrada');
    }

    const total = parseFloat(String(row.amount)) || 0;
    const prevPaid = paidAmountFromExpenseRow(row);
    const remaining = Math.max(0, Math.round((total - prevPaid) * 100) / 100);
    if (remaining <= 0) {
      throw new Error('Esta despesa já está quitada');
    }

    const applied = Math.min(Math.round(payNow * 100) / 100, remaining);
    const newPaid = Math.round((prevPaid + applied) * 100) / 100;
    const today = new Date().toISOString().split('T')[0];
    const dueRaw = row.due_date ? String(row.due_date).split('T')[0] : '';
    const st = String(row.payment_status || '');

    const isFullyPaid = newPaid >= total - 0.005;
    let nextStatus: PaymentStatus;
    if (isFullyPaid) {
      nextStatus = 'paid';
    } else if (dueRaw && dueRaw < today && (st === 'overdue' || st === 'pending')) {
      nextStatus = 'overdue';
    } else {
      nextStatus = 'pending';
    }

    const { data, error } = await supabase
      .from('operational_expenses')
      .update({
        paid_amount: isFullyPaid ? total : newPaid,
        payment_date: today,
        payment_method: paymentMethod,
        payment_status: nextStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      const m = messageFromUnknownError(error);
      const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';
      if (code === 'PGRST116' || /0 rows|no rows/i.test(m)) {
        throw new Error(
          `${m} — Nenhuma linha foi atualizada. Confirme se a despesa existe e se há política RLS permitindo UPDATE em operational_expenses para o seu usuário.`
        );
      }
      if (isPaidAmountColumnMissingError(m)) {
        const newNotes = mergeNotesWithPaidAmount(row.notes, isFullyPaid ? total : newPaid);
        const { data: row2, error: err2 } = await supabase
          .from('operational_expenses')
          .update({
            notes: newNotes,
            payment_date: today,
            payment_method: paymentMethod,
            payment_status: nextStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single();
        if (err2) {
          throw new Error(
            `${messageFromUnknownError(err2)} — Pagamento parcial exige a coluna paid_amount ou permissão para gravar em notes. Execute scripts/add_operational_expense_paid_amount.sql no Supabase.`
          );
        }
        return row2 as OperationalExpense;
      }
      throw new Error(m);
    }
    return data as OperationalExpense;
  }

  static async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase
      .from('operational_expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  /** Remove todas as parcelas do mesmo grupo (mesma NF). */
  static async deleteExpenseGroup(companyId: string, expenseGroupId: string): Promise<void> {
    const { error } = await supabase
      .from('operational_expenses')
      .delete()
      .eq('company_id', companyId)
      .eq('expense_group_id', expenseGroupId);

    if (error) {
      const msg = messageFromUnknownError(error);
      if (this.isExpenseGroupColumnsMissingError(msg)) {
        throw new Error(
          `${msg} — O recurso de grupos de parcelas exige a coluna expense_group_id. ` +
            `Rode \`scripts/add_expense_group_installments.sql\` no Supabase.`,
        );
      }
      throw error;
    }
  }

  // ==================== BUDGETS ====================

  static async findAllBudgets(companyId: string): Promise<Budget[]> {
    const { data, error } = await supabase
      .from('budgets')
      .select('*')
      .eq('company_id', companyId)
      .order('start_date', { ascending: false });

    if (error) throw error;
    return data as Budget[];
  }

  static async findBudgetById(id: string): Promise<Budget | null> {
    const { data, error } = await supabase
      .from('budgets')
      .select(`
        *,
        budget_items(
          *,
          cost_centers(name, code),
          expense_types(name, category)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as Budget;
  }

  static async createBudget(budget: Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>): Promise<Budget> {
    const { data, error } = await supabase
      .from('budgets')
      .insert({
        company_id: budget.companyId,
        name: budget.name,
        period_type: budget.periodType,
        start_date: budget.startDate,
        end_date: budget.endDate,
        total_budget: budget.totalBudget,
        status: budget.status,
        notes: budget.notes,
        created_by: budget.createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return data as Budget;
  }

  static async updateBudget(id: string, updates: Partial<Budget>): Promise<Budget> {
    const { data, error } = await supabase
      .from('budgets')
      .update({
        name: updates.name,
        period_type: updates.periodType,
        start_date: updates.startDate,
        end_date: updates.endDate,
        total_budget: updates.totalBudget,
        status: updates.status,
        notes: updates.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Budget;
  }

  // ==================== BUDGET ITEMS ====================

  static async findBudgetItems(budgetId: string): Promise<BudgetItem[]> {
    const { data, error } = await supabase
      .from('budget_items')
      .select(`
        *,
        cost_centers(name, code),
        expense_types(name, category)
      `)
      .eq('budget_id', budgetId)
      .order('cost_center_id', { ascending: true });

    if (error) throw error;
    return data as BudgetItem[];
  }

  static async createBudgetItem(item: Omit<BudgetItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<BudgetItem> {
    const { data, error } = await supabase
      .from('budget_items')
      .insert({
        budget_id: item.budgetId,
        cost_center_id: item.costCenterId,
        expense_type_id: item.expenseTypeId,
        allocated_amount: item.allocatedAmount,
        spent_amount: item.spentAmount || 0,
        notes: item.notes
      })
      .select()
      .single();

    if (error) throw error;
    return data as BudgetItem;
  }

  static async updateBudgetItem(id: string, updates: Partial<BudgetItem>): Promise<BudgetItem> {
    const { data, error } = await supabase
      .from('budget_items')
      .update({
        cost_center_id: updates.costCenterId,
        expense_type_id: updates.expenseTypeId,
        allocated_amount: updates.allocatedAmount,
        spent_amount: updates.spentAmount,
        notes: updates.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as BudgetItem;
  }

  static async deleteBudgetItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('budget_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // ==================== COST TARGETS ====================

  static async findAllCostTargets(companyId: string, isActive?: boolean): Promise<CostTarget[]> {
    const build = (select: string) => {
      let q = supabase.from('cost_targets').select(select).eq('company_id', companyId);
      if (isActive !== undefined) {
        q = q.eq('is_active', isActive);
      }
      return q.order('created_at', { ascending: false });
    };

    const withCenters = await build(`
      *,
      cost_centers(name, code)
    `);

    if (!withCenters.error) {
      return withCenters.data as CostTarget[];
    }

    console.warn('[CostRepository] findAllCostTargets (com centro):', withCenters.error.message);

    const plain = await build('*');
    if (plain.error) throw plain.error;
    return plain.data as CostTarget[];
  }

  static async createCostTarget(target: Omit<CostTarget, 'id' | 'createdAt' | 'updatedAt'>): Promise<CostTarget> {
    const { data, error } = await supabase
      .from('cost_targets')
      .insert({
        company_id: target.companyId,
        target_type: target.targetType,
        cost_center_id: target.costCenterId,
        product_id: target.productId,
        target_value: target.targetValue,
        current_value: target.currentValue || 0,
        period_type: target.periodType,
        start_date: target.startDate,
        end_date: target.endDate,
        alert_threshold: target.alertThreshold,
        is_active: target.isActive ?? true
      })
      .select()
      .single();

    if (error) throw error;
    return data as CostTarget;
  }

  static async updateCostTarget(id: string, updates: Partial<CostTarget>): Promise<CostTarget> {
    const { data, error } = await supabase
      .from('cost_targets')
      .update({
        target_value: updates.targetValue,
        current_value: updates.currentValue,
        end_date: updates.endDate,
        alert_threshold: updates.alertThreshold,
        is_active: updates.isActive,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as CostTarget;
  }

  // ==================== ANALYTICS ====================

  static async getCostCenterSummary(companyId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('v_cost_center_summary')
      .select('*')
      .eq('company_id', companyId);

    if (error) throw error;
    return data;
  }

  static async getBudgetAnalysis(companyId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('v_budget_analysis')
      .select('*')
      .eq('company_id', companyId);

    if (error) {
      console.warn('[CostRepository] getBudgetAnalysis (view opcional):', error.message);
      return [];
    }
    return data ?? [];
  }

  static async getProductCostAnalysis(companyId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('v_product_cost_analysis')
      .select('*')
      .eq('company_id', companyId);

    if (error) throw error;
    return data;
  }

  static async getWasteAnalysis(companyId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('v_waste_analysis')
      .select('*')
      .eq('company_id', companyId);

    if (error) throw error;
    return data;
  }
}
