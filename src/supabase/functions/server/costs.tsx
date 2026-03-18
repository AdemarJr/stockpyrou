import * as kv from './kv_store.tsx';

// ==================== HELPER FUNCTIONS ====================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getKvKey(companyId: string, type: string, id?: string): string {
  if (id) {
    return `cost:${companyId}:${type}:${id}`;
  }
  return `cost:${companyId}:${type}:`;
}

// ==================== COST CENTERS ====================

export async function getAllCostCenters(companyId: string) {
  const prefix = getKvKey(companyId, 'center');
  console.log('Getting cost centers with prefix:', prefix);
  const items = await kv.getByPrefix(prefix);
  console.log('Raw items from KV:', items);
  return items
    .filter((center: any) => center && center.is_active !== false)
    .sort((a: any, b: any) => a.code.localeCompare(b.code));
}

export async function createCostCenter(centerData: any) {
  console.log('createCostCenter called with:', centerData);
  const id = generateId();
  const center = {
    id,
    ...centerData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true
  };
  
  const key = getKvKey(centerData.company_id, 'center', id);
  console.log('Saving to KV with key:', key);
  await kv.set(key, center);
  console.log('Cost center saved successfully');
  return center;
}

export async function updateCostCenter(id: string, companyId: string, updates: any) {
  const key = getKvKey(companyId, 'center', id);
  const existing = await kv.get(key);
  
  if (!existing) {
    throw new Error('Cost center not found');
  }
  
  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };
  
  await kv.set(key, updated);
  return updated;
}

export async function deleteCostCenter(id: string, companyId: string) {
  const key = getKvKey(companyId, 'center', id);
  const existing = await kv.get(key);
  
  if (!existing) {
    throw new Error('Cost center not found');
  }
  
  const updated = {
    ...existing,
    is_active: false,
    updated_at: new Date().toISOString()
  };
  
  await kv.set(key, updated);
}

// ==================== EXPENSE TYPES ====================

