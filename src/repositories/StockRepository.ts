import { useOwnApi } from '../lib/apiConfig';
import { supabase } from '../utils/supabase/client';
import type { StockEntry, StockMovement } from '../types';
import { StockApi } from './stockApi';

/**
 * Repository Pattern: Abstração para acesso a dados de estoque
 */
const MOVEMENTS_PAGE_SIZE = 1000;

export class StockRepository {
  /** PostgREST limita ~1000 linhas por request; pagina para não “cortar” o histórico recente. */
  private static async fetchAllRows<T>(
    table: string,
    companyId: string,
    orderColumn: string,
  ): Promise<T[]> {
    const rows: T[] = [];
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('company_id', companyId)
        .order(orderColumn, { ascending: false, nullsFirst: false })
        .range(offset, offset + MOVEMENTS_PAGE_SIZE - 1);

      if (error) {
        console.error(`Error fetching ${table}:`, error);
        throw error;
      }

      const batch = (data ?? []) as T[];
      rows.push(...batch);
      if (batch.length < MOVEMENTS_PAGE_SIZE) break;
      offset += MOVEMENTS_PAGE_SIZE;
    }
    return rows;
  }

  private static mapMovementRow(item: Record<string, unknown>): StockMovement {
    const qty = Number(item.quantity) || 0;
    const unitCost = Number(item.unit_cost) || 0;
    const totalValRaw = item.total_value;
    const totalVal =
      totalValRaw != null && totalValRaw !== ''
        ? Number(totalValRaw)
        : NaN;
    const lineCost =
      Number.isFinite(totalVal) && totalVal > 0 ? totalVal : qty * unitCost;

    const rawDate = item.movement_date ?? item.date ?? item.created_at;
    const parsedDate = rawDate ? new Date(String(rawDate)) : new Date(NaN);
    const typeRaw = String(item.movement_type ?? item.type ?? 'ajuste').toLowerCase().trim();

    return {
      id: String(item.id),
      companyId: String(item.company_id),
      productId: String(item.product_id),
      type: typeRaw as StockMovement['type'],
      quantity: qty,
      reason: String(item.reason ?? item.notes ?? ''),
      wasteReason: undefined,
      cost: lineCost > 0 ? lineCost : undefined,
      batchNumber: item.batch_number != null ? String(item.batch_number) : undefined,
      date: parsedDate,
      userId: item.created_by != null ? String(item.created_by) : item.user_id != null ? String(item.user_id) : undefined,
      notes: item.notes != null ? String(item.notes) : undefined,
    };
  }

  static async findAllEntries(companyId: string): Promise<StockEntry[]> {
    if (useOwnApi()) return StockApi.findAllEntries(companyId);

    const data = await this.fetchAllRows<Record<string, unknown>>(
      'stock_entries',
      companyId,
      'entry_date',
    );

    return data.map(item => ({
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
    if (useOwnApi()) return StockApi.createEntry(entry);

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
    if (useOwnApi()) return StockApi.findById(id);

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
    if (useOwnApi()) {
      await StockApi.deleteEntry(id);
      return;
    }

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
    if (useOwnApi()) return StockApi.updateEntry(id, updates);

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
    if (useOwnApi()) return StockApi.findAllMovements(companyId);

    const data = await this.fetchAllRows<Record<string, unknown>>(
      'stock_movements',
      companyId,
      'movement_date',
    );
    return data.map((item) => this.mapMovementRow(item));
  }

  static async findMovementById(id: string): Promise<StockMovement | null> {
    if (useOwnApi()) return StockApi.findMovementById(id);

    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      if (error) console.error('Error fetching stock movement:', error);
      return null;
    }
    return this.mapMovementRow(data as Record<string, unknown>);
  }

  /**
   * Baixa atômica: atualiza `products.current_stock` e insere `stock_movements` na mesma transação (RPC).
   * Usar em vendas, baixa manual (saida/desperdicio) e PDV — evita movimento sem baixa ou baixa sem movimento.
   */
  static async deductStockOnce(params: {
    companyId: string;
    productId: string;
    quantity: number;
    source: string;
    notes?: string;
    movementType: 'venda' | 'saida' | 'desperdicio';
    movementDate?: string;
  }): Promise<{ applied: boolean; movementId: string | null; newStock: number }> {
    if (useOwnApi()) return StockApi.deductStockOnce(params);

    const { data, error } = await supabase.rpc('deduct_stock_once', {
      p_company_id: params.companyId,
      p_product_id: params.productId,
      p_qty: params.quantity,
      p_source: params.source,
      p_notes: params.notes ?? null,
      p_movement_type: params.movementType,
      p_movement_date: params.movementDate ?? new Date().toISOString(),
    });

    if (error) {
      console.error('Error in deduct_stock_once:', error);
      throw error;
    }

    const row = (Array.isArray(data) ? data[0] : data) as
      | { applied?: boolean; movement_id?: string; new_stock?: number | string }
      | null
      | undefined;

    return {
      applied: row?.applied === true,
      movementId: row?.movement_id ?? null,
      newStock: Number(row?.new_stock ?? NaN) || 0,
    };
  }

  static async createMovement(movement: Omit<StockMovement, 'id' | 'date'> & { userId?: string }): Promise<StockMovement> {
    if (useOwnApi()) return StockApi.createMovement(movement);

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
