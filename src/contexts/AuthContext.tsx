import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabase/client';
import type { AuthUser, UserProfile } from '../types';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../utils/supabase/env';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

const API_URL = `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d`;

/** Mensagens do Supabase/servidor em inglês → português para o usuário */
function formatLoginErrorMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const t = raw.trim();
  if (!t) return 'Não foi possível entrar. Tente novamente.';

  const lower = t.toLowerCase();
  if (
    t === 'Invalid credentials' ||
    lower === 'invalid login credentials' ||
    (lower.includes('invalid') && lower.includes('credential'))
  ) {
    return 'E-mail ou senha incorretos. Verifique os dados ou solicite uma nova senha ao administrador.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar.';
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde um minuto e tente novamente.';
  }
  return t;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from backend (KV Store) for extra permissions if needed
  async function fetchUserProfile(userId: string): Promise<Partial<UserProfile> | null> {
    try {
      // Tenta buscar perfil estendido no KV store se existir
      return null; 
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  useEffect(() => {
    // 1. Check for Custom Token first
    const customToken = localStorage.getItem('pyroustock_custom_token');
    
    async function checkSupabaseSession() {
      try {
        // Check active session with error handling
        const { data: { session }, error } = await supabase.auth.getSession();
        
        // If there's a refresh token error, clear the session
        if (error) {
          console.log('Session error, clearing auth state:', error.message);
          await supabase.auth.signOut();
          localStorage.clear();
          setUser(null);
          setLoading(false);
          return;
        }
        
        if (session?.user) {
          const metadata = session.user.user_metadata || {};
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            fullName: metadata.name || metadata.full_name || 'Usuário',
            role: metadata.role || 'admin',
            companyId: metadata.company_id,
            permissions: {
              canViewDashboard: true,
              canManageProducts: true,
              canDeleteProducts: true,
              canManageStock: true,
              canManageRecipes: true,
              canViewReports: true,
              canManageUsers: true,
              canManageSettings: true
            },
            accessToken: session.access_token,
          });
        }
      } catch (err) {
        console.error('Error checking session:', err);
        // Clear any corrupted auth state
        await supabase.auth.signOut();
        localStorage.clear();
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    if (customToken) {
      console.log('🔍 Found custom token, verifying...');
      void (async () => {
        const res = await fetchWithTimeout(`${API_URL}/auth/me`, {
          headers: { 'Authorization': `Bearer ${customToken}`, 'X-Custom-Token': customToken },
          timeoutMs: 15000
        });
        if (!res?.ok) {
          console.log('❌ /auth/me failed or timeout, clearing custom token');
          localStorage.removeItem('pyroustock_custom_token');
          await checkSupabaseSession();
          return;
        }
        try {
          const data = await res.json();
          console.log('📊 /auth/me response data:', { hasUser: !!data.user, error: data.error });
          if (data.user) {
            setUser({
              ...data.user,
              accessToken: customToken
            });
            setLoading(false);
          } else {
            localStorage.removeItem('pyroustock_custom_token');
            await checkSupabaseSession();
          }
        } catch (err) {
          console.error('❌ Error parsing /auth/me:', err);
          localStorage.removeItem('pyroustock_custom_token');
          await checkSupabaseSession();
        }
      })();
    } else {
      console.log('🔍 No custom token, checking Supabase session');
      void checkSupabaseSession();
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      console.log('🔔 Auth state changed:', _event, 'Has session:', !!session);
      
      // Don't clear user if we have a custom token active
      const hasCustomToken = !!localStorage.getItem('pyroustock_custom_token');
      console.log('🎫 Has custom token:', hasCustomToken);
      
      // Handle sign out event only
      if (_event === 'SIGNED_OUT') {
        console.log('👋 SIGNED_OUT event');
        if (!hasCustomToken) {
          console.log('❌ No custom token, clearing user');
          setUser(null);
        } else {
          console.log('✅ Custom token exists, keeping user logged in');
        }
        return;
      }
      
      // Handle token refresh - don't clear user
      if (_event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed');
        if (session?.user) {
          console.log('✅ Updating user from refreshed session');
          const metadata = session.user.user_metadata || {};
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            fullName: metadata.name || metadata.full_name || 'Usuário',
            role: metadata.role || 'admin',
            companyId: metadata.company_id,
            permissions: {
              canViewDashboard: true,
              canManageProducts: true,
              canDeleteProducts: true,
              canManageStock: true,
              canManageRecipes: true,
              canViewReports: true,
              canManageUsers: true,
              canManageSettings: true
            },
            accessToken: session.access_token,
          });
        }
        return;
      }
      
      // Update user if session exists (SIGNED_IN, INITIAL_SESSION, etc)
      if (session?.user && !hasCustomToken) {
        console.log('✅ Updating user from Supabase session');
        const metadata = session.user.user_metadata || {};
         setUser({
          id: session.user.id,
          email: session.user.email || '',
          fullName: metadata.name || metadata.full_name || 'Usuário',
          role: metadata.role || 'admin',
          companyId: metadata.company_id,
          permissions: {
            canViewDashboard: true,
            canManageProducts: true,
            canDeleteProducts: true,
            canManageStock: true,
            canManageRecipes: true,
            canViewReports: true,
            canManageUsers: true,
            canManageSettings: true
          },
          accessToken: session.access_token,
        });
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Login function with Fallback to Custom Server Auth
  async function login(email: string, password: string): Promise<boolean> {
    try {
      setLoading(true);
      
      // Special handling for Super Admin - Skip Supabase Auth and go straight to custom
      // This avoids Rate Limits and errors when using the master account
      if (email === 'admin@stockwise.com') {
        console.log('⚡ Super Admin login detected - Skipping Supabase Auth...');
        return await loginCustom(email, password);
      }
      
      // Try Supabase Auth First
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.user) {
        const metadata = data.user.user_metadata || {};
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          fullName: metadata.name || metadata.full_name || 'Usuário',
          role: metadata.role || 'admin',
          companyId: metadata.company_id,
          permissions: {
            canViewDashboard: true,
            canManageProducts: true,
            canDeleteProducts: true,
            canManageStock: true,
            canManageRecipes: true,
            canViewReports: true,
            canManageUsers: true,
            canManageSettings: true
          },
          accessToken: data.session?.access_token || '',
        });
        toast.success(`Bem-vindo, ${metadata.name || metadata.full_name || 'Usuário'}!`);
        return true;
      }

      // If Supabase fails, try Custom Server Auth
      console.log('Supabase login failed, trying custom server auth...');
      return await loginCustom(email, password);

    } catch (error: unknown) {
      console.error('Login error:', error);
      toast.error(formatLoginErrorMessage(error));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function loginCustom(email: string, password: string): Promise<boolean> {
    // First, ensure system is initialized (creates admin if doesn't exist)
    if (email === 'admin@stockwise.com') {
      console.log('Admin login detected, ensuring system is initialized...');
      try {
        const initResponse = await fetch(`${API_URL}/auth/init`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          }
        });
        const initData = await initResponse.json();
        console.log('System init result:', initData);
      } catch (initError) {
        console.error('Init error (non-fatal):', initError);
      }
    }
    
    console.log('🔐 Attempting custom login for:', email);
    console.log('🔐 Password length:', password?.length);
    
    const response = await fetchWithTimeout(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${publicAnonKey}`
      },
      body: JSON.stringify({ email, password }),
      timeoutMs: 25000
    });

    if (!response) {
      throw new Error('Servidor não respondeu a tempo. Verifique sua internet e tente novamente.');
    }

    let serverData: {
      user?: AuthUser;
      token?: string;
      error?: string;
    } = {};
    try {
      serverData = await response.json();
    } catch {
      throw new Error('Resposta inválida do servidor. Tente novamente em instantes.');
    }

    console.log('Server response:', {
      ok: response.ok,
      status: response.status,
      hasUser: !!serverData.user,
      hasToken: !!serverData.token,
      error: serverData.error
    });

    if (response.ok && serverData.user && serverData.token) {
      localStorage.setItem('pyroustock_custom_token', serverData.token);
      setUser({
        ...serverData.user,
        accessToken: serverData.token
      });
      toast.success(`Bem-vindo, ${serverData.user.fullName}!`);
      return true;
    }

    const serverErr = serverData.error || `Erro HTTP ${response.status}`;
    console.error('Login failed:', serverErr);
    throw new Error(formatLoginErrorMessage(new Error(serverErr)));
  }

  // Logout function
  async function logout() {
    try {
      // Clear custom token first
      localStorage.removeItem('pyroustock_custom_token');
      
      // Sign out from Supabase (won't throw error if no session)
      await supabase.auth.signOut({ scope: 'local' });
      
      // Clear all localStorage related to auth
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      setUser(null);
      toast.success('Logout realizado com sucesso');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, clear the state
      localStorage.removeItem('pyroustock_custom_token');
      setUser(null);
      toast.error('Erro ao fazer logout');
    }
  }

  // Refresh user data
  async function refreshUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      // Atualizar estado se necessário
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}