export async function getAllExpenseTypes(companyId: string) {
  const prefix = getKvKey(companyId, 'expense-type');
  const items = await kv.getByPrefix(prefix);
  
  const centers = await getAllCostCenters(companyId);
  const centerMap = new Map(centers.map((c: any) => [c.id, c]));
  
  return items
    .filter((type: any) => type && type.is_active !== false)
    .map((type: any) => ({
      ...type,
      cost_centers_8a20b27d: type.cost_center_id ? centerMap.get(type.cost_center_id) : null
    }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
}

export async function createExpenseType(typeData: any) {
  const id = generateId();
  const expenseType = {
    id,
    ...typeData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true
  };
  
  const key = getKvKey(typeData.company_id, 'expense-type', id);
  await kv.set(key, expenseType);
  return expenseType;
}

export async function updateExpenseType(id: string, companyId: string, updates: any) {
  const key = getKvKey(companyId, 'expense-type', id);
  const existing = await kv.get(key);
  
  if (!existing) {
    throw new Error('Expense type not found');
  }
  
  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };
  
  await kv.set(key, updated);
  return updated;
}

export async function deleteExpenseType(id: string, companyId: string) {
  const key = getKvKey(companyId, 'expense-type', id);
  const existing = await kv.get(key);
  
  if (!existing) {
    throw new Error('Expense type not found');
  }
  
  // Soft delete - marca como inativo
  const updated = {
    ...existing,
    is_active: false,
    updated_at: new Date().toISOString()
  };
  
  await kv.set(key, updated);
}

// ==================== OPERATIONAL EXPENSES ====================

export async function getAllExpenses(companyId: string, filters?: any) {
  const prefix = getKvKey(companyId, 'expense');
  const items = await kv.getByPrefix(prefix);
  
  const [centers, types] = await Promise.all([
    getAllCostCenters(companyId),
    getAllExpenseTypes(companyId)
  ]);
  
  const centerMap = new Map(centers.map((c: any) => [c.id, c]));
  const typeMap = new Map(types.map((t: any) => [t.id, t]));
  
  let expenses = items.map((expense: any) => ({
    ...expense,
    expense_types_8a20b27d: expense.expense_type_id ? typeMap.get(expense.expense_type_id) : null,
    cost_centers_8a20b27d: expense.cost_center_id ? centerMap.get(expense.cost_center_id) : null,
    suppliers_8a20b27d: expense.supplier_name ? { name: expense.supplier_name } : null
  }));
  
  // Apply filters
  if (filters?.startDate) {
    expenses = expenses.filter((e: any) => e.due_date >= filters.startDate);
  }
  if (filters?.endDate) {
    expenses = expenses.filter((e: any) => e.due_date <= filters.endDate);
  }
  if (filters?.costCenterId) {
    expenses = expenses.filter((e: any) => e.cost_center_id === filters.costCenterId);
  }
  if (filters?.expenseTypeId) {
    expenses = expenses.filter((e: any) => e.expense_type_id === filters.expenseTypeId);
  }
  if (filters?.paymentStatus) {
    expenses = expenses.filter((e: any) => e.payment_status === filters.paymentStatus);
  }
  
  return expenses.sort((a: any, b: any) => b.due_date.localeCompare(a.due_date));
}

export async function createExpense(expenseData: any) {
  const id = generateId();
  const expense = {
    id,
    ...expenseData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const key = getKvKey(expenseData.company_id, 'expense', id);
  await kv.set(key, expense);
  return expense;
}

export async function updateExpense(id: string, companyId: string, updates: any) {
  const key = getKvKey(companyId, 'expense', id);
  const existing = await kv.get(key);
  
  if (!existing) {
    throw new Error('Expense not found');
  }
  
  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };
  
  await kv.set(key, updated);
  return updated;
}

export async function deleteExpense(id: string, companyId: string) {
  const key = getKvKey(companyId, 'expense', id);
  await kv.del(key);
}

// ==================== BUDGETS ====================

export async function getAllBudgets(companyId: string) {
  const prefix = getKvKey(companyId, 'budget');
  const items = await kv.getByPrefix(prefix);
  
  return items
    .sort((a: any, b: any) => b.start_date.localeCompare(a.start_date));
}

export async function getBudgetById(id: string, companyId: string) {
  const budgetKey = getKvKey(companyId, 'budget', id);
  const budget = await kv.get(budgetKey);
  
  if (!budget) {
    throw new Error('Budget not found');
  }
  
  const itemsPrefix = getKvKey(companyId, 'budget-item');
  const allItems = await kv.getByPrefix(itemsPrefix);
  const budgetItems = allItems
    .filter((item: any) => item.budget_id === id);
  
  const [centers, types] = await Promise.all([
    getAllCostCenters(companyId),
    getAllExpenseTypes(companyId)
  ]);
  
  const centerMap = new Map(centers.map((c: any) => [c.id, c]));
  const typeMap = new Map(types.map((t: any) => [t.id, t]));
  
  return {
    ...budget,
    budget_items_8a20b27d: budgetItems.map((item: any) => ({
      ...item,
      cost_centers_8a20b27d: item.cost_center_id ? centerMap.get(item.cost_center_id) : null,
      expense_types_8a20b27d: item.expense_type_id ? typeMap.get(item.expense_type_id) : null
    }))
  };
}

export async function createBudget(budgetData: any) {
  const id = generateId();
  const budget = {
    id,
    ...budgetData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const key = getKvKey(budgetData.company_id, 'budget', id);
  await kv.set(key, budget);
  return budget;
}

export async function updateBudget(id: string, companyId: string, updates: any) {
  const key = getKvKey(companyId, 'budget', id);
  const existing = await kv.get(key);
  
  if (!existing) {
    throw new Error('Budget not found');
  }
  
  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };
  
  await kv.set(key, updated);
  return updated;
}

// ==================== BUDGET ITEMS ====================

export async function getBudgetItems(budgetId: string, companyId: string) {
  const prefix = getKvKey(companyId, 'budget-item');
  const items = await kv.getByPrefix(prefix);
  
  const [centers, types] = await Promise.all([
    getAllCostCenters(companyId),
    getAllExpenseTypes(companyId)
  ]);
  
  const centerMap = new Map(centers.map((c: any) => [c.id, c]));
  const typeMap = new Map(types.map((t: any) => [t.id, t]));
  
  return items
    .filter((item: any) => item.budget_id === budgetId)
    .map((item: any) => ({
      ...item,
      cost_centers_8a20b27d: item.cost_center_id ? centerMap.get(item.cost_center_id) : null,
      expense_types_8a20b27d: item.expense_type_id ? typeMap.get(item.expense_type_id) : null
    }))
    .sort((a: any, b: any) => (a.cost_center_id || '').localeCompare(b.cost_center_id || ''));
}

export async function createBudgetItem(itemData: any) {
  const id = generateId();
  const item = {
    id,
    ...itemData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  
  const key = getKvKey(itemData.company_id, 'budget-item', id);
  await kv.set(key, item);
  return item;
}

export async function updateBudgetItem(id: string, companyId: string, updates: any) {
  const key = getKvKey(companyId, 'budget-item', id);
  const existing = await kv.get(key);
  
  if (!existing) {
    throw new Error('Budget item not found');
  }
  
  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };
  
  await kv.set(key, updated);
  return updated;
}

export async function deleteBudgetItem(id: string, companyId: string) {
  const key = getKvKey(companyId, 'budget-item', id);
  await kv.del(key);
}

// ==================== COST TARGETS ====================

export async function getAllCostTargets(companyId: string, isActive?: boolean) {
  const prefix = getKvKey(companyId, 'target');
  const items = await kv.getByPrefix(prefix);
  
  const centers = await getAllCostCenters(companyId);
  const centerMap = new Map(centers.map((c: any) => [c.id, c]));
  
  let targets = items.map((target: any) => ({
    ...target,
    cost_centers_8a20b27d: target.cost_center_id ? centerMap.get(target.cost_center_id) : null,
    products_8a20b27d: target.product_name ? { name: target.product_name } : null
  }));
  
  if (isActive !== undefined) {
    targets = targets.filter((t: any) => t.is_active === isActive);
  }
  
  return targets.sort((a: any, b: any) => b.created_at.localeCompare(a.created_at));
}

export async function createCostTarget(targetData: any) {
  const id = generateId();
  const target = {
    id,
    ...targetData,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true
  };
  
  const key = getKvKey(targetData.company_id, 'target', id);
  await kv.set(key, target);
  return target;
}

export async function updateCostTarget(id: string, companyId: string, updates: any) {
  const key = getKvKey(companyId, 'target', id);
  const existing = await kv.get(key);
  
  if (!existing) {
    throw new Error('Cost target not found');
  }
  
  const updated = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };
  
  await kv.set(key, updated);
  return updated;
}

