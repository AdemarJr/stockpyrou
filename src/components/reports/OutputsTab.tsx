import React, { useEffect, useMemo, useState } from 'react';
import { PackageX, TrendingDown, Package, AlertCircle, Filter } from 'lucide-react';
import { ReportCard } from './ReportCard';
import { ReportTable } from './ReportTable';
import { formatCurrency, formatDate } from '../../utils/calculations';
import type { StockMovement, Product } from '../../types';
import {
  isAnyStockOutput,
  isExitConsumption,
  lineCostAtMovement,
  movementDateYmdLocal,
  normalizedStockMovementType,
} from '../../utils/stockMovementFilters';
import { ZigSaidaComparisonCard } from './ZigSaidaComparisonCard';

interface OutputsTabProps {
  movements: StockMovement[];
  products: Product[];
  loading?: boolean;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  /** Período do relatório (mesmo filtro global) — usado no comparativo ZIG × integração. */
  reportStartDate: string;
  reportEndDate: string;
  /** Quando filtros globais do relatório mudam, volta à ordem padrão (últimas saídas primeiro). */
  sortResetKey: string;
}

type OutputKindFilter =
  | 'all'
  | 'consumo'
  | 'saida'
  | 'venda'
  | 'desperdicio'
  | 'ajuste';

const FILTER_LABELS: Record<OutputKindFilter, string> = {
  all: 'Todos os tipos',
  consumo: 'Consumo (saída + venda PDV)',
  saida: 'Saída / baixa (manual + ZIG)',
  venda: 'Venda PDV',
  desperdicio: 'Desperdício',
  ajuste: 'Balanço / ajuste (baixa)',
};

function isZigStockMovement(m: StockMovement): boolean {
  const text = `${m.reason || ''} ${m.notes || ''}`.toLowerCase();
  return (
    text.includes('integração automática zig') ||
    text.includes('integracao automatica zig') ||
    text.includes('venda zig') ||
    text.includes('baixa zig')
  );
}

/**
 * Consolida baixas ZIG do mesmo produto no mesmo dia em 1 linha (qtd somada).
 * PDV e baixas manuais permanecem linha a linha.
 */
function consolidateZigOutputsForReport(
  movements: StockMovement[],
  products: Product[],
): StockMovement[] {
  const zigLots = new Map<string, StockMovement>();
  const others: StockMovement[] = [];

  for (const m of movements) {
    if (!isZigStockMovement(m)) {
      others.push(m);
      continue;
    }
    const ymd = movementDateYmdLocal(m);
    const key = `${ymd}|${m.productId}|${normalizedStockMovementType(m)}`;
    const prev = zigLots.get(key);
    if (!prev) {
      zigLots.set(key, { ...m });
      continue;
    }
    const qty = (Number(prev.quantity) || 0) + (Number(m.quantity) || 0);
    const cost = lineCostAtMovement(prev, products) + lineCostAtMovement(m, products);
    const name = productName(products, m.productId) || 'Produto';
    zigLots.set(key, {
      ...prev,
      quantity: qty,
      cost,
      reason: `Baixa ZIG (lote) — ${name} — qtd ${qty.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}`,
      notes: prev.notes || m.notes,
      type: prev.type === 'saida' || m.type === 'saida' ? 'saida' : prev.type,
    });
  }

  return [...others, ...zigLots.values()];
}

function productName(products: Product[], id: string): string {
  return products.find((p) => p.id === id)?.name ?? '';
}

function compareOutputRows(
  a: StockMovement,
  b: StockMovement,
  field: string,
  dir: 'asc' | 'desc',
  products: Product[],
): number {
  const mul = dir === 'asc' ? 1 : -1;
  switch (field) {
    case 'date': {
      const ta = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
      const tb = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
      return (ta - tb) * mul;
    }
    case 'type':
      return normalizedStockMovementType(a).localeCompare(normalizedStockMovementType(b), 'pt-BR') * mul;
    case 'productId': {
      const na = productName(products, a.productId);
      const nb = productName(products, b.productId);
      return na.localeCompare(nb, 'pt-BR', { sensitivity: 'base' }) * mul;
    }
    case 'quantity': {
      const qa = Number(a.quantity) || 0;
      const qb = Number(b.quantity) || 0;
      return (qa - qb) * mul;
    }
    case 'cost': {
      const ca = lineCostAtMovement(a, products);
      const cb = lineCostAtMovement(b, products);
      return (ca - cb) * mul;
    }
    case 'reason': {
      const ra = `${a.reason || ''} ${a.notes || ''}`;
      const rb = `${b.reason || ''} ${b.notes || ''}`;
      return ra.localeCompare(rb, 'pt-BR', { sensitivity: 'base' }) * mul;
    }
    case 'userId': {
      const ua = String(a.userId ?? '');
      const ub = String(b.userId ?? '');
      return ua.localeCompare(ub, 'pt-BR') * mul;
    }
    default:
      return 0;
  }
}

