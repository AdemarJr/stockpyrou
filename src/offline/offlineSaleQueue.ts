import type { Product } from '../types';
import { getBackendUrl } from '../lib/backendUrl';
import { StockRepository } from '../repositories/StockRepository';
import {
  idbDeleteSale,
  idbGetCatalog,
  idbGetRegister,
  idbGetSale,
  idbListSalesByCompany,
  idbPutCatalog,
  idbPutRegister,
  idbPutSale,
  type OfflineSaleRecord,
  type OfflineSaleStockLine,
} from './offlineDb';

const PENDING_EVENT = 'stockpyrou_offline_sales_changed';

export function notifyOfflineSalesChanged(companyId?: string): void {
  try {
    window.dispatchEvent(
      new CustomEvent(PENDING_EVENT, { detail: { companyId } }),
    );
  } catch {
    /* ignore */
  }
}

export function onOfflineSalesChanged(handler: (companyId?: string) => void): () => void {
  const fn = (e: Event) => {
    const ce = e as CustomEvent<{ companyId?: string }>;
    handler(ce.detail?.companyId);
  };
  window.addEventListener(PENDING_EVENT, fn);
  return () => window.removeEventListener(PENDING_EVENT, fn);
}

export async function cacheProductsForOffline(
  companyId: string,
  products: Product[],
): Promise<void> {
  await idbPutCatalog({
    companyId,
    products,
    cachedAt: new Date().toISOString(),
  });
}

export async function loadCachedProducts(companyId: string): Promise<Product[] | null> {
  const row = await idbGetCatalog(companyId);
  if (!row?.products || !Array.isArray(row.products)) return null;
  return row.products as Product[];
}

