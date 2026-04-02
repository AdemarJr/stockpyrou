import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Company } from '../types';
import { CompanyRepository } from '../repositories/CompanyRepository';
import { useAuth } from './AuthContext';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../utils/supabase/info';
import { fetchCompanyStatusJson, fetchWithTimeout } from '../utils/fetchWithTimeout';

interface CompanyContextType {
  currentCompany: Company | null;
  companies: Company[];
  isLoading: boolean;
  selectCompany: (companyId: string) => Promise<boolean>;
  refreshCompanies: () => Promise<void>;
  createCompany: (name: string, cnpj?: string) => Promise<void>;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [currentCompany, setCurrentCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshCompanies = async () => {
    if (!user) {
      setCompanies([]);
      setCurrentCompany(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      console.log('[CompanyContext] 🔄 refreshCompanies called for user:', { 
        id: user.id, 
        role: user.role, 
        email: user.email 
      });
      
      // Superadmin pode ver TODAS as empresas
      let data: Company[] = [];
      if (user.role === 'superadmin') {
        console.log('[CompanyContext] 👑 SUPERADMIN detected - loading ALL companies...');
        try {
          data = await CompanyRepository.findAll();
          console.log(`[CompanyContext] ✅ Loaded ${data.length} companies for superadmin`);
        } catch (error) {
          console.error('[CompanyContext] ❌ Error loading companies for superadmin:', error);
          toast.error(`Erro ao carregar empresas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          data = [];
        }
      } else {
        console.log('[CompanyContext] 👤 Regular user - loading user companies...');
        data = await CompanyRepository.findByUser(user.id);
        console.log(`[CompanyContext] ✅ Loaded ${data.length} companies for user`);
      }
      
      // Fallback: Se o usuário tem companyId mas não retornou empresas (caso de login por credencial da empresa ou Custom Auth)
      // Tenta buscar via API do servidor (bypassing Supabase RLS que falha com token customizado)
      if (data.length === 0 && user.companyId && user.role !== 'superadmin') {
        console.log('[CompanyContext] No companies found via Supabase, trying Server API fallback...');
        try {
          // Usa o token do AuthContext ou localStorage
          const token = user.accessToken || localStorage.getItem('pyroustock_custom_token');
          
          if (token) {
            const response = await fetchWithTimeout(
              `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/companies/me`,
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'X-Custom-Token': token
                },
                timeoutMs: 12000
              }
            );

            if (response?.ok) {
              const { company } = await response.json();
              if (company) {
                console.log('[CompanyContext] Found company via Server API:', company.name);
                data = [{
                  id: company.id,
                  name: company.name,
                  cnpj: company.cnpj,
                  createdAt: new Date(company.createdAt),
                  status: company.status
                }];
              }
            } else {
              console.warn('[CompanyContext] Server API fallback failed:', response?.status ?? 'no response');
            }
          }
        } catch (serverError) {
          console.error('[CompanyContext] Server API fallback error:', serverError);
        }
      }

      setCompanies(data);
      
      // Auto-selection logic based on User Metadata
      if (user.companyId && user.role !== 'superadmin') {
        const userCompany = data.find(c => c.id === user.companyId);
        if (userCompany) {
          const statusJson = await fetchCompanyStatusJson(projectId, user.companyId);
          const status = statusJson?.status;
          if (status === 'inactive') {
            toast.error('Empresa desativada. Selecione outra empresa ou contate o suporte.');
          } else if (status === 'active' || statusJson == null) {
            // null = timeout/erro na API: libera uso para não travar a tela inicial
            // Mantém a mesma referência se já for a mesma empresa (evita refresh do App e perda de formulários ao renovar token)
            setCurrentCompany((prev) =>
              prev?.id === userCompany.id ? prev : userCompany
            );
            localStorage.setItem('stockwise_last_company_id', user.companyId);
            return;
          }
        }
      }

      // Fallback to last saved or default
      if (currentCompany) {
        const stillHasAccess = data.find(c => c.id === currentCompany.id);
        if (!stillHasAccess) {
          setCurrentCompany(null);
        }
      } else if (data.length > 0) {
        const savedCompanyId = localStorage.getItem('stockwise_last_company_id');
        if (savedCompanyId) {
          const savedCompany = data.find(c => c.id === savedCompanyId);
          if (savedCompany) {
            const statusJson = await fetchCompanyStatusJson(projectId, savedCompanyId);
            const status = statusJson?.status;
            if (status === 'inactive') {
              localStorage.removeItem('stockwise_last_company_id');
            } else if (status === 'active' || statusJson == null) {
              setCurrentCompany((prev) =>
                prev?.id === savedCompany.id ? prev : savedCompany
              );
            }
          }
        }
      }
    } catch (error) {
      console.error('Error loading companies:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Depender só de identidade estável: TOKEN_REFRESHED recria o objeto `user` e não deve re-disparar refresh
  useEffect(() => {
    refreshCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- evita loop ao renovar sessão (novo objeto user, mesmos dados)
  }, [user?.id, user?.role, user?.companyId]);

  const selectCompany = async (companyId: string): Promise<boolean> => {
    if (!companyId) {
      setCurrentCompany(null);
      localStorage.removeItem('stockwise_last_company_id');
      return true;
    }
    
    try {
      const statusJson = await fetchCompanyStatusJson(projectId, companyId);
      const status = statusJson?.status;

      if (status === 'inactive') {
        toast.error('Acesso bloqueado: Esta empresa está desativada no sistema. Entre em contato com o suporte.');
        return false;
      }

      const company = companies.find(c => c.id === companyId);
      if (company) {
        setCurrentCompany(company);
        localStorage.setItem('stockwise_last_company_id', companyId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking company status:', error);
      return false;
    }
  };

  const createCompany = async (name: string, cnpj?: string) => {
    if (!user) return;
    try {
      const newCompany = await CompanyRepository.create(name, user.id, cnpj);
      await refreshCompanies();
      selectCompany(newCompany.id);
    } catch (error) {
      console.error('Error creating company:', error);
      throw error;
    }
  };

  return (
    <CompanyContext.Provider value={{
      currentCompany,
      companies,
      isLoading,
      selectCompany,
      refreshCompanies,
      createCompany
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
}