export function OutputsTab({
  movements,
  products,
  loading = false,
  currentPage,
  itemsPerPage,
  onPageChange,
  reportStartDate,
  reportEndDate,
  sortResetKey,
}: OutputsTabProps) {
  const [kindFilter, setKindFilter] = useState<OutputKindFilter>('all');
  const [listSearch, setListSearch] = useState('');
  const [sortField, setSortField] = useState<string | undefined>();
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setSortField(undefined);
    setSortDirection('desc');
  }, [sortResetKey, kindFilter]);

  function movementSourceLabel(m: StockMovement): string {
    if (isZigStockMovement(m)) {
      return 'Baixa ZIG (lote)';
    }

    const text = `${m.reason || ''} ${m.notes || ''}`.toLowerCase();

    if (text.includes('venda pdv (caixa)') || text.includes('pdv (caixa)')) {
      return 'PDV (Caixa)';
    }

    if (text.includes('venda manual') || text.includes('venda pdv (manual)')) {
      return 'PDV (Manual)';
    }

    if (m.type === 'ajuste') {
      return 'Balanço / ajuste';
    }

    if (m.type === 'saida' || m.type === 'desperdicio') {
      return 'Baixa manual';
    }

    return 'Sistema';
  }

  const baseOutputs = useMemo(
    () => consolidateZigOutputsForReport(movements.filter(isAnyStockOutput), products),
    [movements, products],
  );

  const outputMovements = useMemo(() => {
    let list = baseOutputs;
    if (kindFilter === 'consumo') {
      list = list.filter(isExitConsumption);
    } else if (kindFilter !== 'all') {
      list = list.filter((m) => normalizedStockMovementType(m) === kindFilter);
    }
    const q = listSearch.trim().toLowerCase();
    if (q) {
      list = list.filter((m) => {
        const product = products.find((p) => p.id === m.productId);
        return (
          product?.name.toLowerCase().includes(q) ||
          (product?.barcode && product.barcode.toLowerCase().includes(q)) ||
          m.reason?.toLowerCase().includes(q) ||
          (m.notes && m.notes.toLowerCase().includes(q)) ||
          m.id.toLowerCase().includes(q)
        );
      });
    }
    const copy = [...list];
    if (!sortField) {
      copy.sort((a, b) => {
        const tb = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
        const ta = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
        return tb - ta;
      });
    } else {
      copy.sort((a, b) => compareOutputRows(a, b, sortField, sortDirection, products));
    }
    return copy;
  }, [baseOutputs, kindFilter, listSearch, products, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    onPageChange(1);
  };

  const totalOutputs = outputMovements.length;
  const totalQuantity = outputMovements.reduce((sum, m) => sum + m.quantity, 0);
  const totalValue = outputMovements.reduce(
    (sum, m) => sum + lineCostAtMovement(m, products),
    0,
  );

  const byType = outputMovements.reduce(
    (acc, m) => {
      acc[m.type] = (acc[m.type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const productCounts = outputMovements.reduce((acc, m) => {
    const product = products.find((p) => p.id === m.productId);
    if (product) {
      acc[product.name] = (acc[product.name] || 0) + m.quantity;
    }
    return acc;
  }, {} as Record<string, number>);
  const mostMoved = Object.entries(productCounts).sort(([, a], [, b]) => b - a)[0];

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = outputMovements.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(outputMovements.length / itemsPerPage) || 1;

  const columns = [
    {
      key: 'date',
      label: 'Data',
      sortable: true,
      render: (value: unknown) => formatDate(value as Date),
    },
    {
      key: 'type',
      label: 'Tipo',
      sortable: true,
      render: (value: string) => {
        const key = String(value || '').toLowerCase().trim();
        const types: Record<string, { label: string; color: string }> = {
          saida: { label: 'Saída', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' },
          venda: { label: 'Venda', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' },
          desperdicio: { label: 'Desperdício', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
          ajuste: { label: 'Ajuste', color: 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100' },
          entrada: { label: 'Entrada (baixa)', color: 'bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-slate-100' },
        };
        const type = types[key] || { label: value, color: 'bg-gray-100 text-gray-800' };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${type.color}`}>
            {type.label}
          </span>
        );
      },
    },
    {
      key: 'source',
      label: 'Origem',
      render: (_value: unknown, row: StockMovement) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {movementSourceLabel(row)}
        </span>
      ),
    },
    {
      key: 'productId',
      label: 'Produto',
      sortable: true,
      render: (value: string) => {
        const product = products.find((p) => p.id === value);
        return (
          <div className="flex flex-col gap-0.5">
            <span>{product?.name || 'Produto desconhecido'}</span>
            {product?.barcode ? (
              <span className="text-[11px] text-gray-500 font-mono">{product.barcode}</span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'quantity',
      label: 'Quantidade',
      sortable: true,
      render: (value: number, row: StockMovement) => {
        const product = products.find((p) => p.id === row.productId);
        return `${value} ${product?.measurementUnit || 'un'}`;
      },
    },
    {
      key: 'cost',
      label: 'Valor (custo)',
      sortable: true,
      render: (_value: unknown, row: StockMovement) =>
        formatCurrency(lineCostAtMovement(row, products)),
    },
    {
      key: 'reason',
      label: 'Motivo / observação',
      sortable: true,
      render: (_value: unknown, row: StockMovement) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
          {row.reason || row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'userId',
      label: 'Usuário',
      sortable: true,
      render: (value: unknown) => (value as string) || 'Sistema',
    },
  ];

  return (
    <div className="space-y-6">
      <ZigSaidaComparisonCard startDate={reportStartDate} endDate={reportEndDate} />

      <div className="flex flex-col lg:flex-row gap-3 lg:items-end bg-white dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase mb-1">
            <Filter className="w-3.5 h-3.5" />
            Tipo de movimento
          </label>
          <select
            value={kindFilter}
            onChange={(e) => {
              setKindFilter(e.target.value as OutputKindFilter);
              onPageChange(1);
            }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100"
          >
            {(Object.keys(FILTER_LABELS) as OutputKindFilter[]).map((k) => (
              <option key={k} value={k}>
                {FILTER_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
            Refinar nesta lista
          </label>
          <input
            type="search"
            placeholder="Produto, código de barras, motivo, ID…"
            value={listSearch}
            onChange={(e) => {
              setListSearch(e.target.value);
              onPageChange(1);
            }}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard
          title="Linhas na tabela"
          value={totalOutputs}
          subtitle="Após filtros desta aba"
          icon={PackageX}
          iconColor="text-red-600"
          variant="danger"
        />
        <ReportCard
          title="Quantidade total"
          value={totalQuantity.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          subtitle="Unidades (lista filtrada)"
          icon={TrendingDown}
          iconColor="text-orange-600"
          variant="warning"
        />
        <ReportCard
          title="Custo total (lista)"
          value={formatCurrency(totalValue)}
          subtitle="Soma dos custos das linhas"
          icon={Package}
          iconColor="text-purple-600"
          variant="default"
        />
        <ReportCard
          title="Produto mais movimentado"
          value={mostMoved ? mostMoved[0] : 'N/A'}
          subtitle={mostMoved ? `${mostMoved[1].toLocaleString('pt-BR', { maximumFractionDigits: 2 })} un.` : 'Sem dados'}
          icon={AlertCircle}
          iconColor="text-blue-600"
          variant="info"
        />
      </div>

      <div className="bg-white dark:bg-gray-900/40 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Distribuição por tipo (lista filtrada)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">Saídas</p>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">{byType.saida || 0}</p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-950/40 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-200 font-medium">Vendas PDV</p>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">{byType.venda || 0}</p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-950/40 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200 font-medium">Desperdícios</p>
            <p className="text-2xl font-bold text-red-900 dark:text-red-100 mt-1">{byType.desperdicio || 0}</p>
          </div>
          <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-lg">
            <p className="text-sm text-amber-900 dark:text-amber-200 font-medium">Ajustes (baixa)</p>
            <p className="text-2xl font-bold text-amber-950 dark:text-amber-100 mt-1">{byType.ajuste || 0}</p>
          </div>
        </div>
      </div>

      <ReportTable
        columns={columns}
        data={paginatedData}
        loading={loading}
        emptyMessage="Nenhuma saída encontrada com os filtros atuais"
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        showPagination={totalPages > 1}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
    </div>
  );
}
