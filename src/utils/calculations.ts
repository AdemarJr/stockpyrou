// Calculation utilities for StockWise Pro

import type { Product, PriceHistory, StockEntry, StockMovement, Recipe, RecipeIngredient } from '../types';

// Calculate Weighted Average Cost (Custo Médio Ponderado)
export function calculateWeightedAverageCost(
  currentStock: number,
  currentAvgCost: number,
  newQuantity: number,
  newUnitPrice: number
): number {
  if (currentStock + newQuantity === 0) return 0;
  
  const currentValue = currentStock * currentAvgCost;
  const newValue = newQuantity * newUnitPrice;
  const totalValue = currentValue + newValue;
  const totalQuantity = currentStock + newQuantity;
  
  return totalValue / totalQuantity;
}

// Calculate profit margin
export function calculateProfitMargin(sellingPrice: number, cost: number): number {
  if (sellingPrice === 0) return 0;
  return ((sellingPrice - cost) / sellingPrice) * 100;
}

// Calculate markup
export function calculateMarkup(sellingPrice: number, cost: number): number {
  if (cost === 0) return 0;
  return ((sellingPrice - cost) / cost) * 100;
}

// Calculate price from markup
export function calculatePriceFromMarkup(cost: number, markup: number): number {
  return cost * (1 + markup / 100);
}

// Calculate recipe total cost
export function calculateRecipeCost(
  ingredients: RecipeIngredient[],
  products: Product[]
): number {
  return ingredients.reduce((total, ingredient) => {
    const product = products.find(p => p.id === ingredient.productId);
    if (!product) return total;
    
    // Convert to base unit and calculate cost
    const costPerUnit = product.averageCost;
    const ingredientCost = costPerUnit * ingredient.quantity;
    
    return total + ingredientCost;
  }, 0);
}

