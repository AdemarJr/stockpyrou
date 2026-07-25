import type { Product } from '../types';
import { ProductApi } from './productApi';

/**
 * Repository Pattern: Abstração para acesso a dados de produtos
 * Centraliza todas as operações de banco de dados relacionadas a produtos
 */
export class ProductRepository {
  /** Soma (estoque atual × custo médio) por produto — visão financeira do inventário. */
  static async sumInventoryValue(companyId: string): Promise<number> {
    const products = await this.findAll(companyId);
    return products.reduce((sum, p) => sum + (p.currentStock || 0) * (p.averageCost || 0), 0);
  }

  /**
   * Busca todos os produtos ordenados por nome para uma empresa específica
   */
  static async findAll(companyId: string): Promise<Product[]> {
    return ProductApi.findAll(companyId);
  }

  /**
   * Busca um produto por ID
   */
  static async findById(id: string): Promise<Product | null> {
    return ProductApi.findById(id);
  }

  /**
   * Cria um novo produto
   */
  static async create(product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>, companyId: string): Promise<Product> {
    return ProductApi.create(product, companyId);
  }

  /**
   * Atualiza um produto existente
   */
  static async update(id: string, updates: Partial<Product>): Promise<Product> {
    return ProductApi.update(id, updates);
  }

  /**
   * Atualiza apenas o estoque e custo do produto
   */
  static async updateStock(id: string, quantityToAdd: number, newAverageCost?: number): Promise<void> {
    await ProductApi.updateStock(id, quantityToAdd, newAverageCost);
  }

  /**
   * Deleta um produto
   */
  static async delete(id: string): Promise<void> {
    await ProductApi.delete(id);
  }
}
