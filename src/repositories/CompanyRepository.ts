import type { Company } from '../types';
import { CompanyApi } from './companyApi';

export class CompanyRepository {
  /**
   * Busca TODAS as empresas (apenas para superadmin)
   */
  static async findAll(): Promise<Company[]> {
    return CompanyApi.findAll();
  }

  /**
   * Busca todas as empresas que o usuário tem acesso
   */
  static async findByUser(userId: string): Promise<Company[]> {
    return CompanyApi.findByUser(userId);
  }

  /**
   * Cria uma nova empresa e vincula ao criador como admin
   */
  static async create(name: string, userId: string, cnpj?: string): Promise<Company> {
    return CompanyApi.create(name, userId, cnpj);
  }

  /**
   * Busca dados de uma empresa específica
   */
  static async findById(id: string): Promise<Company | null> {
    return CompanyApi.findById(id);
  }
}
