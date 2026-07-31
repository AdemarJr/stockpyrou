import React, { createContext, useContext, useState, useEffect } from 'react';
import type { AuthUser, UserProfile, UserRole } from '../types';
import { toast } from 'sonner@2.0.3';
import { getBackendApiRoot } from '../lib/backendUrl';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { safeStorage } from '../utils/safeStorage';
import { resolveUserPermissions } from '../utils/permissions';

function toAuthUser(raw: Record<string, unknown>, accessToken: string): AuthUser {
  const role = (String(raw.role || 'operador') as UserRole) || 'operador';
  return {
    id: String(raw.id),
    email: String(raw.email || ''),
    fullName: String(raw.fullName || raw.full_name || ''),
    role,
    companyId: raw.companyId != null ? String(raw.companyId) : undefined,
    permissions: resolveUserPermissions(role, raw.permissions as AuthUser['permissions']),
    accessToken,
  };
}

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

const CUSTOM_TOKEN_KEY = 'pyroustock_custom_token';
const AUTH_EVENT_KEY = 'pyroustock_auth_event';

function authApiRoot(): string {
  return getBackendApiRoot();
}

function getCustomToken(): string | null {
  return safeStorage.getItem(CUSTOM_TOKEN_KEY);
}

function setCustomToken(token: string): void {
  safeStorage.setItem(CUSTOM_TOKEN_KEY, token);
}

function removeCustomToken(): void {
  safeStorage.removeItem(CUSTOM_TOKEN_KEY);
}

function broadcastAuthEvent(type: 'login' | 'logout'): void {
  // Cross-browser: storage event + BroadcastChannel when available.
  // The storage event won't fire in the same tab, but we don't need it there.
  try {
    safeStorage.setItem(
      AUTH_EVENT_KEY,
      JSON.stringify({ type, at: Date.now() })
    );
  } catch {
    // ignore
  }

  try {
    if ('BroadcastChannel' in window) {
      const ch = new BroadcastChannel(AUTH_EVENT_KEY);
      ch.postMessage({ type, at: Date.now() });
      ch.close();
    }
  } catch {
    // ignore
  }
}

/** Mensagens do servidor em inglês → português para o usuário */
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
    const customToken = getCustomToken();

    if (customToken) {
      console.log('🔍 Found custom token, verifying...');
      void (async () => {
        const res = await fetchWithTimeout(`${authApiRoot()}/auth/me`, {
          headers: { Authorization: `Bearer ${customToken}`, 'X-Custom-Token': customToken },
          timeoutMs: 15000
        });
        if (!res?.ok) {
          console.log('❌ /auth/me failed or timeout, clearing custom token');
          removeCustomToken();
          setUser(null);
          setLoading(false);
          return;
        }
        try {
          const data = await res.json();
          console.log('📊 /auth/me response data:', { hasUser: !!data.user, error: data.error });
          if (data.user) {
            setUser(toAuthUser(data.user as Record<string, unknown>, customToken));
          } else {
            removeCustomToken();
            setUser(null);
          }
        } catch (err) {
          console.error('❌ Error parsing /auth/me:', err);
          removeCustomToken();
          setUser(null);
        } finally {
          setLoading(false);
        }
      })();
    } else {
      console.log('🔍 No custom token — tela de login');
      setLoading(false);
    }

    /** Outra aba fez logout: limpar token local */
    const applyCrossTabLogout = () => {
      removeCustomToken();
      setUser(null);
    };

    // Cross-tab auth sync (logout/login in another tab)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== AUTH_EVENT_KEY || !e.newValue) return;
      try {
        const payload = JSON.parse(e.newValue) as { type?: string };
        if (payload.type === 'logout') {
          applyCrossTabLogout();
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', onStorage);

    let bc: BroadcastChannel | null = null;
    try {
      if ('BroadcastChannel' in window) {
        bc = new BroadcastChannel(AUTH_EVENT_KEY);
        bc.onmessage = (ev) => {
          const msg = ev?.data as { type?: string } | undefined;
          if (msg?.type === 'logout') {
            applyCrossTabLogout();
          }
        };
      }
    } catch {
      bc = null;
    }

    return () => {
      try {
        window.removeEventListener('storage', onStorage);
      } catch {
        // ignore
      }
      try {
        bc?.close();
      } catch {
        // ignore
      }
    };
  }, []);

  // Login: sempre via API própria (stockpyrou-api).
  async function login(email: string, password: string): Promise<boolean> {
    try {
      return await loginCustom(email, password);
    } catch (error: unknown) {
      console.error('Login error:', error);
      toast.error(formatLoginErrorMessage(error));
      return false;
    }
  }

  async function loginCustom(email: string, password: string): Promise<boolean> {
    // First, ensure system is initialized (creates admin if doesn't exist)
    if (email === 'admin@stockwise.com') {
      console.log('Admin login detected, ensuring system is initialized...');
      try {
        const initResponse = await fetch(`${authApiRoot()}/auth/init`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
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
    console.log('🔐 Auth API:', authApiRoot());

    const response = await fetchWithTimeout(`${authApiRoot()}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password }),
      timeoutMs: 25000
    });

    if (!response) {
      // Distingue API morta vs API viva com banco inacessível (login depende do Postgres).
      try {
        const health = await fetchWithTimeout(`${authApiRoot()}/health`, { timeoutMs: 5000 });
        if (health?.ok) {
          throw new Error(
            'API no ar, mas o banco (EasyPanel) não responde a partir do Railway. Confira DATABASE_URL e o firewall/porta 5432.',
          );
        }
      } catch (e) {
        if (e instanceof Error && /banco|EasyPanel|DATABASE_URL/i.test(e.message)) throw e;
      }
      throw new Error(
        'API fora do ar (Railway). Confira https://stockpyrou-api-production.up.railway.app/api/health',
      );
    }

    if (response.status === 404) {
      throw new Error(
        'API não encontrada no Railway (Application not found). Verifique o deploy e o domínio público.',
      );
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
      setCustomToken(serverData.token);
      setUser(toAuthUser(serverData.user as Record<string, unknown>, serverData.token));
      broadcastAuthEvent('login');
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
      removeCustomToken();
      setUser(null);
      broadcastAuthEvent('logout');
      toast.success('Logout realizado com sucesso');
    } catch (error) {
      console.error('Logout error:', error);
      // Even if there's an error, clear the state
      removeCustomToken();
      setUser(null);
      broadcastAuthEvent('logout');
      toast.error('Erro ao fazer logout');
    }
  }

  // Refresh user data
  async function refreshUser() {
    const token = getCustomToken();
    if (!token) return;
    try {
      const res = await fetchWithTimeout(`${authApiRoot()}/auth/me`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Custom-Token': token },
        timeoutMs: 15000
      });
      if (!res?.ok) return;
      const data = await res.json();
      if (data.user) {
        setUser(toAuthUser(data.user as Record<string, unknown>, token));
      }
    } catch (err) {
      console.error('Error refreshing user:', err);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
