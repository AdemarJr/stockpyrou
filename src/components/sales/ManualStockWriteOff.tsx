import React, { useMemo, useState } from 'react';
import {
  Search,
  PackageMinus,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import type { Product } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { StockService } from '../../services/StockService';
import { cn } from '../ui/utils';
import { nativeFieldInvalidClass } from '../../lib/formFieldValidation';

interface ManualStockWriteOffProps {
  products: Product[];
  onComplete?: () => void | Promise<void>;
}

type WriteOffLine = {
  productId: string;
  name: string;
  unit: string;
  currentStock: number;
  quantity: number;
  isBundle: boolean;
  bundleItems: Array<{ productId: string; quantity: number }>;
};

export function ManualStockWriteOff({ products, onComplete }: ManualStockWriteOffProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [searchTerm, setSearchTerm] = useState('');
  const [lines, setLines] = useState<WriteOffLine[]>([]);
  const [reasonType, setReasonType] = useState<'saida' | 'desperdicio'>('saida');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reasonError, setReasonError] = useState(false);

  const catalog = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = products.filter((p) => (p as { isActive?: boolean }).isActive !== false);
    if (!q) return list.slice(0, 48);
    return list
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q) ||
          String((p as { sku?: string }).sku || '')
            .toLowerCase()
            .includes(q),
      )
      .slice(0, 48);
  }, [products, searchTerm]);

  const addProduct = (product: Product) => {
    const bundleItems =
      Array.isArray((product as { bundleItems?: unknown }).bundleItems) &&
      ((product as { bundleItems: Array<{ productId: string; quantity: number }> }).bundleItems
        .length > 0)
        ? (product as { bundleItems: Array<{ productId: string; quantity: number }> }).bundleItems
        : [];
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          unit: product.measurementUnit || 'un',
          currentStock: Number(product.currentStock) || 0,
          quantity: 1,
          isBundle: bundleItems.length > 0,
          bundleItems,
        },
      ];
    });
  };

  const updateQty = (productId: string, quantity: number) => {
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)),
    );
  };

  const removeLine = (productId: string) => {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  };

  const handleConfirm = async () => {
    if (!currentCompany || !user) return;
    if (lines.length === 0) {
      toast.error('Adicione ao menos um produto para baixar.');
      return;
    }
    if (!reason.trim()) {
      setReasonError(true);
      toast.error('Informe o motivo da baixa.');
      return;
    }
    setReasonError(false);

    for (const line of lines) {
      if (!line.quantity || line.quantity <= 0) {
        toast.error(`Quantidade inválida em: ${line.name}`);
        return;
      }
      if (!line.isBundle && line.quantity > line.currentStock) {
        toast.error(`Estoque insuficiente: ${line.name} (disp. ${line.currentStock})`);
        return;
      }
    }

    setSubmitting(true);
    try {
      let count = 0;
      for (const line of lines) {
        const note = `${reason.trim()} (Baixa avulsa)`;
        if (line.isBundle) {
          for (const b of line.bundleItems) {
            const q = (Number(b.quantity) || 0) * line.quantity;
            if (!b.productId || !Number.isFinite(q) || q <= 0) continue;
            await StockService.processStockOutput(
              currentCompany.id,
              b.productId,
              q,
              `${note} — Promo/Combo: ${line.name}`,
              reasonType,
              user.id,
            );
            count += 1;
          }
        } else {
          await StockService.processStockOutput(
            currentCompany.id,
            line.productId,
            line.quantity,
            note,
            reasonType,
            user.id,
          );
          count += 1;
        }
      }

      toast.success(
        `Baixa avulsa concluída (${count} movimento${count === 1 ? '' : 's'}). Sem venda registrada.`,
      );
      setLines([]);
      setReason('');
      await onComplete?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Erro na baixa: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 flex gap-3">
        <PackageMinus className="w-6 h-6 text-amber-700 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-amber-950">Baixa avulsa de estoque</h2>
          <p className="text-sm text-amber-900/85 mt-0.5">
            Dá baixa no estoque <strong>sem registrar venda</strong> nem valor financeiro. Use para
            consumo interno, ajuste ou perda.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar produto, SKU ou código…"
              className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100">
            {catalog.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">Nenhum produto encontrado.</p>
            ) : (
              catalog.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addProduct(p)}
                  className="w-full flex items-center justify-between gap-3 py-2.5 px-1 text-left hover:bg-amber-50/60 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    <p className="text-xs text-gray-500">
                      Estoque: {p.currentStock} {p.measurementUnit || 'un'}
                      {p.barcode ? ` · ${p.barcode}` : ''}
                    </p>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-1 rounded-md">
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">Itens a baixar</h3>

          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-500">
              Selecione produtos à esquerda.
            </div>
          ) : (
            <ul className="space-y-2 max-h-[36vh] overflow-y-auto">
              {lines.map((line) => (
                <li
                  key={line.productId}
                  className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50/80 p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{line.name}</p>
                    <p className="text-[11px] text-gray-500">
                      Disp.: {line.currentStock} {line.unit}
                      {line.isBundle ? ' · promo/combo' : ''}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <input
                        type="number"
                        min={0.01}
                        step="0.01"
                        value={line.quantity}
                        onChange={(e) =>
                          updateQty(line.productId, parseFloat(e.target.value) || 0)
                        }
                        className="w-24 px-2 py-1.5 rounded-md border border-gray-300 text-sm"
                      />
                      <span className="text-xs text-gray-500">{line.unit}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.productId)}
                    className="p-1.5 text-gray-400 hover:text-red-600"
                    aria-label="Remover"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div>
            <p className="text-xs font-medium text-gray-700 mb-1.5">Tipo de baixa</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReasonType('saida')}
                className={`px-3 py-2 text-sm rounded-lg border font-medium transition-all ${
                  reasonType === 'saida'
                    ? 'bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-500'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                Uso / Ajuste
              </button>
              <button
                type="button"
                onClick={() => setReasonType('desperdicio')}
                className={`px-3 py-2 text-sm rounded-lg border font-medium transition-all ${
                  reasonType === 'desperdicio'
                    ? 'bg-red-50 border-red-200 text-red-700 ring-1 ring-red-500'
                    : 'bg-white border-gray-200 text-gray-600'
                }`}
              >
                Perda / Validade
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Motivo <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonError(false);
              }}
              rows={2}
              placeholder="Ex.: consumo interno, quebra, validade…"
              className={cn(
                'w-full rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500',
                nativeFieldInvalidClass(reasonError),
                !reasonError && 'border border-gray-300',
              )}
            />
          </div>

          <div className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            Não gera venda, NFC-e nem lançamento de caixa — apenas movimento de estoque.
          </div>

          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={submitting || lines.length === 0}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              'Processando…'
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Confirmar baixa avulsa
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
