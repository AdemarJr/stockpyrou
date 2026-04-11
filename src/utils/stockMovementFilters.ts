import type { Product, StockMovement } from '../types';

/** Data civil local da movimentação (evita deslocar o dia com `toISOString()` em UTC). */
export function movementDateYmdLocal(m: { date: Date }): string {
  const d = m.date instanceof Date ? m.date : new Date(m.date);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/**
 * Saídas que o Dashboard trata como «consumo» (unidades / custo / receita estimada):
 * `saida` sem motivo de desperdício na linha, mais `venda` (PDV).
 * `desperdício` é tipo próprio e não entra nesses KPIs.
 */
export function isExitConsumption(m: StockMovement): boolean {
  if (m.type === "desperdicio") return false;
  if (m.type === "venda") return true;
  if (m.type === "saida") return !m.wasteReason;
  return false;
}

export function isAnyStockOutput(m: StockMovement): boolean {
  return m.type === "saida" || m.type === "venda" || m.type === "desperdicio";
}

/** Custo da linha: `cost` quando informado; senão qtd × CMP do produto. */
export function lineCostAtMovement(m: StockMovement, products: Product[]): number {
  const q = Number(m.quantity) || 0;
  if (m.cost != null && Number.isFinite(m.cost) && m.cost > 0) return m.cost;
  const p = products.find((x) => x.id === m.productId);
  return q * (p?.averageCost ?? 0);
}
