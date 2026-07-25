import type { PriceHistory } from '../types';
import { PriceHistoryApi } from './priceHistoryApi';

/**
 * Repository Pattern: Abstração para acesso a dados de histórico de preços
 */
export class PriceHistoryRepository {
  static async findAll(companyId?: string): Promise<PriceHistory[]> {
    return PriceHistoryApi.findAll(companyId);
  }

  static async findByProduct(productId: string): Promise<PriceHistory[]> {
    return PriceHistoryApi.findByProduct(productId);
  }

  static async getBestPriceForProduct(productId: string): Promise<PriceHistory | null> {
    return PriceHistoryApi.getBestPriceForProduct(productId);
  }

  static async create(priceHistory: Omit<PriceHistory, 'id' | 'date'>): Promise<PriceHistory> {
    return PriceHistoryApi.create(priceHistory);
  }
}
