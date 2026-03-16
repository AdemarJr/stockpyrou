import { createClient } from 'jsr:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';
import type { UserProfile, UserRole, UserPermissions } from '../../../types/index.ts';

// Crypto para hash de senha
import { createHash } from 'node:crypto';
import { compare, hash as bcryptHash, compareSync } from "npm:bcryptjs";

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

// Hash de senha simples (use bcrypt em produção)
export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false;
  // Check for bcrypt hash (starts with $2a$ or $2b$)
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    try {
      return await compare(password, hash);
    } catch (e) {
      console.error('Bcrypt compare error:', e);
      return false;
    }
  }
  // Fallback to SHA256
  return hashPassword(password) === hash;
}

// Helper function to get permissions by role
export function getPermissionsByRole(role: UserRole): UserPermissions {
  switch (role) {
    case 'superadmin':
      return {
        canViewDashboard: true,
        canManageProducts: true,
        canDeleteProducts: true,
        canManageStock: true,
        canManageRecipes: true,
        canViewReports: true,
        canManageUsers: true,
        canManageSettings: true,
      };
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
      };
    case 'operador':
      return {
        canViewDashboard: true,
        canManageProducts: true,
        canDeleteProducts: false,
        canManageStock: false,
        canManageRecipes: false,
        canViewReports: false,
        canManageUsers: false,
        canManageSettings: false,
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
      };
  }
}

// Verify user authentication and return user profile
export async function verifyAuth(authorizationHeader: string | null): Promise<UserProfile | null> {
  if (!authorizationHeader) {
    return null;
  }

  const accessToken = authorizationHeader.split(' ')[1];
  if (!accessToken) {
    return null;
  }

  return verifySupabaseToken(accessToken);
}

// Verify Supabase JWT and return user profile
export async function verifySupabaseToken(token: string): Promise<UserProfile | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error('Auth error:', error);
      return null;
    }

    // Get user profile from KV store
    const profileData = await kv.get(`user:${user.id}`);
    if (!profileData) {
      console.log('⚠️ User profile not found for Supabase user:', user.id, '- Creating default profile');
      
      // Create a default profile for Supabase Auth users
      const metadata = user.user_metadata || {};
      const defaultProfile: UserProfile = {
        id: user.id,
        email: user.email || '',
        fullName: metadata.name || metadata.full_name || user.email?.split('@')[0] || 'Usuário',
        role: 'operator', // Default role for Supabase Auth users
        permissions: getPermissionsByRole('operator'),
        status: 'active',
        createdAt: new Date(user.created_at),
        updatedAt: new Date(),
        lastLogin: new Date(),
      };
      
      // Save the profile to KV store
      await kv.set(`user:${user.id}`, defaultProfile);
      await kv.set(`user:email:${user.email}`, user.id);
      
      console.log('✅ Created default profile for Supabase user:', user.email);
      return defaultProfile;
    }

    const profile = profileData as UserProfile;
    
    // Update last login
    profile.lastLogin = new Date();
    await kv.set(`user:${user.id}`, profile);

    return profile;
  } catch (error) {
    console.error('Error verifying auth:', error);
    return null;
  }
}

