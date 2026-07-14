import { apiClient } from '../lib/apiClient';
import type { PriceHistory } from '../types';

interface PriceHistoryDto {
  id: string;
  companyId: string;
  productId: string;
  supplierId: string;
  price: number;
  quantity: number;
  date: string;
  supplierName?: string;
}

function mapDto(dto: PriceHistoryDto): PriceHistory {
  return {
    id: dto.id,
    companyId: dto.companyId,
    productId: dto.productId,
    supplierId: dto.supplierId,
    price: dto.price,
    quantity: dto.quantity,
    date: new Date(dto.date),
    supplierName: dto.supplierName,
  };
}

export class PriceHistoryApi {
  static async findAll(companyId?: string): Promise<PriceHistory[]> {
    const data = await apiClient.get<{ history: PriceHistoryDto[] }>(
      '/price-history',
      companyId,
    );
    return (data.history ?? []).map(mapDto);
  }

  static async findByProduct(productId: string, companyId?: string): Promise<PriceHistory[]> {
    const data = await apiClient.get<{ history: PriceHistoryDto[] }>(
      `/price-history/product/${productId}`,
      companyId,
    );
    return (data.history ?? []).map(mapDto);
  }

  static async getBestPriceForProduct(
    productId: string,
    companyId?: string,
  ): Promise<PriceHistory | null> {
    try {
      const data = await apiClient.get<{ best: PriceHistoryDto | null }>(
        `/price-history/product/${productId}/best`,
        companyId,
      );
      return data.best ? mapDto(data.best) : null;
    } catch {
      return null;
    }
  }

  static async create(
    priceHistory: Omit<PriceHistory, 'id' | 'date'>,
  ): Promise<PriceHistory> {
    const data = await apiClient.post<{ history: PriceHistoryDto }>(
      '/price-history',
      {
        productId: priceHistory.productId,
        supplierId: priceHistory.supplierId,
        price: priceHistory.price,
      },
      priceHistory.companyId,
    );
    return mapDto(data.history);
  }
}
