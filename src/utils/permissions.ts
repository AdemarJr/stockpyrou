import type { UserPermissions, UserRole } from '../types';

/** Espelho da matriz da API — usado como fallback se o token antigo não trouxer campos novos. */
export function getPermissionsByRole(role: UserRole): UserPermissions {
  switch (role) {
    case 'superadmin':
    case 'admin':
      return {
        canViewDashboard: true,
        canManageProducts: true,
        canDeleteProducts: true,
        canManageStock: true,
        canManageRecipes: true,
        canViewReports: true,
        canManageCosts: true,
        canManageUsers: true,
        canManageSettings: true,
        canAccessCashier: true,
      };
    case 'gerente':
      return {
        canViewDashboard: true,
        canManageProducts: true,
        canDeleteProducts: true,
        canManageStock: true,
        canManageRecipes: true,
        canViewReports: true,
        canManageCosts: true,
        canManageUsers: false,
        canManageSettings: false,
        canAccessCashier: true,
      };
    case 'operador':
      return {
        canViewDashboard: false,
        canManageProducts: false,
        canDeleteProducts: false,
        canManageStock: false,
        canManageRecipes: false,
        canViewReports: false,
        canManageCosts: false,
        canManageUsers: false,
        canManageSettings: false,
        canAccessCashier: true,
      };
    case 'visualizacao':
      return {
        canViewDashboard: true,
        canManageProducts: false,
        canDeleteProducts: false,
        canManageStock: false,
        canManageRecipes: false,
        canViewReports: true,
        canManageCosts: false,
        canManageUsers: false,
        canManageSettings: false,
        canAccessCashier: false,
      };
    default:
      return getPermissionsByRole('operador');
  }
}

export function getRoleRank(role: UserRole): number {
  switch (role) {
    case 'superadmin':
      return 5;
    case 'admin':
      return 4;
    case 'gerente':
      return 3;
    case 'operador':
      return 2;
    case 'visualizacao':
      return 1;
    default:
      return 0;
  }
}

/** Actor só atribui roles com rank estritamente menor (superadmin atribui qualquer). */
export function canAssignRole(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === 'superadmin') return true;
  return getRoleRank(actorRole) > getRoleRank(targetRole);
}

/** Actor pode editar/desativar/resetar o alvo (superadmin gerencia qualquer). */
export function canManageTargetUser(actorRole: UserRole, targetRole: UserRole): boolean {
  if (actorRole === 'superadmin') return true;
  return getRoleRank(actorRole) > getRoleRank(targetRole);
}

export function assignableRolesFor(actorRole: UserRole): UserRole[] {
  const all: UserRole[] = ['superadmin', 'admin', 'gerente', 'operador', 'visualizacao'];
  return all.filter((r) => canAssignRole(actorRole, r));
}

export function resolveUserPermissions(
  role: UserRole,
  permissions?: Partial<UserPermissions> | null,
): UserPermissions {
  const defaults = getPermissionsByRole(role);
  if (!permissions) return defaults;
  return {
    ...defaults,
    ...permissions,
    canAccessCashier:
      permissions.canAccessCashier !== undefined
        ? !!permissions.canAccessCashier
        : defaults.canAccessCashier,
    canManageSettings:
      permissions.canManageSettings !== undefined
        ? !!permissions.canManageSettings
        : defaults.canManageSettings,
    canManageCosts:
      permissions.canManageCosts !== undefined
        ? !!permissions.canManageCosts
        : defaults.canManageCosts,
  };
}
