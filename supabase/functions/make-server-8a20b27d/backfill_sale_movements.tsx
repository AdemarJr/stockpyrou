/**
 * Backfill: cria `stock_movements` para vendas antigas do Caixa (sem alterar estoque).
 * Otimizado: poucas queries por página de vendas + insert em lote.
 */
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type BackfillSaleMovementsResult = {
  dryRun: boolean;
  companyId: string | null;
  salesScanned: number;
  movementsWouldInsert: number;
  movementsInserted: number;
  linesSkippedAlready: number;
  linesSkippedInvalid: number;
  errors: Array<{ saleId: string; detail: string }>;
};

const SALES_PAGE = 250;
const MARKER_OR_CHUNK = 35;
const REF_VENDA_OR_CHUNK = 14;
const INSERT_CHUNK = 80;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function noteMarker(saleId: string, lineIdx: number): string {
  return `[backfill-caixa] sale=${saleId} line=${lineIdx}`;
}

function fullNotes(saleId: string, lineIdx: number, productName?: string): string {
  const base = noteMarker(saleId, lineIdx);
  const name = productName ? ` · ${productName}` : "";
  return `${base} | Venda PDV retroativa (estoque já baixado no caixa)${name}`;
}

/** Chaves `saleId|lineIdx` já cobertas pelo prefixo [backfill-caixa]. */
function parseBackfillLineKey(notes: string | null): string | null {
  if (!notes || !notes.startsWith("[backfill-caixa] sale=")) return null;
  const m = /^\[backfill-caixa\] sale=([a-f0-9-]{36}) line=(\d+)/i.exec(notes);
  if (!m) return null;
  return `${m[1]}|${m[2]}`;
}

type SaleRow = {
  id: string;
  company_id: string;
  items: unknown;
  timestamp: string;
  cashier_id: string;
};

type LinePlan = {
  sale: SaleRow;
  lineIdx: number;
  productId: string;
  qty: number;
  name?: string;
  marker: string;
  notesText: string;
};

/** Carrega notas que já têm nosso marcador (OR em lotes). */
async function loadExistingMarkerKeys(
  supabase: SupabaseClient,
  companyId: string,
  markers: string[],
): Promise<Set<string>> {
  const keys = new Set<string>();
  if (markers.length === 0) return keys;

  for (const group of chunk(markers, MARKER_OR_CHUNK)) {
    const orFilter = group.map((m) => `notes.like.${m}%`).join(",");
    const { data, error } = await supabase
      .from("stock_movements")
      .select("notes")
      .eq("company_id", companyId)
      .or(orFilter);

    if (error) throw new Error(error.message);
    for (const row of data || []) {
      const k = parseBackfillLineKey((row as { notes?: string }).notes ?? null);
      if (k) keys.add(k);
    }
  }
  return keys;
}

/** Movimentos já ligados à venda (Caixa novo com sale_id). */
async function loadMovementsBySaleIds(
  supabase: SupabaseClient,
  companyId: string,
  saleIds: string[],
): Promise<
  Array<{ product_id: string; quantity: number; sale_id: string | null; notes: string | null }>
> {
  const out: Array<{
    product_id: string;
    quantity: number;
    sale_id: string | null;
    notes: string | null;
  }> = [];
  for (const group of chunk(saleIds, 200)) {
    const { data, error } = await supabase
      .from("stock_movements")
      .select("product_id, quantity, sale_id, notes")
      .eq("company_id", companyId)
      .in("sale_id", group);

    if (error) throw new Error(error.message);
    for (const r of data || []) {
      out.push(r as {
        product_id: string;
        quantity: number;
        sale_id: string | null;
        notes: string | null;
      });
    }
  }
  return out;
}

/** Notas com «Ref. venda <uuid>» (Caixa novo sem sale_id na linha). */
async function loadRefVendaRows(
  supabase: SupabaseClient,
  companyId: string,
  saleIds: string[],
): Promise<
  Array<{ product_id: string; quantity: number; notes: string | null }>
> {
  const out: Array<{ product_id: string; quantity: number; notes: string | null }> = [];
  if (saleIds.length === 0) return out;

  for (const group of chunk(saleIds, REF_VENDA_OR_CHUNK)) {
    const orFilter = group
      .map((id) => `notes.ilike.%Ref. venda ${id}%`)
      .join(",");
    const { data, error } = await supabase
      .from("stock_movements")
      .select("product_id, quantity, notes")
      .eq("company_id", companyId)
      .or(orFilter);

    if (error) throw new Error(error.message);
    for (const r of data || []) {
      out.push(r as { product_id: string; quantity: number; notes: string | null });
    }
  }
  return out;
}

function buildSkipRefVendaSet(
  saleIds: Set<string>,
  bySaleId: Array<{ product_id: string; quantity: number; sale_id: string | null; notes: string | null }>,
  refNotes: Array<{ product_id: string; quantity: number; notes: string | null }>,
): Set<string> {
  const skip = new Set<string>();

  for (const row of bySaleId) {
    if (!row.sale_id || !saleIds.has(row.sale_id)) continue;
    skip.add(`${row.sale_id}|${row.product_id}|${Number(row.quantity)}`);
  }

  const uuidInNotes = /Ref\.\s*venda\s+([a-f0-9-]{36})/i;
  for (const row of refNotes) {
    const n = row.notes || "";
    const m = n.match(uuidInNotes);
    if (!m) continue;
    const sid = m[1];
    if (!saleIds.has(sid)) continue;
    skip.add(`${sid}|${row.product_id}|${Number(row.quantity)}`);
  }

  return skip;
}

