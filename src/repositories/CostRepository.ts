import { supabase } from '../utils/supabase/client';
import type { 
  CostCenter, 
  ExpenseType, 
  OperationalExpense, 
  Budget, 
  BudgetItem,
  CostTarget 
} from '../types/costs';

export class CostRepository {
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
    if (filters?.paymentStatus) {
      query = query.eq('payment_status', filters.paymentStatus);
    }

    const { data, error } = await query.order('due_date', { ascending: false });

    if (error) throw error;
    return data as OperationalExpense[];
  }

  static async createExpense(expense: Omit<OperationalExpense, 'id' | 'createdAt' | 'updatedAt'>): Promise<OperationalExpense> {
    const { data, error } = await supabase
      .from('operational_expenses')
      .insert({
        company_id: expense.companyId,
        expense_type_id: expense.expenseTypeId,
        cost_center_id: expense.costCenterId,
        amount: expense.amount,
        description: expense.description,
        reference_number: expense.referenceNumber,
        due_date: expense.dueDate,
        payment_date: expense.paymentDate,
        payment_status: expense.paymentStatus,
        payment_method: expense.paymentMethod,
        payment_terms_type: expense.paymentTermsType ?? 'avista',
        invoice_days: expense.paymentTermsType === 'faturado' ? expense.invoiceDays ?? null : null,
        installment_count:
          expense.paymentTermsType === 'parcelado' ? expense.installmentCount ?? null : null,
        supplier_id: expense.supplierId,
        user_id: expense.userId,
        attachments: expense.attachments,
        tags: expense.tags,
        notes: expense.notes
      })
      .select()
      .single();

    if (error) throw error;
    return data as OperationalExpense;
  }

  static async updateExpense(id: string, updates: Partial<OperationalExpense>): Promise<OperationalExpense> {
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (updates.expenseTypeId !== undefined) patch.expense_type_id = updates.expenseTypeId;
    if (updates.costCenterId !== undefined) patch.cost_center_id = updates.costCenterId;
    if (updates.amount !== undefined) patch.amount = updates.amount;
    if (updates.description !== undefined) patch.description = updates.description;
    if (updates.referenceNumber !== undefined) patch.reference_number = updates.referenceNumber;
    if (updates.dueDate !== undefined) patch.due_date = updates.dueDate;

    if (updates.paymentStatus !== undefined) {
      patch.payment_status = updates.paymentStatus;
      patch.payment_date =
        updates.paymentStatus === 'paid' ? updates.paymentDate ?? null : null;
      patch.payment_method =
        updates.paymentStatus === 'paid' ? updates.paymentMethod ?? null : null;
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

    if (updates.supplierId !== undefined) {
      patch.supplier_id = updates.supplierId ?? null;
    }
    if (updates.attachments !== undefined) patch.attachments = updates.attachments;
    if (updates.tags !== undefined) patch.tags = updates.tags;
    if (updates.notes !== undefined) patch.notes = updates.notes;

    const { data, error } = await supabase.from('operational_expenses').update(patch).eq('id', id).select().single();

    if (error) throw error;
    return data as OperationalExpense;
  }

  static async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase
      .from('operational_expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;
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
