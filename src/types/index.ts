// Types for StockPyrou

export type MeasurementUnit =
  | 'kg'
  | 'g'
  | 'l'
  | 'lt'
  | 'ml'
  | 'un'
  | 'cx'
  | 'pct'
  | 'porcao'
  | 'saco'
  | 'm'
  | 'cm'
  | 'mm';

export interface UnitConversion {
  unit: MeasurementUnit;
  equivalentTo: number; // How many base units
  baseUnit: MeasurementUnit;
}

export interface Company {
  id: string;
  name: string;
  cnpj?: string;
  email?: string;
  status?: 'active' | 'inactive';
  createdAt: Date;
}

export interface UserCompany {
  id: string;
  userId: string;
  companyId: string;
  role: 'admin' | 'gerente' | 'funcionario';
}

export interface Product {
  id: string;
  companyId: string;
  name: string;
  category: 'alimento' | 'bebida' | 'descartavel' | 'limpeza' | 'outro';
  isPerishable: boolean;
  measurementUnit: MeasurementUnit;
  conversions?: UnitConversion[];
  minStock: number;
  safetyStock: number;
  currentStock: number;
  averageCost: number; // CMP - Custo Médio Ponderado
  supplierId?: string;
  shelfLife?: number; // Validade em dias (armazenado em description)
  /**
   * Produto composto (promo/combo): ao vender/baixar este produto, o estoque deve ser baixado
   * nos itens abaixo (em vez do produto "pai").
   */
  bundleItems?: Array<{
    productId: string;
    quantity: number;
  }>;
  barcode?: string;
  sellingPrice?: number;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Supplier {
  id: string;
  companyId: string;
  name: string;
  contact: string;
  email?: string;
  phone?: string;
  rating: number; // 1-5
  reliability: number; // 0-100%
  createdAt: Date;
}

export interface PriceHistory {
  id: string;
  companyId: string;
  productId: string;
  supplierId: string;
  supplierName?: string; // Added for display convenience
  price: number;
  quantity: number;
  date: Date;
  invoiceNumber?: string;
}

export interface StockEntry {
  id: string;
  companyId: string;
  productId: string;
  supplierId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  batchNumber?: string;
  expirationDate?: Date;
  entryDate: Date;
  userId: string;
  notes?: string;
}

export interface StockMovement {
  id: string;
  companyId: string;
  productId: string;
  type: 'entrada' | 'saida' | 'venda' | 'ajuste' | 'desperdicio';
  quantity: number;
  reason: string;
  wasteReason?: 'vencimento' | 'quebra' | 'mau_uso' | 'outro';
  cost?: number;
  batchNumber?: string;
  date: Date;
  userId: string;
  notes?: string;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  date: Date;
  customerId?: string;
  eventType?: string;
}

export interface SaleItem {
  productId?: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Alert {
  id: string;
  type: 'expiration' | 'low_stock' | 'price_change' | 'waste';
  severity: 'low' | 'medium' | 'high';
  productId: string;
  message: string;
  date: Date;
  read: boolean;
  data?: any;
}

export interface DashboardKPI {
  totalStockValue: number;
  weeklyWaste: number;
  weeklyWastePercentage: number;
  monthlyWaste: number;
  monthlyWastePercentage: number;
  lowStockItems: number;
  expiringItems: number;
  averageMargin: number;
}

export interface DemandForecast {
  productId: string;
  forecastedQuantity: number;
  confidence: number; // 0-100%
  period: 'week' | 'month';
  basedOnEvents?: string[];
}

// User and Authentication Types

export type UserRole = 'superadmin' | 'admin' | 'gerente' | 'operador' | 'visualizacao';

export interface UserPermissions {
  canViewDashboard: boolean;
  canManageProducts: boolean;
  canDeleteProducts: boolean;
  canManageStock: boolean;
  canManageRecipes: boolean;
  canViewReports: boolean;
  canManageUsers: boolean;
  canManageSettings: boolean;
}

export interface UserProfile {
  id: string; // Supabase Auth ID
  email: string;
  fullName: string;
  role: UserRole;
  position?: string; // Cargo/Função
  permissions: UserPermissions;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  failedLoginAttempts?: number;
  lockoutUntil?: Date;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupData {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  position?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  companyId?: string;
  permissions: UserPermissions;
  accessToken: string;
}