import type { Supplier } from '../types';
import { SupplierApi } from './supplierApi';

/**
 * Repository Pattern: Abstração para acesso a dados de fornecedores
 */
export class SupplierRepository {
  static async findAll(companyId: string): Promise<Supplier[]> {
    return SupplierApi.findAll(companyId);
  }

  static async create(supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>, companyId: string): Promise<Supplier> {
    return SupplierApi.create(supplier, companyId);
  }

  static async findById(id: string): Promise<Supplier | null> {
    return SupplierApi.findById(id);
  }

  static async update(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    return SupplierApi.update(id, updates);
  }

  static async delete(id: string): Promise<void> {
    await SupplierApi.delete(id);
  }
}
