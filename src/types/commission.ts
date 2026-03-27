/** Comissões sobre vendas — vendedores, garçons e cozinha */

export type CommissionRoleKey = 'vendedores' | 'garcons' | 'cozinha';

export interface CommissionGroupConfig {
  key: CommissionRoleKey;
  label: string;
  percent: number;
  peopleCount: number;
}

export interface CommissionGroupResult extends CommissionGroupConfig {
  poolAmount: number;
  perPersonAmount: number;
}

export interface CommissionSnapshot {
  id: string;
  companyId: string;
  referenceMonth: string;
  totalSales: number;
  groups: CommissionGroupResult[];
  notes?: string;
  createdAt: string;
}
