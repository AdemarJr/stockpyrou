import { supabase } from '../utils/supabase/client';
import type { StockEntry, StockMovement } from '../types';

/**
 * Repository Pattern: Abstração para acesso a dados de estoque
 */
export class StockRepository {
  static async findAllEntries(companyId: string): Promise<StockEntry[]> {
    const { data, error } = await supabase
      .from('stock_entries')
      .select('*')
      .eq('company_id', companyId)
      .order('entry_date', { ascending: false });

    if (error) {
      console.error('Error fetching stock entries:', error);
      throw error;
    }

    return (data || []).map(item => ({
      id: item.id,
      companyId: item.company_id,
      productId: item.product_id,
      supplierId: item.supplier_id,
      quantity: item.quantity,
      unitPrice: item.unit_cost,
      totalPrice: item.total_cost,
      batchNumber: item.batch_number,
      expirationDate: item.expiry_date ? new Date(item.expiry_date) : undefined,
      notes: item.notes || undefined,
      entryDate: new Date(item.entry_date),
      userId: item.created_by || undefined,
    }));
  }

  static async createEntry(entry: Omit<StockEntry, 'id' | 'entryDate' | 'userId'>): Promise<StockEntry> {
    const { data, error } = await supabase
      .from('stock_entries')
      .insert({
        company_id: entry.companyId,
        product_id: entry.productId,
        supplier_id: entry.supplierId,
        quantity: entry.quantity,
        unit_cost: entry.unitPrice,
        total_cost: entry.totalPrice,
        batch_number: entry.batchNumber,
        expiry_date: entry.expirationDate ? entry.expirationDate.toISOString().split('T')[0] : null,
        notes: entry.notes || null,
        entry_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating stock entry:', error);
      throw error;
    }

    return {
      id: data.id,
      companyId: data.company_id,
      productId: data.product_id,
      supplierId: data.supplier_id,
      quantity: data.quantity,
      unitPrice: data.unit_cost,
      totalPrice: data.total_cost,
      batchNumber: data.batch_number,
      expirationDate: data.expiry_date ? new Date(data.expiry_date) : undefined,
      notes: data.notes || undefined,
      entryDate: new Date(data.entry_date),
      userId: undefined,
    };
  }

  static async findById(id: string): Promise<StockEntry | null> {
    const { data, error } = await supabase
      .from('stock_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching stock entry:', error);
      return null;
    }

    return {
      id: data.id,
      companyId: data.company_id,
      productId: data.product_id,
      supplierId: data.supplier_id,
      quantity: data.quantity,
      unitPrice: data.unit_cost,
      totalPrice: data.total_cost,
      batchNumber: data.batch_number,
      expirationDate: data.expiry_date ? new Date(data.expiry_date) : undefined,
      notes: data.notes || undefined,
      entryDate: new Date(data.entry_date),
      userId: data.created_by || undefined,
    };
  }

  static async deleteEntry(id: string): Promise<void> {
    const { error } = await supabase
      .from('stock_entries')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting stock entry:', error);
      throw error;
    }
  }

  static async updateEntry(id: string, updates: Partial<StockEntry>): Promise<StockEntry> {
    const dbUpdates: any = {};
    if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
    if (updates.unitPrice !== undefined) dbUpdates.unit_cost = updates.unitPrice;
    if (updates.totalPrice !== undefined) dbUpdates.total_cost = updates.totalPrice;
    if (updates.batchNumber !== undefined) dbUpdates.batch_number = updates.batchNumber;
    if (updates.expirationDate !== undefined) dbUpdates.expiry_date = updates.expirationDate.toISOString().split('T')[0];
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.supplierId !== undefined) dbUpdates.supplier_id = updates.supplierId;
    // Não permitimos alterar company_id, product_id ou entry_date via update simples por segurança

    const { data, error } = await supabase
      .from('stock_entries')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating stock entry:', error);
      throw error;
    }

    return {
      id: data.id,
      companyId: data.company_id,
      productId: data.product_id,
      supplierId: data.supplier_id,
      quantity: data.quantity,
      unitPrice: data.unit_cost,
      totalPrice: data.total_cost,
      batchNumber: data.batch_number,
      expirationDate: data.expiry_date ? new Date(data.expiry_date) : undefined,
      notes: data.notes || undefined,
      entryDate: new Date(data.entry_date),
      userId: data.created_by || undefined,
    };
  }

  static async findAllMovements(companyId: string): Promise<StockMovement[]> {
    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('company_id', companyId)
      .order('movement_date', { ascending: false });

    if (error) {
      console.error('Error fetching stock movements:', error);
      throw error;
    }

    return (data || []).map(item => ({
      id: item.id,
      companyId: item.company_id,
      productId: item.product_id,
      type: item.movement_type,
      quantity: item.quantity,
      reason: item.notes || '',
      wasteReason: undefined,
      cost: item.total_value || item.unit_cost || undefined,
      batchNumber: undefined,
      date: new Date(item.movement_date),
      userId: item.created_by || undefined,
      notes: item.notes || undefined,
    }));
  }

  static async createMovement(movement: Omit<StockMovement, 'id' | 'date'> & { userId?: string }): Promise<StockMovement> {
    const unitCost = movement.quantity > 0 && movement.cost 
      ? movement.cost / movement.quantity 
      : (movement.cost || 0);
      
    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
        company_id: movement.companyId,
        product_id: movement.productId,
        movement_type: movement.type,
        quantity: movement.quantity,
        unit_cost: unitCost,
        total_value: movement.cost || null,
        reference_id: null,
        movement_date: new Date().toISOString(),
        notes: movement.notes || movement.reason || null,
        created_by: movement.userId || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating stock movement:', error);
      throw error;
    }

    return {
      id: data.id,
      companyId: data.company_id,
      productId: data.product_id,
      type: data.movement_type,
      quantity: data.quantity,
      reason: data.notes || '',
      wasteReason: undefined,
      cost: data.total_value || data.unit_cost || undefined,
      batchNumber: undefined,
      date: new Date(data.movement_date),
      userId: data.created_by || undefined,
      notes: data.notes || undefined,
    };
  }
}
