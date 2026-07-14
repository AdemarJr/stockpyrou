import { apiClient } from '../lib/apiClient';
import type { StockEntry, StockMovement } from '../types';

interface StockEntryDto {
  id: string;
  companyId: string;
  productId: string;
  supplierId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  batchNumber?: string;
  expirationDate?: string;
  notes?: string;
  entryDate: string;
  userId?: string;
}

interface MovementDto {
  id: string;
  companyId: string;
  productId: string;
  type: string;
  quantity: number;
  reason: string;
  cost?: number;
  batchNumber?: string;
  date: string;
  userId?: string;
  notes?: string;
}

function mapEntry(dto: StockEntryDto): StockEntry {
  return {
    ...dto,
    expirationDate: dto.expirationDate ? new Date(dto.expirationDate) : undefined,
    entryDate: new Date(dto.entryDate),
    userId: dto.userId ?? '',
  };
}

function mapMovement(dto: MovementDto): StockMovement {
  return {
    id: dto.id,
    companyId: dto.companyId,
    productId: dto.productId,
    type: dto.type as StockMovement['type'],
    quantity: dto.quantity,
    reason: dto.reason,
    cost: dto.cost,
    batchNumber: dto.batchNumber,
    date: new Date(dto.date),
    userId: dto.userId ?? '',
    notes: dto.notes,
  };
}

export class StockApi {
  static async findAllEntries(companyId: string): Promise<StockEntry[]> {
    const data = await apiClient.get<{ entries: StockEntryDto[] }>('/stock/entries', companyId);
    return (data.entries ?? []).map(mapEntry);
  }

  static async findById(id: string, companyId?: string): Promise<StockEntry | null> {
    try {
      const data = await apiClient.get<{ entry: StockEntryDto }>(`/stock/entries/${id}`, companyId);
      return data.entry ? mapEntry(data.entry) : null;
    } catch {
      return null;
    }
  }

  static async createEntry(
    entry: Omit<StockEntry, 'id' | 'entryDate' | 'userId'>,
  ): Promise<StockEntry> {
    const data = await apiClient.post<{ entry: StockEntryDto }>(
      '/stock/entries',
      {
        productId: entry.productId,
        supplierId: entry.supplierId,
        quantity: entry.quantity,
        unitPrice: entry.unitPrice,
        totalPrice: entry.totalPrice,
        batchNumber: entry.batchNumber,
        expirationDate: entry.expirationDate?.toISOString(),
        notes: entry.notes,
      },
      entry.companyId,
    );
    return mapEntry(data.entry);
  }

  static async updateEntry(id: string, updates: Partial<StockEntry>): Promise<StockEntry> {
    const data = await apiClient.put<{ entry: StockEntryDto }>(
      `/stock/entries/${id}`,
      {
        quantity: updates.quantity,
        unitPrice: updates.unitPrice,
        totalPrice: updates.totalPrice,
        batchNumber: updates.batchNumber,
        expirationDate: updates.expirationDate?.toISOString(),
        notes: updates.notes,
        supplierId: updates.supplierId,
      },
      updates.companyId,
    );
    return mapEntry(data.entry);
  }

  static async deleteEntry(id: string, companyId?: string): Promise<void> {
    await apiClient.delete(`/stock/entries/${id}`, companyId);
  }

  static async findAllMovements(companyId: string): Promise<StockMovement[]> {
    const data = await apiClient.get<{ movements: MovementDto[] }>('/stock/movements', companyId);
    return (data.movements ?? []).map(mapMovement);
  }

  static async findMovementById(id: string, companyId?: string): Promise<StockMovement | null> {
    try {
      const data = await apiClient.get<{ movement: MovementDto }>(
        `/stock/movements/${id}`,
        companyId,
      );
      return data.movement ? mapMovement(data.movement) : null;
    } catch {
      return null;
    }
  }

  static async deductStockOnce(params: {
    companyId: string;
    productId: string;
    quantity: number;
    source: string;
    notes?: string;
    movementType: 'venda' | 'saida' | 'desperdicio';
    movementDate?: string;
  }) {
    return apiClient.post<{
      applied: boolean;
      movementId: string | null;
      newStock: number;
    }>('/stock/deduct', params, params.companyId);
  }

  static async createMovement(
    movement: Omit<StockMovement, 'id' | 'date'> & { userId?: string },
  ): Promise<StockMovement> {
    const data = await apiClient.post<{ movement: MovementDto }>(
      '/stock/movements',
      {
        productId: movement.productId,
        type: movement.type,
        quantity: movement.quantity,
        reason: movement.reason,
        notes: movement.notes,
        cost: movement.cost,
        userId: movement.userId,
      },
      movement.companyId,
    );
    return mapMovement(data.movement);
  }
}
