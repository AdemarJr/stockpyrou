import { ProductRepository } from '../repositories/ProductRepository';
import type { Product } from '../types';

/**
 * Service Pattern: Lógica de negócio para produtos
 * Coordena operações e aplica regras de negócio
 */
export class ProductService {
  /**
   * Busca todos os produtos de uma empresa
   */
  static async getAllProducts(companyId: string): Promise<Product[]> {
    return ProductRepository.findAll(companyId);
  }

  /**
   * Cria um novo produto com validações
   */
  static async createProduct(
    product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>,
    companyId: string
  ): Promise<Product> {
    // Validações de negócio
    this.validateProduct(product);
    
    return ProductRepository.create(product, companyId);
  }

  /**
   * Atualiza um produto existente
   */
  static async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    if (updates.name || updates.minStock !== undefined) {
      this.validateProduct(updates as any);
    }
    
    return ProductRepository.update(id, updates);
  }

  /**
   * Deleta um produto
   */
  static async deleteProduct(id: string): Promise<void> {
    // Aqui poderia adicionar lógica para verificar se o produto
    // está sendo usado em receitas antes de deletar
    return ProductRepository.delete(id);
  }

  /**
   * Atualiza o estoque de um produto
   */
  static async updateStock(
    productId: string, 
    quantity: number, 
    newAverageCost?: number
  ): Promise<Product> {
    const product = await ProductRepository.findById(productId);
    
    if (!product) {
      throw new Error('Produto não encontrado');
    }

    const updates: Partial<Product> = {
      currentStock: product.currentStock + quantity,
    };

    if (newAverageCost !== undefined) {
      updates.averageCost = newAverageCost;
    }

    return ProductRepository.update(productId, updates);
  }

  /**
   * Calcula custo médio ponderado
   */
  static calculateWeightedAverageCost(
    currentStock: number,
    currentCost: number,
    newQuantity: number,
    newCost: number
  ): number {
    const totalCost = (currentStock * currentCost) + (newQuantity * newCost);
    const totalQuantity = currentStock + newQuantity;
    
    return totalQuantity > 0 ? totalCost / totalQuantity : newCost;
  }

  /**
   * Validações de produto
   */
  private static validateProduct(product: Partial<Product>): void {
    if (product.name && product.name.trim().length === 0) {
      throw new Error('Nome do produto é obrigatório');
    }

    if (product.minStock !== undefined && product.minStock < 0) {
      throw new Error('Estoque mínimo não pode ser negativo');
    }

    // Estoque pode ficar negativo (baixa antes da entrada / integrações).

    if (product.averageCost !== undefined && product.averageCost < 0) {
      throw new Error('Custo médio não pode ser negativo');
    }
  }
}