export async function backfillCashierSaleMovements(
  supabaseAdmin: SupabaseClient,
  opts: {
    companyId?: string | null;
    dryRun: boolean;
  },
): Promise<BackfillSaleMovementsResult> {
  const result: BackfillSaleMovementsResult = {
    dryRun: opts.dryRun,
    companyId: opts.companyId ?? null,
    salesScanned: 0,
    movementsWouldInsert: 0,
    movementsInserted: 0,
    linesSkippedAlready: 0,
    linesSkippedInvalid: 0,
    errors: [],
  };

  let offset = 0;

  for (;;) {
    let q = supabaseAdmin
      .from("sales")
      .select("id, company_id, items, timestamp, cashier_id")
      .order("timestamp", { ascending: true })
      .range(offset, offset + SALES_PAGE - 1);

    if (opts.companyId) {
      q = q.eq("company_id", opts.companyId);
    }

    const { data: sales, error: salesError } = await q;
    if (salesError) {
      throw new Error(salesError.message);
    }
    if (!sales?.length) break;

    const saleRows = sales as SaleRow[];
    const plans: LinePlan[] = [];

    for (const sale of saleRows) {
      result.salesScanned++;
      const items = Array.isArray(sale.items) ? sale.items : [];
      let lineIdx = 0;
      for (const raw of items) {
        const item = raw as {
          productId?: string;
          quantity?: number;
          name?: string;
        };
        const productId = item.productId?.trim();
        const qty = Number(item.quantity);

        if (!productId || !Number.isFinite(qty) || qty <= 0) {
          result.linesSkippedInvalid++;
          lineIdx++;
          continue;
        }

        plans.push({
          sale,
          lineIdx,
          productId,
          qty,
          name: item.name,
          marker: noteMarker(sale.id, lineIdx),
          notesText: fullNotes(sale.id, lineIdx, item.name),
        });
        lineIdx++;
      }
    }

    if (plans.length === 0) {
      offset += SALES_PAGE;
      if (sales.length < SALES_PAGE) break;
      continue;
    }

    const byCompany = new Map<string, LinePlan[]>();
    for (const p of plans) {
      const cid = p.sale.company_id;
      if (!byCompany.has(cid)) byCompany.set(cid, []);
      byCompany.get(cid)!.push(p);
    }

    for (const [companyId, companyPlans] of byCompany) {
      const saleIds = [...new Set(companyPlans.map((p) => p.sale.id))];
      const saleIdSet = new Set(saleIds);

      let markerKeys: Set<string>;
      let refSkip: Set<string>;
      try {
        const markers = companyPlans.map((p) => p.marker);
        markerKeys = await loadExistingMarkerKeys(supabaseAdmin, companyId, markers);

        const [bySaleId, refRows] = await Promise.all([
          loadMovementsBySaleIds(supabaseAdmin, companyId, saleIds),
          loadRefVendaRows(supabaseAdmin, companyId, saleIds),
        ]);
        refSkip = buildSkipRefVendaSet(saleIdSet, bySaleId, refRows);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        result.errors.push({ saleId: saleIds[0] || "", detail: msg });
        continue;
      }

      const productIds = [...new Set(companyPlans.map((p) => p.productId))];
      const { data: prods, error: pe } = await supabaseAdmin
        .from("products")
        .select("id, cost_price")
        .eq("company_id", companyId)
        .in("id", productIds);

      if (pe) {
        result.errors.push({ saleId: saleIds[0] || "", detail: pe.message });
        continue;
      }

      const costMap = new Map<string, number>();
      for (const p of prods || []) {
        const r = p as { id: string; cost_price?: number };
        costMap.set(r.id, Number(r.cost_price ?? 0) || 0);
      }

      const toInsert: Record<string, unknown>[] = [];

      for (const p of companyPlans) {
        const lineKey = `${p.sale.id}|${p.lineIdx}`;
        const markerHit = markerKeys.has(lineKey);
        const refKey = `${p.sale.id}|${p.productId}|${Number(p.qty)}`;
        const refHit = refSkip.has(refKey);

        if (markerHit || refHit) {
          result.linesSkippedAlready++;
          continue;
        }

        const unitCost = costMap.get(p.productId) ?? 0;
        const lineCost = unitCost * p.qty;

        if (opts.dryRun) {
          result.movementsWouldInsert++;
        } else {
          toInsert.push({
            company_id: p.sale.company_id,
            product_id: p.productId,
            movement_type: "venda",
            quantity: p.qty,
            unit_cost: p.qty > 0 ? lineCost / p.qty : 0,
            total_value: lineCost > 0 ? lineCost : null,
            notes: p.notesText,
            movement_date: p.sale.timestamp,
            sale_id: p.sale.id,
            type: "venda",
          });
        }
      }

      if (!opts.dryRun && toInsert.length > 0) {
        for (const group of chunk(toInsert, INSERT_CHUNK)) {
          const { error: insErr } = await supabaseAdmin.from("stock_movements").insert(group);
          if (insErr) {
            result.errors.push({
              saleId: String((group[0] as { sale_id?: string }).sale_id ?? ""),
              detail: insErr.message,
            });
          } else {
            result.movementsInserted += group.length;
          }
        }
      }
    }

    offset += SALES_PAGE;
    if (sales.length < SALES_PAGE) break;
  }

  return result;
}
