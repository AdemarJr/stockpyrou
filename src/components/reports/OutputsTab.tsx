import React, { useMemo, useState } from 'react';
import { PackageX, TrendingDown, Package, AlertCircle, Filter } from 'lucide-react';
import { ReportCard } from './ReportCard';
import { ReportTable } from './ReportTable';
import { formatCurrency, formatDate } from '../../utils/calculations';
import type { StockMovement, Product } from '../../types';
import {
  isAnyStockOutput,
  isExitConsumption,
  lineCostAtMovement,
} from '../../utils/stockMovementFilters';

interface OutputsTabProps {
  movements: StockMovement[];
  products: Product[];
  loading?: boolean;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

type OutputKindFilter =
  | 'all'
  | 'consumo'
  | 'saida'
  | 'venda'
  | 'desperdicio';

const FILTER_LABELS: Record<OutputKindFilter, string> = {
  all: 'Todos os tipos',
  consumo: 'Consumo (saída + venda PDV)',
  saida: 'Saída manual',
  venda: 'Venda PDV',
  desperdicio: 'Desperdício',
};

export function OutputsTab({
  movements,
  products,
  loading = false,
  currentPage,
  itemsPerPage,
  onPageChange,
}: OutputsTabProps) {
  const [kindFilter, setKindFilter] = useState<OutputKindFilter>('all');
  const [listSearch, setListSearch] = useState('');

  const baseOutputs = useMemo(
    () => movements.filter(isAnyStockOutput),
    [movements],
  );

  const outputMovements = useMemo(() => {
    let list = baseOutputs;
    if (kindFilter === 'consumo') {
      list = list.filter(isExitConsumption);
    } else if (kindFilter !== 'all') {
      list = list.filter((m) => m.type === kindFilter);
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
    return [...list].sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [baseOutputs, kindFilter, listSearch, products]);

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
        const types: Record<string, { label: string; color: string }> = {
          saida: { label: 'Saída', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200' },
          venda: { label: 'Venda', color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' },
          desperdicio: { label: 'Desperdício', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' },
        };
        const type = types[value] || { label: value, color: 'bg-gray-100 text-gray-800' };
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${type.color}`}>
            {type.label}
          </span>
        );
      },
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
      render: (_value: unknown, row: StockMovement) => (
        <span className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
          {row.reason || row.notes || '—'}
        </span>
      ),
    },
    {
      key: 'userId',
      label: 'Usuário',
      render: (value: unknown) => (value as string) || 'Sistema',
    },
  ];

  return (
    <div className="space-y-6">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      />
    </div>
  );
}
