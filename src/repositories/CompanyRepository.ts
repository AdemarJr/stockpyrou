import { supabase } from '../utils/supabase/client';
import type { Company, UserCompany } from '../types';
import { projectId } from '../utils/supabase/info';

export class CompanyRepository {
  private static readonly TABLE = 'companies';
  private static readonly RELATION_TABLE = 'user_companies';

  /**
   * Busca TODAS as empresas (apenas para superadmin)
   * Usa endpoint backend que bypassa RLS com Service Role Key
   */
  static async findAll(): Promise<Company[]> {
    console.log('[CompanyRepository.findAll] 👑 Fetching ALL companies for superadmin...');
    
    try {
      // Primeiro tenta token customizado do localStorage (mais comum para superadmin)
      let token = localStorage.getItem('pyroustock_custom_token');
      
      // Fallback: tenta sessão Supabase
      if (!token) {
        const { data: { session } } = await supabase.auth.getSession();
        token = session?.access_token || null;
      }
      
      if (!token) {
        console.error('[CompanyRepository.findAll] ❌ No authentication token found');
        return [];
      }

      console.log('[CompanyRepository.findAll] 🔑 Using token type:', token.startsWith('custom_') ? 'Custom Token' : 'Supabase JWT');

      const url = `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/superadmin/companies`;
      console.log('[CompanyRepository.findAll] 🌐 Calling:', url);

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Custom-Token': token,
          'Content-Type': 'application/json'
        }
      });

      console.log('[CompanyRepository.findAll] 📡 Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[CompanyRepository.findAll] ❌ Backend error:', errorText);
        throw new Error(`Failed to fetch companies: ${response.status} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log('[CompanyRepository.findAll] 📦 Response data:', responseData);

      const { companies } = responseData;
      console.log(`[CompanyRepository.findAll] ✅ Found ${companies?.length || 0} companies`);

      return (companies || []).map((item: any) => ({
        id: item.id,
        name: item.name,
        cnpj: item.cnpj,
        createdAt: new Date(item.created_at || item.createdAt),
        status: item.status || 'active',
      }));
    } catch (error) {
      console.error('[CompanyRepository.findAll] ❌ Error:', error);
      throw error;
    }
  }

  /**
   * Busca todas as empresas que o usuário tem acesso
   */
  static async findByUser(userId: string): Promise<Company[]> {
    // Primeiro busca os IDs das empresas na tabela de relação
    const { data: userCompanies, error: relationError } = await supabase
      .from(this.RELATION_TABLE)
      .select('company_id')
      .eq('user_id', userId);

    if (relationError) {
      console.error('Error fetching user companies:', relationError);
      throw relationError;
    }

    if (!userCompanies || userCompanies.length === 0) {
      return [];
    }

    const companyIds = userCompanies.map(uc => uc.company_id);

    // Depois busca os dados das empresas
    const { data, error } = await supabase
      .from(this.TABLE)
      .select('*')
      .in('id', companyIds)
      .order('name');

    if (error) {
      console.error('Error fetching companies:', error);
      throw error;
    }

    return (data || []).map(item => ({
      id: item.id,
      name: item.name,
      cnpj: item.cnpj,
      createdAt: new Date(item.created_at),
    }));
  }

  /**
   * Cria uma nova empresa e vincula ao criador como admin
   */
  static async create(name: string, userId: string, cnpj?: string): Promise<Company> {
    // 1. Criar a empresa
    const { data: company, error: createError } = await supabase
      .from(this.TABLE)
      .insert({
        name,
        cnpj,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating company:', createError);
      throw createError;
    }

    // 2. Vincular usuário como admin
    const { error: linkError } = await supabase
      .from(this.RELATION_TABLE)
      .insert({
        user_id: userId,
        company_id: company.id,
        role: 'admin'
      });

    if (linkError) {
      console.error('Error linking user to company:', linkError);
      // Rollback manual: Tenta apagar a empresa criada já que o vínculo falhou
      await supabase.from(this.TABLE).delete().eq('id', company.id);
      throw linkError;
    }

    return {
      id: company.id,
      name: company.name,
      cnpj: company.cnpj,
      createdAt: new Date(company.created_at),
    };
  }

  /**
   * Busca dados de uma empresa específica
   */
  static async findById(id: string): Promise<Company | null> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching company:', error);
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      cnpj: data.cnpj,
      createdAt: new Date(data.created_at),
    };
  }
}