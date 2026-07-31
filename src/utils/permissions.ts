import type { UserPermissions, UserRole } from '../types';

/** Espelho da matriz da API — usado como fallback se o token antigo não trouxer canAccessCashier. */
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
        canManageUsers: false,
        canManageSettings: false,
        canAccessCashier: false,
      };
    default:
      return getPermissionsByRole('operador');
  }
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
    // Tokens antigos sem o campo: usa a matriz do perfil
    canAccessCashier:
      permissions.canAccessCashier !== undefined
        ? !!permissions.canAccessCashier
        : defaults.canAccessCashier,
    canManageSettings:
      permissions.canManageSettings !== undefined
        ? !!permissions.canManageSettings
        : defaults.canManageSettings,
  };
}
