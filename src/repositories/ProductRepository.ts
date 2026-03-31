import { supabase } from '../utils/supabase/client';
import type { Product } from '../types';

/**
 * Repository Pattern: Abstração para acesso a dados de produtos
 * Centraliza todas as operações de banco de dados relacionadas a produtos
 */
export class ProductRepository {
  private static readonly TABLE = 'products';

  /**
   * Busca todos os produtos ordenados por nome para uma empresa específica
   */
  /** Soma (estoque atual × custo médio) por produto — visão financeira do inventário. */
  static async sumInventoryValue(companyId: string): Promise<number> {
    const products = await this.findAll(companyId);
    return products.reduce((sum, p) => sum + (p.currentStock || 0) * (p.averageCost || 0), 0);
  }

  static async findAll(companyId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select('*')
      .eq('company_id', companyId)
      .order('name');

    if (error) {
      console.error('Error fetching products:', error);
      throw error;
    }

    return (data || []).map(this.mapToEntity);
  }

  /**
   * Busca um produto por ID
   */
  static async findById(id: string): Promise<Product | null> {
    const { data, error } = await supabase
      .from(this.TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching product:', error);
      return null;
    }

    return this.mapToEntity(data);
  }

  /**
   * Cria um novo produto
   */
  static async create(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>, companyId: string): Promise<Product> {
    const dbData = this.mapToDatabase(product);
    dbData.company_id = companyId;

    const { data, error } = await supabase
      .from(this.TABLE)
      .insert(dbData)
      .select()
      .single();

    if (error) {
      console.error('Error creating product:', error);
      throw error;
    }

    return this.mapToEntity(data);
  }

  /**
   * Atualiza um produto existente
   */
  static async update(id: string, updates: Partial<Product>): Promise<Product> {
    const updateData: any = {};
    
    if (updates.name) updateData.name = updates.name;
    if (updates.category) updateData.category = updates.category;
    if (updates.measurementUnit) updateData.unit = updates.measurementUnit;
    if (updates.minStock !== undefined) updateData.min_stock = updates.minStock;
    // if (updates.safetyStock !== undefined) updateData.safety_stock = updates.safetyStock;
    if (updates.currentStock !== undefined) updateData.current_stock = updates.currentStock;
    if (updates.averageCost !== undefined) updateData.cost_price = updates.averageCost;
    if (updates.sellingPrice !== undefined) updateData.sale_price = updates.sellingPrice;
    if (updates.supplierId !== undefined) updateData.supplier_id = updates.supplierId || null;
    if (updates.barcode !== undefined) updateData.barcode = updates.barcode || null;
    if (updates.shelfLife !== undefined) {
      updateData.description = JSON.stringify({ shelfLife: updates.shelfLife });
    }
    if (updates.image !== undefined) updateData.image_url = updates.image || null;

    const { data, error } = await supabase
      .from(this.TABLE)
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating product:', error);
      throw error;
    }

    return this.mapToEntity(data);
  }

  /**
   * Atualiza apenas o estoque e custo do produto
   */
  static async updateStock(id: string, quantityToAdd: number, newAverageCost?: number): Promise<void> {
    // Primeiro busca o produto atual para calcular
    const product = await this.findById(id);
    if (!product) throw new Error('Product not found');

    const newStock = product.currentStock + quantityToAdd;
    
    const updateData: any = {
      current_stock: newStock
    };

    if (newAverageCost !== undefined) {
      updateData.cost_price = newAverageCost;
    }

    const { error } = await supabase
      .from(this.TABLE)
      .update(updateData)
      .eq('id', id);

    if (error) {
      console.error('Error updating product stock:', error);
      throw error;
    }
  }

  /**
   * Deleta um produto
   */
  static async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.TABLE)
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  /**
   * Mapeia dados do banco para entidade do domínio
   */
  private static mapToEntity(data: any): Product {
    return {
      id: data.id,
      companyId: data.company_id,
      name: data.name,
      category: data.category,
      isPerishable: false, // Default fallback
      measurementUnit: data.unit,
      minStock: data.min_stock || 0,
      safetyStock: data.safety_stock || data.min_stock || 0, // Fallback to min_stock if safety is missing
      currentStock: data.current_stock || 0,
      averageCost: data.cost_price || 0,
      supplierId: data.supplier_id || undefined,
      shelfLife: data.description ? tryParseDescription(data.description)?.shelfLife : undefined,
      barcode: data.barcode || undefined,
      sellingPrice: data.sale_price || 0,
      image: data.image_url || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at || data.created_at),
    };
  }

  /**
   * Mapeia entidade do domínio para dados do banco
   */
  private static mapToDatabase(product: Partial<Product>): any {
    return {
      name: product.name,
      category: product.category || null,
      unit: product.measurementUnit,
      min_stock: product.minStock || 0,
      // safety_stock: product.safetyStock || 0,
      current_stock: product.currentStock || 0,
      cost_price: product.averageCost || 0,
      sale_price: product.sellingPrice || 0,
      supplier_id: product.supplierId || null,
      barcode: product.barcode || null,
      description: product.shelfLife ? JSON.stringify({ shelfLife: product.shelfLife }) : null,
      image_url: product.image || null,
      status: 'active',
    };
  }
}

// Helper to parse description safely
function tryParseDescription(desc: string): any {
  try {
    if (desc && desc.startsWith('{')) {
      return JSON.parse(desc);
    }
  } catch (e) {
    return null;
  }
  return null;
}
