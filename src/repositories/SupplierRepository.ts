import { supabase } from '../utils/supabase/client';
import type { Supplier } from '../types';

/**
 * Repository Pattern: Abstração para acesso a dados de fornecedores
 */
export class SupplierRepository {
  private static readonly TABLE = 'suppliers';

  static async findAll(companyId: string): Promise<Supplier[]> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    if (error) {
      console.error('Error fetching suppliers:', error);
      throw error;
    }

    return (data || []).map(this.mapToEntity);
  }

  static async create(supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>, companyId: string): Promise<Supplier> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .insert({
        company_id: companyId,
        name: supplier.name,
        contact: supplier.contact || null,
        email: supplier.email || null,
        phone: supplier.phone || null,
        rating: supplier.rating || null,
        reliability: supplier.reliability || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating supplier:', error);
      throw error;
    }

    return this.mapToEntity(data);
  }

  static async findById(id: string): Promise<Supplier | null> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching supplier:', error);
      return null;
    }

    return this.mapToEntity(data);
  }

  static async update(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.contact !== undefined) updateData.contact = updates.contact;
    if (updates.email !== undefined) updateData.email = updates.email || null;
    if (updates.phone !== undefined) updateData.phone = updates.phone || null;
    if (updates.rating !== undefined) updateData.rating = updates.rating;
    if (updates.reliability !== undefined) updateData.reliability = updates.reliability;

    const { data, error } = await supabase
      .from(this.TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating supplier:', error);
      throw error;
    }

    return this.mapToEntity(data);
  }

  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting supplier:', error);
      throw error;
    }
  }

  private static mapToEntity(data: any): Supplier {
    return {
      id: data.id,
      companyId: data.company_id,
      name: data.name,
      contact: data.contact || undefined,
      email: data.email || undefined,
      phone: data.phone || undefined,
      rating: data.rating || undefined,
      reliability: data.reliability || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at || data.created_at),
    };
  }
}
