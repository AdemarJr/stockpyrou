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

export function normalizedStockMovementType(m: Pick<StockMovement, "type">): string {
  return String(m.type ?? "").toLowerCase().trim();
}

/**
 * Saídas que o Dashboard trata como «consumo» (unidades / custo / receita estimada):
 * `saida` sem motivo de desperdício na linha, mais `venda` (PDV).
 * `desperdício` é tipo próprio e não entra nesses KPIs.
 */
export function isExitConsumption(m: StockMovement): boolean {
  const t = normalizedStockMovementType(m);
  if (t === "desperdicio") return false;
  if (t === "venda") return true;
  if (t === "saida") return !m.wasteReason;
  return false;
}

/**
 * Saídas e baixas: PDV (`venda`), saída manual, desperdício, ZIG (normalmente `saida`),
 * ajuste de balanço negativo; inclui legado onde baixa veio como `entrada` com qtd negativa.
 */
export function isAnyStockOutput(m: StockMovement): boolean {
  const t = normalizedStockMovementType(m);
  const q = Number(m.quantity);
  if (t === "saida" || t === "venda" || t === "desperdicio") return true;
  if (t === "ajuste" && q < 0) return true;
  if (t === "entrada" && q < 0) return true;
  return false;
}

/** Entrada por balanço (ajuste que aumenta estoque) — não gera linha em `stock_entries`. */
export function isBalanceStockIncrease(m: StockMovement): boolean {
  const t = normalizedStockMovementType(m);
  const q = Number(m.quantity);
  return t === "ajuste" && q > 0;
}

/** Custo da linha: `cost` quando informado; senão qtd × CMP do produto. */
export function lineCostAtMovement(m: StockMovement, products: Product[]): number {
  const q = Number(m.quantity) || 0;
  if (m.cost != null && Number.isFinite(m.cost) && m.cost > 0) return m.cost;
  const p = products.find((x) => x.id === m.productId);
  return Math.abs(q) * (p?.averageCost ?? 0);
}

/**
 * Efeito da movimentação no saldo de estoque (para somar histórico e bater com `products.current_stock`).
 * Convenção: entrada/ajuste somam `quantity`; saída/venda/desperdício subtraem o módulo da quantidade.
 */
export function movementLedgerDelta(m: StockMovement): number {
  const t = normalizedStockMovementType(m);
  const q = Number(m.quantity) || 0;
  if (t === "entrada" || t === "ajuste") return q;
  if (t === "saida" || t === "venda" || t === "desperdicio") return -Math.abs(q);
  return 0;
}
