/**
 * Tipos usados por auth.tsx — copiados de `src/types/index.ts` para o bundle da Edge Function
 * não depender de caminhos fora de `supabase/functions/...`.
 */

export type UserRole = "superadmin" | "admin" | "gerente" | "operador" | "visualizacao";

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
  id: string;
  email: string;
  fullName: string;
  /** Atalho usado no backend para resolver empresa quando existir. */
  companyId?: string;
  role: UserRole;
  position?: string;
  permissions: UserPermissions;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  failedLoginAttempts?: number;
  lockoutUntil?: Date;
}
