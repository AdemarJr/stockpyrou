import { apiClient } from '../lib/apiClient';
import type { Supplier } from '../types';

interface SupplierDto {
  id: string;
  companyId: string;
  name: string;
  contact?: string;
  email?: string;
  phone?: string;
  rating?: number;
  reliability?: number;
  createdAt: string;
  updatedAt: string;
}

function mapDto(dto: SupplierDto): Supplier {
  return {
    ...dto,
    contact: dto.contact ?? '',
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

export class SupplierApi {
  static async findAll(companyId: string): Promise<Supplier[]> {
    const data = await apiClient.get<{ suppliers: SupplierDto[] }>('/suppliers', companyId);
    return (data.suppliers ?? []).map(mapDto);
  }

  static async findById(id: string, companyId?: string): Promise<Supplier | null> {
    try {
      const data = await apiClient.get<{ supplier: SupplierDto }>(`/suppliers/${id}`, companyId);
      return data.supplier ? mapDto(data.supplier) : null;
    } catch {
      return null;
    }
  }

  static async create(
    supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>,
    companyId: string,
  ): Promise<Supplier> {
    const data = await apiClient.post<{ supplier: SupplierDto }>(
      '/suppliers',
      supplier,
      companyId,
    );
    return mapDto(data.supplier);
  }

  static async update(id: string, updates: Partial<Supplier>, companyId?: string): Promise<Supplier> {
    const data = await apiClient.put<{ supplier: SupplierDto }>(
      `/suppliers/${id}`,
      updates,
      companyId,
    );
    return mapDto(data.supplier);
  }

  static async delete(id: string, companyId?: string): Promise<void> {
    await apiClient.delete(`/suppliers/${id}`, companyId);
  }
}