// Get days until expiration
export function getDaysUntilExpiration(expirationDate: Date): number {
  const now = new Date();
  const expDate = new Date(expirationDate);
  const diffTime = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// Get expiration alert severity
export function getExpirationSeverity(daysUntilExpiration: number): 'low' | 'medium' | 'high' {
  if (daysUntilExpiration < 7) return 'high';
  if (daysUntilExpiration < 30) return 'medium';
  return 'low';
}

// Get expiration alert color
export function getExpirationColor(daysUntilExpiration: number): string {
  if (daysUntilExpiration < 7) return 'red';
  if (daysUntilExpiration < 30) return 'yellow';
  return 'green';
}

// Calculate stock status
export function getStockStatus(
  currentStock: number,
  minStock: number,
  safetyStock: number
): 'critical' | 'low' | 'adequate' | 'high' {
  if (currentStock <= minStock) return 'critical';
  if (currentStock <= safetyStock) return 'low';
  if (currentStock > safetyStock * 2) return 'high';
  return 'adequate';
}

// Calculate suggested order quantity
export function calculateSuggestedOrder(
  currentStock: number,
  minStock: number,
  safetyStock: number,
  averageConsumption: number,
  leadTimeDays: number = 7
): number {
  const consumptionDuringLead = averageConsumption * leadTimeDays;
  const targetStock = safetyStock + consumptionDuringLead;
  const orderQuantity = Math.max(0, targetStock - currentStock);
  
  return Math.ceil(orderQuantity);
}

// Calculate average consumption (based on movements)
export function calculateAverageConsumption(
  movements: StockMovement[],
  days: number = 30
): number {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const relevantMovements = movements.filter(
    m => m.type === 'saida' && new Date(m.date) >= cutoffDate
  );
  
  const totalConsumed = relevantMovements.reduce((sum, m) => sum + m.quantity, 0);
  return totalConsumed / days;
}

// Detect price variation
export function detectPriceVariation(
  priceHistory: PriceHistory[],
  currentPrice: number,
  thresholdPercentage: number = 10
): { hasVariation: boolean; percentage: number; trend: 'up' | 'down' | 'stable' } {
  if (priceHistory.length === 0) {
    return { hasVariation: false, percentage: 0, trend: 'stable' };
  }
  
  // Get average of last 5 prices
  const recentPrices = priceHistory
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  
  const avgPrice = recentPrices.reduce((sum, p) => sum + p.price, 0) / recentPrices.length;
  
  const percentage = ((currentPrice - avgPrice) / avgPrice) * 100;
  const hasVariation = Math.abs(percentage) >= thresholdPercentage;
  
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (percentage > thresholdPercentage) trend = 'up';
  else if (percentage < -thresholdPercentage) trend = 'down';
  
  return { hasVariation, percentage, trend };
}

// Find best supplier based on price history and reliability
export function findBestSupplier(
  priceHistories: PriceHistory[],
  suppliers: Map<string, { name: string; reliability: number; rating: number }>
): { supplierId: string; reason: string } | null {
  if (priceHistories.length === 0) return null;
  
  // Group by supplier
  const supplierData = priceHistories.reduce((acc, ph) => {
    if (!acc[ph.supplierId]) {
      acc[ph.supplierId] = {
        prices: [],
        totalQuantity: 0,
      };
    }
    acc[ph.supplierId].prices.push(ph.price);
    acc[ph.supplierId].totalQuantity += ph.quantity;
    return acc;
  }, {} as Record<string, { prices: number[]; totalQuantity: number }>);
  
  // Calculate score for each supplier
  let bestSupplier = null;
  let bestScore = -Infinity;
  
  for (const [supplierId, data] of Object.entries(supplierData)) {
    const avgPrice = data.prices.reduce((a, b) => a + b, 0) / data.prices.length;
    const supplier = suppliers.get(supplierId);
    
    if (!supplier) continue;
    
    // Score: Lower price is better, higher reliability is better
    // Normalize: price (lower better), reliability (higher better)
    const priceScore = 1 / avgPrice; // Inverse so lower price = higher score
    const reliabilityScore = supplier.reliability / 100;
    const ratingScore = supplier.rating / 5;
    
    // Weighted score
    const score = priceScore * 0.5 + reliabilityScore * 0.3 + ratingScore * 0.2;
    
    if (score > bestScore) {
      bestScore = score;
      bestSupplier = supplierId;
    }
  }
  
  if (bestSupplier) {
    const supplier = suppliers.get(bestSupplier);
    return {
      supplierId: bestSupplier,
      reason: `Melhor custo-benefício: Preço competitivo + ${supplier?.reliability}% de confiabilidade`,
    };
  }
  
  return null;
}

// Simple demand forecast based on historical sales
export function forecastDemand(
  movements: StockMovement[],
  periodDays: number = 7
): { quantity: number; confidence: number } {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30); // Use last 30 days
  
  const relevantMovements = movements.filter(
    m => m.type === 'saida' && new Date(m.date) >= cutoffDate
  );
  
  if (relevantMovements.length === 0) {
    return { quantity: 0, confidence: 0 };
  }
  
  const totalConsumed = relevantMovements.reduce((sum, m) => sum + m.quantity, 0);
  const dailyAverage = totalConsumed / 30;
  const forecastedQuantity = dailyAverage * periodDays;
  
  // Confidence based on data consistency (simplified)
  const confidence = Math.min(100, (relevantMovements.length / 30) * 100);
  
  return {
    quantity: Math.ceil(forecastedQuantity),
    confidence: Math.round(confidence),
  };
}

// Format currency
export function formatCurrency(value: number): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/** Número genérico (pt-BR): separador de milhar e decimais configuráveis. */
export function formatNumber(
  value: number,
  opts?: { minFractionDigits?: number; maxFractionDigits?: number },
): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: opts?.minFractionDigits ?? 0,
    maximumFractionDigits: opts?.maxFractionDigits ?? 2,
  }).format(value);
}

/** Quantidades de estoque (kg, ml, un, etc.) — até 6 casas decimais. */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  }).format(value);
}

// Format percentage
export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

// Format date
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

// Format datetime
export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}
