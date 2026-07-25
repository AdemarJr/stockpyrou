import type { StockEntry, StockMovement } from '../types';
import { StockApi } from './stockApi';

/**
 * Repository Pattern: Abstração para acesso a dados de estoque
 */
export class StockRepository {
  static async findAllEntries(companyId: string): Promise<StockEntry[]> {
    return StockApi.findAllEntries(companyId);
  }

  static async createEntry(entry: Omit<StockEntry, 'id' | 'entryDate' | 'userId'>): Promise<StockEntry> {
    return StockApi.createEntry(entry);
  }

  static async findById(id: string): Promise<StockEntry | null> {
    return StockApi.findById(id);
  }

  static async deleteEntry(id: string): Promise<void> {
    await StockApi.deleteEntry(id);
  }

  static async updateEntry(id: string, updates: Partial<StockEntry>): Promise<StockEntry> {
    return StockApi.updateEntry(id, updates);
  }

  static async findAllMovements(companyId: string): Promise<StockMovement[]> {
    return StockApi.findAllMovements(companyId);
  }

  static async findMovementById(id: string): Promise<StockMovement | null> {
    return StockApi.findMovementById(id);
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
    return StockApi.deductStockOnce(params);
  }

  static async createMovement(movement: Omit<StockMovement, 'id' | 'date'> & { userId?: string }): Promise<StockMovement> {
    return StockApi.createMovement(movement);
  }
}
