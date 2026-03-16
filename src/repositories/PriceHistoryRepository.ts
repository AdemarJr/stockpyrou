import { supabase } from '../utils/supabase/client';
import type { PriceHistory } from '../types';

/**
 * Repository Pattern: Abstração para acesso a dados de histórico de preços
 */
export class PriceHistoryRepository {
  private static readonly TABLE = 'price_history';

  static async findAll(companyId?: string): Promise<PriceHistory[]> {
    let query = supabase
      .from(this.TABLE)
      .select(`
        *,
        suppliers (
          name
        )
      `)
      .order('effective_date', { ascending: false });

    if (companyId) {
      query = query.eq('company_id', companyId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching price history:', error);
      throw error;
    }

    return (data || []).map(this.mapToEntity);
  }

  static async findByProduct(productId: string): Promise<PriceHistory[]> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select('*')
      .eq('product_id', productId)
      .order('effective_date', { ascending: false });

    if (error) {
      console.error('Error fetching product price history:', error);
      throw error;
    }

    return (data || []).map(this.mapToEntity);
  }

  static async getBestPriceForProduct(productId: string): Promise<PriceHistory | null> {
    // Busca o menor preço nos últimos 6 meses
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data, error } = await supabase
      .from(this.TABLE)
      .select('*')
      .eq('product_id', productId)
      .gte('effective_date', sixMonthsAgo.toISOString())
      .order('price', { ascending: true })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      console.error('Error fetching best price:', error);
      return null;
    }

    return this.mapToEntity(data);
  }

  static async create(priceHistory: Omit<PriceHistory, 'id' | 'date'>): Promise<PriceHistory> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .insert({
        company_id: priceHistory.companyId,
        product_id: priceHistory.productId,
        supplier_id: priceHistory.supplierId,
        price: priceHistory.price,
        price_type: 'cost',
        effective_date: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating price history:', error);
      throw error;
    }

    return this.mapToEntity(data);
  }

  private static mapToEntity(data: any): PriceHistory {
    return {
      id: data.id,
      companyId: data.company_id,
      productId: data.product_id,
      supplierId: data.supplier_id,
      price: data.price,
      quantity: 0,
      date: new Date(data.effective_date || data.created_at),
      invoiceNumber: undefined,
      // Se houver join com fornecedor
      supplierName: data.suppliers?.name
    };
  }
}