export async function cacheOpenRegister(
  companyId: string,
  register: Record<string, unknown>,
): Promise<void> {
  if (!companyId || !register?.id) return;
  const normalized = {
    ...register,
    status: (register.status as string) || 'open',
  };
  await idbPutRegister({
    companyId,
    register: normalized,
    cachedAt: new Date().toISOString(),
  });
  try {
    localStorage.setItem(`cashier_register_${companyId}`, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
}

export async function clearCachedRegister(companyId: string): Promise<void> {
  if (!companyId) return;
  try {
    await idbPutRegister({
      companyId,
      register: {},
      cachedAt: new Date().toISOString(),
    });
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(`cashier_register_${companyId}`);
  } catch {
    /* ignore */
  }
}

/** Retorna caixa aberto em cache (IndexedDB ou localStorage). */
export async function loadCachedRegister(
  companyId: string,
): Promise<Record<string, unknown> | null> {
  if (!companyId) return null;

  const usable = (reg: Record<string, unknown> | null | undefined) => {
    if (!reg?.id) return null;
    const status = String(reg.status || 'open').toLowerCase();
    if (status && status !== 'open') return null;
    return reg;
  };

  try {
    const row = await idbGetRegister(companyId);
    const fromIdb = usable(row?.register);
    if (fromIdb) return fromIdb;
  } catch {
    /* IndexedDB pode falhar em modo privado — cai no localStorage */
  }

  try {
    const raw = localStorage.getItem(`cashier_register_${companyId}`);
    if (!raw) return null;
    const parsed = usable(JSON.parse(raw) as Record<string, unknown>);
    if (parsed) {
      // Rehidrata IndexedDB a partir do localStorage
      void cacheOpenRegister(companyId, parsed);
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function isOfflineNonFiscalAllowed(opts: {
  emitNfce: boolean;
  paymentMethod: string;
  mixedMode: boolean;
  hasReceivable: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (opts.emitNfce) {
    return { ok: false, reason: 'NFC-e exige internet. Use cupom não fiscal offline.' };
  }
  if (opts.hasReceivable || opts.paymentMethod === 'fiado' || opts.paymentMethod === 'boleto') {
    return { ok: false, reason: 'Fiado/boleto exige internet.' };
  }
  if (opts.mixedMode) {
    return { ok: false, reason: 'Pagamento misto offline ainda não suportado. Use um método só.' };
  }
  const allowed = new Set(['money', 'pix', 'credit', 'debit']);
  if (!allowed.has(opts.paymentMethod)) {
    return { ok: false, reason: 'Offline: use dinheiro, PIX, crédito ou débito.' };
  }
  return { ok: true };
}

function applyOptimisticStock(
  products: Product[],
  stockItems: OfflineSaleStockLine[],
): Product[] {
  const next = products.map((p) => ({ ...p }));
  const byId = new Map(next.map((p) => [p.id, p]));

  for (const line of stockItems) {
    const bundles = line.bundleItems?.length ? line.bundleItems : null;
    if (bundles) {
      for (const b of bundles) {
        const p = byId.get(b.productId);
        if (!p) continue;
        const qty = (Number(b.quantity) || 0) * line.quantity;
        p.currentStock = Math.max(0, (Number(p.currentStock) || 0) - qty);
      }
    } else {
      const p = byId.get(line.productId);
      if (!p) continue;
      p.currentStock = Math.max(0, (Number(p.currentStock) || 0) - line.quantity);
    }
  }
  return next;
}

export async function enqueueOfflineSale(input: {
  companyId: string;
  registerId: string;
  products: Product[];
  payload: OfflineSaleRecord['payload'];
  stockItems: OfflineSaleStockLine[];
  receiptItems: Array<{ name: string; quantity: number; price: number }>;
}): Promise<OfflineSaleRecord> {
  const id = input.payload.clientRequestId;
  const now = new Date().toISOString();
  const record: OfflineSaleRecord = {
    id,
    companyId: input.companyId,
    registerId: input.registerId,
    createdAt: now,
    status: 'pending',
    payload: {
      ...input.payload,
      paymentDetails: {
        ...input.payload.paymentDetails,
        emitNfce: false,
        offlineQueued: true,
      },
    },
    stockItems: input.stockItems,
    receipt: {
      id,
      items: input.receiptItems,
      total: input.payload.total,
      paymentMethod: input.payload.paymentMethod,
      paymentDetails: {
        ...input.payload.paymentDetails,
        emitNfce: false,
        offlineQueued: true,
      },
      emitNfce: false,
      timestamp: now,
      offlinePending: true,
    },
  };

  await idbPutSale(record);

  const updated = applyOptimisticStock(input.products, input.stockItems);
  await cacheProductsForOffline(input.companyId, updated);

  notifyOfflineSalesChanged(input.companyId);
  return record;
}

export async function countPendingOfflineSales(companyId: string): Promise<number> {
  const all = await idbListSalesByCompany(companyId);
  return all.filter((s) => s.status === 'pending' || s.status === 'failed' || s.status === 'syncing')
    .length;
}

export async function listPendingOfflineSales(companyId: string): Promise<OfflineSaleRecord[]> {
  const all = await idbListSalesByCompany(companyId);
  return all
    .filter((s) => s.status !== 'synced')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

let syncing = false;

export async function syncPendingOfflineSales(opts: {
  companyId: string;
  accessToken: string;
}): Promise<{ synced: number; failed: number }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }
  if (syncing) return { synced: 0, failed: 0 };
  syncing = true;

  let synced = 0;
  let failed = 0;

  try {
    const pending = await listPendingOfflineSales(opts.companyId);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${opts.accessToken}`,
      'X-Custom-Token': opts.accessToken,
      'Content-Type': 'application/json',
      'X-Company-Id': opts.companyId,
    };

    for (const sale of pending) {
      const current = (await idbGetSale(sale.id)) || sale;
      if (current.status === 'synced') continue;

      current.status = 'syncing';
      current.lastError = undefined;
      await idbPutSale(current);

      try {
        const res = await fetch(getBackendUrl('/cashier/sale'), {
          method: 'POST',
          headers,
          body: JSON.stringify(current.payload),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          sale?: { id?: string };
        };
        if (!res.ok || data.error || !data.sale?.id) {
          throw new Error(data.error || `HTTP ${res.status}`);
        }

        const saleId = String(data.sale.id);
        for (const item of current.stockItems) {
          const bundles = item.bundleItems?.length ? item.bundleItems : null;
          if (bundles) {
            for (const b of bundles) {
              const qty = (Number(b.quantity) || 0) * item.quantity;
              if (!b.productId || qty <= 0) continue;
              await StockRepository.deductStockOnce({
                companyId: opts.companyId,
                productId: b.productId,
                quantity: qty,
                source: `sale:${saleId}:${b.productId}:combo`,
                notes: `Venda PDV (offline→sync) — Combo · Ref. ${saleId}`,
                movementType: 'venda',
              });
            }
          } else {
            await StockRepository.deductStockOnce({
              companyId: opts.companyId,
              productId: item.productId,
              quantity: item.quantity,
              source: `sale:${saleId}:${item.productId}:direct`,
              notes: `Venda PDV (offline→sync) · ${item.quantity}x ${item.name} · Ref. ${saleId}`,
              movementType: 'venda',
            });
          }
        }

        await idbDeleteSale(current.id);
        synced += 1;
      } catch (err) {
        failed += 1;
        current.status = 'failed';
        current.lastError = err instanceof Error ? err.message : String(err);
        await idbPutSale(current);
      }
    }
  } finally {
    syncing = false;
    notifyOfflineSalesChanged(opts.companyId);
  }

  return { synced, failed };
}
