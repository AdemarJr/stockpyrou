import { apiClient } from '../lib/apiClient';
import type { Product } from '../types';

interface ProductDto {
  id: string;
  companyId: string;
  name: string;
  category: Product['category'];
  isPerishable: boolean;
  measurementUnit: Product['measurementUnit'];
  minStock: number;
  safetyStock: number;
  currentStock: number;
  averageCost: number;
  supplierId?: string;
  shelfLife?: number;
  bundleItems?: Product['bundleItems'];
  barcode?: string;
  sellingPrice?: number;
  image?: string;
  ncm?: string;
  cfop?: string;
  csosn?: string;
  cst?: string;
  origem?: string;
  createdAt: string;
  updatedAt: string;
}

function mapDtoToProduct(dto: ProductDto): Product {
  return {
    ...dto,
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
  };
}

function mapProductToDto(
  product: Partial<Product>,
): Record<string, unknown> {
  return {
    name: product.name,
    category: product.category,
    measurementUnit: product.measurementUnit,
    minStock: product.minStock,
    safetyStock: product.safetyStock,
    currentStock: product.currentStock,
    averageCost: product.averageCost,
    sellingPrice: product.sellingPrice,
    supplierId: product.supplierId,
    barcode: product.barcode,
    shelfLife: product.shelfLife,
    bundleItems: product.bundleItems,
    image: product.image,
    ncm: product.ncm,
    cfop: product.cfop,
    csosn: product.csosn,
    cst: product.cst,
    origem: product.origem,
  };
}

export class ProductApi {
  static async findAll(companyId: string): Promise<Product[]> {
    const data = await apiClient.get<{ products: ProductDto[] }>(
      '/products',
      companyId,
    );
    return (data.products ?? []).map(mapDtoToProduct);
  }

  static async findById(id: string, companyId?: string): Promise<Product | null> {
    try {
      const data = await apiClient.get<{ product: ProductDto }>(
        `/products/${id}`,
        companyId,
      );
      return data.product ? mapDtoToProduct(data.product) : null;
    } catch {
      return null;
    }
  }

  static async create(
    product: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>,
    companyId: string,
  ): Promise<Product> {
    const data = await apiClient.post<{ product: ProductDto }>(
      '/products',
      mapProductToDto(product as Partial<Product>),
      companyId,
    );
    return mapDtoToProduct(data.product);
  }

  static async update(id: string, updates: Partial<Product>, companyId?: string): Promise<Product> {
    const data = await apiClient.put<{ product: ProductDto }>(
      `/products/${id}`,
      mapProductToDto(updates),
      companyId,
    );
    return mapDtoToProduct(data.product);
  }

  static async updateStock(
    id: string,
    quantityToAdd: number,
    newAverageCost?: number,
    companyId?: string,
  ): Promise<void> {
    await apiClient.patch(
      `/products/${id}/stock`,
      { quantityToAdd, newAverageCost },
      companyId,
    );
  }

  static async delete(id: string, companyId?: string): Promise<void> {
    await apiClient.delete(`/products/${id}`, companyId);
  }
}