// ==================== ANALYTICS ====================

export async function getCentersSummary(companyId: string) {
  const [centers, expenses] = await Promise.all([
    getAllCostCenters(companyId),
    getAllExpenses(companyId)
  ]);
  
  const summary = centers.map((center: any) => {
    const centerExpenses = expenses.filter((e: any) => e.cost_center_id === center.id);
    const totalSpent = centerExpenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0);
    const totalPaid = centerExpenses
      .filter((e: any) => e.payment_status === 'paid')
      .reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0);
    const totalPending = centerExpenses
      .filter((e: any) => e.payment_status === 'pending')
      .reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0);
    
    return {
      cost_center_id: center.id,
      cost_center_code: center.code,
      cost_center_name: center.name,
      total_spent: totalSpent.toString(),
      total_paid: totalPaid.toString(),
      total_pending: totalPending.toString(),
      expense_count: centerExpenses.length
    };
  });
  
  return summary;
}

export async function getProductCostAnalysis(companyId: string) {
  // Simplified - would need product data from inventory system
  return [];
}

export async function getWasteAnalysis(companyId: string) {
  // Simplified - would need waste tracking data
  return [];
}

export async function getBudgetAnalysis(companyId: string) {
  const budgets = await getAllBudgets(companyId);
  
  const analysis = [];
  for (const budget of budgets) {
    const budgetWithItems = await getBudgetById(budget.id, companyId);
    const items = budgetWithItems.budget_items_8a20b27d || [];
    
    const totalAllocated = items.reduce((sum: number, item: any) => 
      sum + parseFloat(item.allocated_amount || 0), 0);
    const totalSpent = items.reduce((sum: number, item: any) => 
      sum + parseFloat(item.spent_amount || 0), 0);
    const utilizationRate = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
    
    analysis.push({
      budget_id: budget.id,
      budget_name: budget.name,
      period_type: budget.period_type,
      start_date: budget.start_date,
      end_date: budget.end_date,
      total_budget: budget.total_budget,
      total_allocated: totalAllocated.toString(),
      total_spent: totalSpent.toString(),
      remaining: (totalAllocated - totalSpent).toString(),
      utilization_rate: utilizationRate.toFixed(2),
      status: budget.status,
      items_count: items.length
    });
  }
  
  return analysis;
}

// ==================== INITIALIZE DEFAULT COST CENTERS ====================

export async function initializeCostCenters(companyId: string) {
  const existing = await getAllCostCenters(companyId);
  
  if (existing && existing.length > 0) {
    console.log('Cost centers already initialized for company:', companyId);
    return { message: 'Cost centers already initialized' };
  }
  
  const defaultCenters = [
    { code: 'PROD', name: 'Produção', description: 'Centro de custo de produção e manufatura' },
    { code: 'ADM', name: 'Administrativo', description: 'Centro de custo administrativo' },
    { code: 'VEN', name: 'Vendas', description: 'Centro de custo de vendas e marketing' },
    { code: 'LOG', name: 'Logística', description: 'Centro de custo de logística e distribuição' },
    { code: 'TI', name: 'Tecnologia', description: 'Centro de custo de TI e infraestrutura' }
  ];
  
  const created = [];
  for (const center of defaultCenters) {
    const newCenter = await createCostCenter({
      company_id: companyId,
      code: center.code,
      name: center.name,
      description: center.description
    });
    created.push(newCenter);
  }
  
  console.log(`Successfully initialized ${created.length} cost centers for company ${companyId}`);
  return { message: 'Cost centers initialized successfully', centers: created };
}

// ==================== CALCULATE BREAKEVEN ====================

export async function calculateBreakeven(companyId: string, periodStart: string, periodEnd: string) {
  const expenses = await getAllExpenses(companyId, {
    startDate: periodStart,
    endDate: periodEnd
  });
  
  const totalCosts = expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount || 0), 0);
  
  // Simplified breakeven calculation
  return {
    total_fixed_costs: totalCosts,
    total_variable_costs: 0,
    average_selling_price: 0,
    unit_variable_cost: 0,
    breakeven_units: 0,
    breakeven_revenue: totalCosts
  };
}