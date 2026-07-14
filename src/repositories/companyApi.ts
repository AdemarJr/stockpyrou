import { apiClient } from '../lib/apiClient';
import type { Company } from '../types';

interface CompanyDto {
  id: string;
  name: string;
  cnpj?: string;
  status?: string;
  createdAt: string;
}

function mapDto(dto: CompanyDto): Company {
  return {
    id: dto.id,
    name: dto.name,
    cnpj: dto.cnpj,
    status: (dto.status as Company['status']) ?? 'active',
    createdAt: new Date(dto.createdAt),
  };
}

export class CompanyApi {
  static async findAll(): Promise<Company[]> {
    const data = await apiClient.get<{ companies: CompanyDto[] }>('/companies/superadmin/all');
    return (data.companies ?? []).map(mapDto);
  }

  static async findByUser(userId: string): Promise<Company[]> {
    const data = await apiClient.get<{ companies: CompanyDto[] }>(`/companies/user/${userId}`);
    return (data.companies ?? []).map(mapDto);
  }

  static async findById(id: string): Promise<Company | null> {
    try {
      const data = await apiClient.get<{ company: CompanyDto }>(`/companies/${id}`);
      return data.company ? mapDto(data.company) : null;
    } catch {
      return null;
    }
  }

  static async create(name: string, userId: string, cnpj?: string): Promise<Company> {
    const data = await apiClient.post<{ company: CompanyDto }>('/companies', { name, cnpj });
    return mapDto(data.company);
  }
}