// Create a new user (signup)
export async function createUser(
  email: string,
  password: string,
  fullName: string,
  role: UserRole,
  position?: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm since email server hasn't been configured
    });

    if (error || !data.user) {
      console.error('Error creating user in Supabase Auth:', error);
      return { success: false, error: error?.message || 'Failed to create user' };
    }

    // Create user profile
    const permissions = getPermissionsByRole(role);
    const profile: UserProfile = {
      id: data.user.id,
      email,
      fullName,
      role,
      position,
      permissions,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      failedLoginAttempts: 0,
    };

    // Save profile to KV store
    await kv.set(`user:${data.user.id}`, profile); // Pass object directly

    // Add to users list
    const usersListData = await kv.get('users:list');
    const usersList = Array.isArray(usersListData) ? usersListData : []; // KV returns array directly
    usersList.push(data.user.id);
    await kv.set('users:list', usersList); // Pass array directly

    return { success: true, user: profile };
  } catch (error: any) {
    console.error('Error in createUser:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// Get all users
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    console.log('🔍 getAllUsers: Fetching users list from KV...');
    const usersListData = await kv.get('users:list');
    console.log('📋 getAllUsers: Users list data:', usersListData);
    
    if (!usersListData) {
      console.log('⚠️ getAllUsers: No users list found');
      return [];
    }

    // KV store returns array directly (not string)
    const userIds = Array.isArray(usersListData) ? usersListData : [];
    console.log(`📊 getAllUsers: Found ${userIds.length} user IDs`);
    
    if (userIds.length === 0) {
      console.log('⚠️ getAllUsers: User IDs array is empty');
      return [];
    }

    const users: UserProfile[] = [];

    for (const userId of userIds) {
      try {
        console.log(`🔍 getAllUsers: Fetching profile for user ${userId}...`);
        const profileData = await kv.get(`user:${userId}`);
        
        if (profileData) {
          // KV store returns object directly (not string)
          users.push(profileData as UserProfile);
          console.log(`✅ getAllUsers: Added user ${userId}`);
        } else {
          console.log(`⚠️ getAllUsers: No profile found for user ${userId}`);
        }
      } catch (profileError) {
        console.error(`❌ getAllUsers: Error getting profile for user ${userId}:`, profileError);
        continue;
      }
    }

    console.log(`✅ getAllUsers: Returning ${users.length} users`);
    return users;
  } catch (error) {
    console.error('❌ getAllUsers: Error getting all users:', error);
    return [];
  }
}

