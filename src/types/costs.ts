// Types for Cost Management System

export interface CostCenter {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description?: string;
  parentId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ExpenseCategory = 'fixo' | 'variavel' | 'semi_variavel';

export interface ExpenseType {
  id: string;
  companyId: string;
  name: string;
  category: ExpenseCategory;
  costCenterId: string;
  isRecurring: boolean;
  recurrenceDay?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PaymentStatus = 'pending' | 'paid' | 'overdue' | 'cancelled';
export type PaymentMethod = 'money' | 'pix' | 'credit' | 'debit' | 'bank_transfer' | 'boleto';

export interface OperationalExpense {
  id: string;
  companyId: string;
  expenseTypeId: string;
  costCenterId: string;
  amount: number;
  description?: string;
  referenceNumber?: string;
  dueDate: string;
  paymentDate?: string;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  supplierId?: string;
  userId: string;
  attachments?: any;
  tags?: string[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type BudgetPeriodType = 'monthly' | 'quarterly' | 'yearly';
export type BudgetStatus = 'draft' | 'active' | 'closed';

export interface Budget {
  id: string;
  companyId: string;
  name: string;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
  totalBudget: number;
  status: BudgetStatus;
  notes?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetItem {
  id: string;
  budgetId: string;
  costCenterId: string;
  expenseTypeId?: string;
  allocatedAmount: number;
  spentAmount: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CostTargetType = 'waste_reduction' | 'cost_per_product' | 'operational_limit' | 'profit_margin';
export type TargetPeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface CostTarget {
  id: string;
  companyId: string;
  targetType: CostTargetType;
  costCenterId?: string;
  productId?: string;
  targetValue: number;
  currentValue: number;
  periodType: TargetPeriodType;
  startDate: string;
  endDate?: string;
  alertThreshold?: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Analytics Types
export interface CostCenterSummary {
  costCenterId: string;
  companyId: string;
  costCenterName: string;
  costCenterCode: string;
  totalExpenses: number;
  totalSpent: number;
  totalPaid: number;
  totalPending: number;
  totalOverdue: number;
}

export interface BudgetAnalysis {
  budgetId: string;
  companyId: string;
  budgetName: string;
  periodType: BudgetPeriodType;
  startDate: string;
  endDate: string;
  totalBudget: number;
  status: BudgetStatus;
  totalAllocated: number;
  totalSpent: number;
  remainingBudget: number;
  utilizationPercentage: number;
}

export interface ProductCostAnalysis {
  productId: string;
  companyId: string;
  productName: string;
  category: string;
  currentCost: number;
  salePrice: number;
  grossProfitPerUnit: number;
  profitMarginPercentage: number;
  currentStock: number;
  inventoryValue: number;
  totalSoldQuantity: number;
  totalSalesValue: number;
}

export interface WasteAnalysis {
  companyId: string;
  month: Date;
  wasteEvents: number;
  totalQuantityWasted: number;
  totalWasteCost: number;
  wasteReason?: string;
  productCategory: string;
}