// Update user
export async function updateUser(
  userId: string,
  updates: Partial<UserProfile>
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    const profileData = await kv.get(`user:${userId}`);
    if (!profileData) {
      return { success: false, error: 'User not found' };
    }

    const profile = profileData as UserProfile; // KV returns object directly
    
    // Update allowed fields
    if (updates.fullName) profile.fullName = updates.fullName;
    if (updates.position !== undefined) profile.position = updates.position;
    if (updates.status) profile.status = updates.status;
    
    // Update role and permissions
    if (updates.role) {
      profile.role = updates.role;
      profile.permissions = getPermissionsByRole(updates.role);
    }
    
    profile.updatedAt = new Date();

    // Save updated profile
    await kv.set(`user:${userId}`, profile); // Pass object directly

    return { success: true, user: profile };
  } catch (error: any) {
    console.error('Error updating user:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// Reset user password (admin only)
export async function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (error) {
      console.error('Error resetting password:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error in resetUserPassword:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// Delete user (soft delete - set status to inactive)
export async function deleteUser(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await updateUser(userId, { status: 'inactive' });
    return result;
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// Track failed login attempts
export async function trackFailedLogin(email: string): Promise<void> {
  try {
    // Get all users to find by email
    const users = await getAllUsers();
    const user = users.find(u => u.email === email);
    
    if (!user) return;

    const profileData = await kv.get(`user:${user.id}`);
    if (!profileData) return;

    const profile = profileData as UserProfile; // KV returns object directly
    
    profile.failedLoginAttempts = (profile.failedLoginAttempts || 0) + 1;
    
    // Lock account after 5 failed attempts for 15 minutes
    if (profile.failedLoginAttempts >= 5) {
      profile.lockoutUntil = new Date(Date.now() + 15 * 60 * 1000);
    }

    await kv.set(`user:${user.id}`, profile); // Pass object directly
  } catch (error) {
    console.error('Error tracking failed login:', error);
  }
}

// Reset failed login attempts on successful login
export async function resetFailedLogins(userId: string): Promise<void> {
  try {
    const profileData = await kv.get(`user:${userId}`);
    if (!profileData) return;

    const profile = profileData as UserProfile; // KV returns object directly
    profile.failedLoginAttempts = 0;
    profile.lockoutUntil = undefined;
    
    await kv.set(`user:${userId}`, profile); // Pass object directly
  } catch (error) {
    console.error('Error resetting failed logins:', error);
  }
}

// Check if account is locked
export async function isAccountLocked(email: string): Promise<boolean> {
  try {
    const users = await getAllUsers();
    const user = users.find(u => u.email === email);
    
    if (!user || !user.lockoutUntil) return false;
    
    return new Date() < new Date(user.lockoutUntil);
  } catch (error) {
    console.error('Error checking account lock:', error);
    return false;
  }
}

// ============================================
// HELPER FUNCTIONS (Internal)
// ============================================

// Tenta recuperar uma empresa legada pelo nome se o email falhar
async function recoverLegacyCompany(companiesKeys: any[], email: string, password: string): Promise<any | null> {
  console.log('🚑 Recovery: Attempting to find legacy company...');
  
  for (const item of companiesKeys) {
    if (item.value && typeof item.value === 'object') {
      const company = item.value as any;
      // Procura por nome similar (específico para Fuego neste caso)
      if (company.name && (company.name.toLowerCase().includes('fuego'))) {
        console.log('🚑 Recovery: Found match:', company.name, company.id);
        
        // Auto-fix: Atualiza o email para garantir login futuro
        company.email = email;
        await kv.set(`company:${company.id}`, company);
        
        // Auto-fix: Reseta senha
        const newHash = hashPassword(password);
        await kv.set(`company_password:${company.id}`, newHash);
        
        return company;
      }
    }
  }
  return null;
}

// Tenta reparar credenciais corrompidas ou resetar senha padrão
async function attemptAutoRepair(
  company: any, 
  email: string, 
  password: string, 
  currentHash: string | null
): Promise<string> {
  // Caso 1: Senha inexistente
  if (!currentHash) {
     console.log('🚑 Repair: Setting missing password...');
     const newHash = hashPassword(password);
     await kv.set(`company_password:${company.id}`, newHash);
     return newHash;
  }
  
  // Caso 2: Senha incorreta para conta Admin mestre conhecida (Reset de emergência)
  if (email === 'admin@fuego.com.br' && password === 'Fuego@2026') {
     const isValid = await verifyPassword(password, currentHash);
     if (!isValid) {
       console.log('🚑 Repair: Password mismatch for master account. Resetting...');
       const newHash = hashPassword(password);
       await kv.set(`company_password:${company.id}`, newHash);
       return newHash;
     }
  }
  
  return currentHash;
}

// ============================================
// CUSTOM AUTHENTICATION (without Supabase Auth)
// ============================================

// Login customizado - verifica credenciais no kv_store
export async function loginWithPassword(
  email: string,
  password: string
): Promise<{ success: boolean; user?: UserProfile; token?: string; error?: string }> {
  try {
    console.log('🔍 Step 1: Login attempt for:', email);
    
    // FORCE POSTGRES CHECK FOR ADMINS
    // This ensures that special admin accounts always use the robust logic in loginWithAppUsers
    // which handles bootstrapping, password hashing updates, and role mapping correctly.
    if (
      email === 'admin@fuego.com.br' || 
      email === 'admin@stockwise.com'
    ) {
      console.log('⚡ High priority admin login detected, using app_users table directly...');
      const appUserResult = await loginWithAppUsers(email, password);
      
      if (appUserResult.success) {
        return appUserResult;
      }

      // If user exists but password is wrong, fail immediately
      if (appUserResult.error === 'Invalid credentials') {
        return appUserResult;
      }

      console.log('⚠️ Admin not found in app_users, falling back to legacy login flow...');
    }
    
    console.log('🔍 Step 1b: Looking for email index in KV:', `user:email:${email}`);
    
    // Buscar usuário por email
    const emailIndexData = await kv.get(`user:email:${email}`);
    console.log('📊 Email index data:', emailIndexData);
    
    // If user not found, try app_users table (PostgreSQL)
    if (!emailIndexData) {
      console.log('❌ User not found in KV, checking app_users table...');
      const appUserResult = await loginWithAppUsers(email, password);
      
      if (appUserResult.success) {
        return appUserResult;
      }

      console.log('❌ User not found in app_users, trying company login...');
      return await loginWithCompanyCredentials(email, password);
    }

    const emailIndex = emailIndexData as { userId: string };
    const userId = emailIndex.userId;
    console.log('✅ Found userId in KV:', userId);

    console.log('🔍 Step 2: Looking for user profile:', `user:${userId}`);
    
    // Buscar perfil do usuário
    const profileData = await kv.get(`user:${userId}`);
    
    // Fallback inteligente: Se perfil KV incompleto ou senha inválida, checar app_users
    // Isso é crucial para usuários criados via Admin Panel que podem não ter hash no KV
    // ou se quisermos priorizar a tabela SQL em caso de falha de cache.
    const profile = profileData as UserProfile & { passwordHash?: string };

    let kvLoginSuccess = false;

    if (profile && profile.status !== 'inactive' && profile.passwordHash) {
        const isValidPassword = await verifyPassword(password, profile.passwordHash);
        if (isValidPassword) {
            kvLoginSuccess = true;
        } else {
            console.log('❌ Invalid password in KV. Trying app_users...');
        }
    } else {
        console.log('⚠️ KV Profile missing or no password hash. Trying app_users...');
    }

    if (!kvLoginSuccess) {
       // Tenta autenticar via app_users (Postgres)
       const appUserResult = await loginWithAppUsers(email, password);
       if (appUserResult.success) {
           return appUserResult;
       }
       
       // Se falhar no app_users e tínhamos perfil no KV (mas senha errada), é erro de credencial
       if (profile) {
           return { success: false, error: 'Invalid credentials' };
       }
    }

    // Se chegou aqui, KV Login foi Sucesso (kvLoginSuccess = true)
    console.log('✅ KV Password verified! Updating last login...');


    // Atualizar último login
    profile.lastLogin = new Date();
    profile.failedLoginAttempts = 0;
    profile.lockoutUntil = undefined;
    await kv.set(`user:${userId}`, profile);

    // Gerar token simples (userId como token)
    const token = `custom_${userId}_${Date.now()}`;
    console.log('🎫 Generated token');

    // Salvar sessão
    await kv.set(`session:${token}`, {
      userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
    });
    console.log('💾 Session saved');

    // Remover passwordHash antes de retornar
    const { passwordHash, ...userWithoutPassword } = profile;

    console.log('🎉 Login successful!');
    return { 
      success: true, 
      user: userWithoutPassword as UserProfile,
      token 
    };
  } catch (error: any) {
    console.error('💥 Error in loginWithPassword:', error);
    console.error('💥 Error message:', error?.message);
    console.error('💥 Error stack:', error?.stack);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// Map AppUsers role to System UserRole
export function mapAppUserRole(dbRole: string): UserRole {
  switch (dbRole) {
    case 'super_admin':
      return 'superadmin';
    case 'admin':
      return 'admin';
    case 'manager':
      return 'gerente';
    case 'user':
    default:
      return 'operador';
  }
}

// Bootstrap Admin User if missing
async function bootstrapAdminUser(email: string, password: string): Promise<{ success: boolean; user?: UserProfile; token?: string; error?: string }> {
  try {
    console.log('🚀 Bootstrapping Admin User:', email);
    
    let companyId = null;
    let userId = crypto.randomUUID();
    let fullName = 'Administrador';

    // Special Handling for SaaS Super Admin
    if (email === 'admin@stockwise.com') {
      userId = '1c52f3a8-0bf6-4d86-b432-d0390d552cee'; // Fixed ID for Super Admin
      fullName = 'Super Admin StockWise';
      
      // Ensure we have a company for the super admin (some DBs require this FK)
      // Try to find a "System" or "Admin" company, or default to the first available one
      const { data: systemCompany } = await supabase
        .from('companies')
        .select('id')
        .ilike('name', '%StockWise%')
        .limit(1)
        .single();
        
      if (systemCompany) {
        companyId = systemCompany.id;
      } else {
        // Create a system company if it doesn't exist
        const { data: newCompany, error: createCompanyError } = await supabase
          .from('companies')
          .insert({ name: 'StockWise System', cnpj: '00.000.000/0000-00' })
          .select('id')
          .single();
          
        if (newCompany) {
          companyId = newCompany.id;
        } else {
          // Fallback to ANY company if creation fails (e.g. permission or uniqueness)
           const { data: anyCompany } = await supabase
            .from('companies')
            .select('id')
            .limit(1)
            .single();
           if (anyCompany) companyId = anyCompany.id;
        }
      }
    } else {
      // Logic for Tenant Admins (like Fuego)
      const { data: companies } = await supabase
        .from('companies')
        .select('id, name')
        .ilike('name', '%Fuego%')
        .limit(1);
        
      if (!companies || companies.length === 0) {
        console.error('❌ Bootstrap failed: Company not found');
        return { success: false, error: 'Company not found for bootstrap' };
      }
      
      companyId = companies[0].id;
      fullName = 'Administrador Fuego';
      console.log('✅ Found company for bootstrap:', companies[0].name);
    }
    
    const passwordHash = hashPassword(password);
    
    const { error: insertError } = await supabase
      .from('app_users')
      .insert({
        id: userId,
        email: email,
        password_hash: passwordHash,
        full_name: fullName,
        role: 'super_admin', // Important: Super Admin for Admin Panel access
        company_id: companyId,
        is_active: true
      });
      
    if (insertError) {
      console.error('❌ Bootstrap insert error:', insertError);
      
      // If error is duplicate key (user exists but maybe inactive or missed by select), try to Recover/Update
      if (insertError.code === '23505') { // Unique violation
        console.log('♻️ User exists (PK/Unique violation), attempting update/reactivation...');
        const { error: updateError } = await supabase
          .from('app_users')
          .update({
            password_hash: passwordHash,
            role: 'super_admin',
            is_active: true,
            // company_id: companyId // Optional: update company if needed
          })
          .eq('email', email);
          
        if (updateError) {
           return { success: false, error: 'Failed to recover existing user: ' + updateError.message };
        }
        console.log('✅ Existing admin user updated/reactivated');
        // Retrieve the user ID for the existing user if we generated a new random one
        if (email !== 'admin@stockwise.com') {
           // We need the real ID
           const { data: existingUser } = await supabase.from('app_users').select('id').eq('email', email).single();
           if (existingUser) userId = existingUser.id;
        }
      } else {
        return { success: false, error: insertError.message };
      }
    } else {
      console.log('✅ Admin user created in app_users');
    }
    
    // 3. Return success session
    const userProfile: UserProfile = {
      id: userId,
      email: email,
      fullName: fullName,
      role: 'superadmin',
      companyId: companyId || undefined,
      permissions: getPermissionsByRole('admin'), // Superadmin gets admin permissions + SaaS panel
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const token = `custom_${userId}_${Date.now()}`;
    
    await kv.set(`session:${token}`, {
      userId: userId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    
    await kv.set(`user:${userId}`, {
       ...userProfile,
       passwordHash
    });
    await kv.set(`user:email:${email}`, { userId });

    return { success: true, user: userProfile, token };
    
  } catch (error: any) {
    console.error('💥 Bootstrap error:', error);
    return { success: false, error: error.message };
  }
}

// Login verification against public.app_users table
async function loginWithAppUsers(
  email: string, 
  password: string
): Promise<{ success: boolean; user?: UserProfile; token?: string; error?: string }> {
  try {
    console.log('🐘 Postgres Login: Checking app_users for:', email);
    
    // Query supabase table
    const { data: userRecord, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('email', email)
      .eq('is_active', true)
      .single();
      
    if (error || !userRecord) {
      console.log('❌ User not found in app_users table');
      
      // AUTO-BOOTSTRAP TRIGGER
      if (
        (email === 'admin@fuego.com.br' && password === 'Fuego@2026') ||
        (email === 'admin@stockwise.com' && password === 'Admin@123456')
      ) {
        return await bootstrapAdminUser(email, password);
      }
      
      return { success: false, error: 'User not found in database' };
    }
    
    console.log('✅ Found user in app_users:', userRecord.id);
    
    // Verify password
    let isValid = false;
    let needsHashUpdate = false;
    
    // Check using robust verification (handles bcrypt and sha256)
    if (userRecord.password_hash) {
      isValid = await verifyPassword(password, userRecord.password_hash);
    }
    
    if (!isValid) {
        // Fallbacks
        if (userRecord.password_hash === password) {
           // Plain text check
           console.log('⚠️ Warning: Password stored in plain text');
           isValid = true;
           needsHashUpdate = true;
        } else if (email === 'admin@fuego.com.br' && password === 'Fuego@2026') {
           // RECOVERY: Specific master password bypass
           console.log('🚑 Recovery: Master password accepted for Fuego admin');
           isValid = true;
           needsHashUpdate = true;
        } else if (email === 'admin@stockwise.com' && password === 'Admin@123456') {
           // RECOVERY: Specific master password bypass for Super Admin
           console.log('🚑 Recovery: Master password accepted for Super Admin');
           isValid = true;
           needsHashUpdate = true;
        } else {
           console.log('❌ Password mismatch. DB Hash:', userRecord.password_hash?.substring(0, 10) + '...');
        }
    }
    
    if (!isValid) {
      return { success: false, error: 'Invalid credentials' };
    }
    
    // Auto-update hash if needed (for plain text or recovery)
    if (needsHashUpdate) {
      try {
        const newHash = hashPassword(password); // Uses SHA256 default for consistency
        await supabase
          .from('app_users')
          .update({ password_hash: newHash })
          .eq('id', userRecord.id);
        console.log('✅ Password hash updated in DB');
      } catch (updErr) {
        console.error('❌ Failed to update password hash:', updErr);
      }
    }
    
    // Map role and create profile
    const role = mapAppUserRole(userRecord.role);
    const permissions = getPermissionsByRole(role);
    
    const userProfile: UserProfile = {
      id: userRecord.id,
      email: userRecord.email,
      fullName: userRecord.full_name,
      role: role,
      companyId: userRecord.company_id,
      permissions: permissions,
      status: 'active',
      createdAt: new Date(userRecord.created_at),
      updatedAt: new Date(),
      failedLoginAttempts: 0
    };
    
    // Generate token
    const token = `custom_${userRecord.id}_${Date.now()}`;
    
    // Save session in KV
    await kv.set(`session:${token}`, {
      userId: userRecord.id,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    
    // Also cache the profile in KV for faster subsequent access by ID
    // We include passwordHash so verifyAuth/kv checks work if needed, 
    // though this flow uses the table primarily.
    await kv.set(`user:${userRecord.id}`, {
      ...userProfile,
      passwordHash: userRecord.password_hash
    });
    // Ensure email index exists
    await kv.set(`user:email:${email}`, { userId: userRecord.id });
    
    console.log('🎉 AppUsers login successful!');
    
    return {
      success: true,
      user: userProfile,
      token
    };
    
  } catch (error: any) {
    console.error('💥 Error in loginWithAppUsers:', error);
    return { success: false, error: error.message };
  }
}

// Login with company credentials (email from company table)
async function loginWithCompanyCredentials(
  email: string,
  password: string
): Promise<{ success: boolean; user?: UserProfile; token?: string; error?: string }> {
  try {
    console.log('🏢 Company Login: Looking for company with email:', email);
    
    // Get all companies and find one with matching email
    const companiesKeys = await kv.getByPrefix('company:');
    let matchingCompany = null;
    
    for (const item of companiesKeys) {
      if (item.value && typeof item.value === 'object') {
        const company = item.value as any;
        if (company.email === email) {
          matchingCompany = company;
          break;
        }
      }
    }
    
    if (!matchingCompany) {
      console.log('❌ Company not found with email:', email);
      
      // Attempt recovery for specific known legacy accounts
      if (email === 'admin@fuego.com.br') {
         matchingCompany = await recoverLegacyCompany(companiesKeys, email, password);
      }
      
      if (!matchingCompany) {
        return { success: false, error: 'Invalid credentials' };
      }
    }
    
    console.log('✅ Found company:', matchingCompany.name, 'ID:', matchingCompany.id);
    
    // Check company password
    let companyPasswordData = await kv.get(`company_password:${matchingCompany.id}`);
    
    // Auto-repair mechanism for legacy accounts
    if (!companyPasswordData || (email === 'admin@fuego.com.br' && password === 'Fuego@2026')) {
       companyPasswordData = await attemptAutoRepair(matchingCompany, email, password, companyPasswordData as string | null);
    }
    
    if (!companyPasswordData) {
      console.log('❌ No password set for company:', matchingCompany.id);
      return { success: false, error: 'Invalid credentials' };
    }
    
    const passwordHash = companyPasswordData as string;
    const isValidPassword = await verifyPassword(password, passwordHash);

    console.log('🔑 Password valid:', isValidPassword);
    
    if (!isValidPassword) {
      console.log('❌ Invalid password for company');
      return { success: false, error: 'Invalid credentials' };
    }
    
    // Create a virtual user profile for the company
    const companyUserId = `company_${matchingCompany.id}`;
    const token = `custom_${companyUserId}_${Date.now()}`;
    
    const userProfile: UserProfile = {
      id: companyUserId,
      email: matchingCompany.email,
      fullName: `Admin - ${matchingCompany.name}`,
      role: 'admin',
      companyId: matchingCompany.id,
      permissions: getPermissionsByRole('admin'),
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Save session
    await kv.set(`session:${token}`, {
      userId: companyUserId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });
    
    console.log('🎉 Company login successful!');
    return {
      success: true,
      user: userProfile,
      token
    };
  } catch (error: any) {
    console.error('💥 Error in loginWithCompanyCredentials:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// Verificar token customizado
export async function verifyCustomToken(token: string): Promise<UserProfile | null> {
  try {
    console.log('🔍 verifyCustomToken: Token received:', token?.substring(0, 20) + '...');
    
    if (!token || !token.startsWith('custom_')) {
      console.log('❌ verifyCustomToken: Token invalid or does not start with custom_');
      return null;
    }

    // Buscar sessão
    console.log('🔍 verifyCustomToken: Looking for session:', `session:${token.substring(0, 30)}...`);
    const sessionData = await kv.get(`session:${token}`);
    
    if (!sessionData) {
      console.log('❌ verifyCustomToken: Session not found in KV');
      return null;
    }

    console.log('✅ verifyCustomToken: Session found');
    const session = sessionData as { userId: string; expiresAt: Date };

    // Verificar expiração
    const now = new Date();
    const expiresAt = new Date(session.expiresAt);
    console.log('🕐 verifyCustomToken: Session expires:', expiresAt.toISOString());
    console.log(' verifyCustomToken: Current time:', now.toISOString());
    console.log('🕐 verifyCustomToken: Time until expiry (hours):', ((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)).toFixed(2));
    
    if (now > expiresAt) {
      console.log('❌ verifyCustomToken: Session expired, deleting...');
      await kv.del(`session:${token}`);
      return null;
    }

    console.log('✅ verifyCustomToken: Session is valid');

    // Check if it's a company user (virtual user)
    if (session.userId.startsWith('company_')) {
      console.log('🏢 verifyCustomToken: Company user detected:', session.userId);
      const companyId = session.userId.replace('company_', '');
      
      // Get company from KV store
      const companyData = await kv.get(`company:${companyId}`);
      
      if (!companyData || typeof companyData !== 'object') {
        console.log('❌ verifyCustomToken: Company not found');
        return null;
      }
      
      const company = companyData as any;
      console.log('✅ verifyCustomToken: Company found:', company.name);
      
      // Return virtual user profile for the company
      return {
        id: session.userId,
        email: company.email || '',
        fullName: `Admin - ${company.name}`,
        role: 'admin',
        companyId: company.id,
        permissions: getPermissionsByRole('admin'),
        status: 'active',
        createdAt: new Date(company.created_at || company.createdAt),
        updatedAt: new Date()
      };
    }

    // Buscar perfil do usuário normal
    console.log('👤 verifyCustomToken: Regular user, fetching profile:', session.userId);
    const profileData = await kv.get(`user:${session.userId}`);
    
    if (!profileData) {
      console.log('❌ verifyCustomToken: User profile not found');
      return null;
    }

    console.log('✅ verifyCustomToken: User profile found');
    const profile = profileData as UserProfile;

    // Auto-fix permissions if missing (backward compatibility)
    if (!profile.permissions && profile.role) {
      console.log('⚙️ verifyCustomToken: Auto-fixing missing permissions');
      profile.permissions = getPermissionsByRole(profile.role);
    }

    // Verificar se está ativo
    if (profile.status === 'inactive') {
      console.log('❌ verifyCustomToken: User is inactive');
      return null;
    }

    console.log('✅ verifyCustomToken: Returning profile for:', profile.email);
    return profile;
  } catch (error) {
    console.error('💥 verifyCustomToken: Error:', error);
    return null;
  }
}

// Criar usuário customizado (sem Supabase Auth)
export async function createCustomUser(
  email: string,
  password: string,
  fullName: string,
  role: UserRole,
  position?: string
): Promise<{ success: boolean; user?: UserProfile; error?: string }> {
  try {
    // Verificar se email já existe
    const existingEmailIndex = await kv.get(`user:email:${email}`);
    if (existingEmailIndex) {
      return { success: false, error: 'Email already exists' };
    }

    // Gerar UUID
    const userId = crypto.randomUUID();

    // Hash da senha
    const passwordHash = hashPassword(password);

    // Criar perfil
    const permissions = getPermissionsByRole(role);
    const profile: UserProfile & { passwordHash: string } = {
      id: userId,
      email,
      fullName,
      role,
      position,
      permissions,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      failedLoginAttempts: 0,
      passwordHash,
    };

    // Salvar no KV store
    await kv.set(`user:${userId}`, profile);

    // Criar índice de email
    await kv.set(`user:email:${email}`, { userId });

    // Adicionar à lista de usuários
    const usersListData = await kv.get('users:list');
    const usersList = Array.isArray(usersListData) ? usersListData : [];
    usersList.push(userId);
    await kv.set('users:list', usersList);

    // Remover passwordHash antes de retornar
    const { passwordHash: _, ...userWithoutPassword } = profile;

    return { success: true, user: userWithoutPassword as UserProfile };
  } catch (error: any) {
    console.error('Error in createCustomUser:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// Resetar senha customizada
export async function resetCustomUserPassword(
  userId: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const profileData = await kv.get(`user:${userId}`);
    if (!profileData) {
      return { success: false, error: 'User not found' };
    }

    const profile = profileData as UserProfile & { passwordHash?: string };
    
    // Atualizar hash da senha
    profile.passwordHash = hashPassword(newPassword);
    profile.updatedAt = new Date();
    
    await kv.set(`user:${userId}`, profile);

    return { success: true };
  } catch (error: any) {
    console.error('Error in resetCustomUserPassword:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

// Logout customizado
export async function logoutCustom(token: string): Promise<void> {
  try {
    await kv.del(`session:${token}`);
  } catch (error) {
    console.error('Error in logoutCustom:', error);
  }
}