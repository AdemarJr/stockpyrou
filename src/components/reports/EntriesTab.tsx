import React, { useEffect, useMemo, useState } from 'react';
import { PackagePlus, TrendingUp, Package, DollarSign } from 'lucide-react';
import { ReportCard } from './ReportCard';
import { ReportTable } from './ReportTable';
import { formatCurrency, formatDate } from '../../utils/calculations';

interface EntriesTabProps {
  data: any[];
  loading: boolean;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  /** Quando período / fornecedor / produto mudam no relatório, volta à ordem padrão (últimas entradas primeiro). */
  sortResetKey: string;
}

function entryDateTs(row: any): number {
  const t = new Date(row.entryDate ?? row.createdAt).getTime();
  return Number.isFinite(t) ? t : 0;
}

function compareEntryRows(a: any, b: any, field: string, dir: 'asc' | 'desc'): number {
  const mul = dir === 'asc' ? 1 : -1;
  let va: string | number = 0;
  let vb: string | number = 0;

  switch (field) {
    case 'entryDate':
      va = entryDateTs(a);
      vb = entryDateTs(b);
      return (va - vb) * mul;
    case 'quantity':
    case 'unitPrice':
    case 'totalPrice':
      va = Number(a[field]) || 0;
      vb = Number(b[field]) || 0;
      return (va - vb) * mul;
    case 'supplierName':
    case 'productName':
    case 'entrySource':
      va = String(a[field] ?? '');
      vb = String(b[field] ?? '');
      return va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' }) * mul;
    default:
      va = String(a[field] ?? '');
      vb = String(b[field] ?? '');
      return va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' }) * mul;
  }
}

export function EntriesTab({
  data,
  loading,
  currentPage,
  itemsPerPage,
  onPageChange,
  sortResetKey,
}: EntriesTabProps) {
  const [sortField, setSortField] = useState<string | undefined>();
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    setSortField(undefined);
    setSortDirection('desc');
  }, [sortResetKey]);

  const sortedData = useMemo(() => {
    const copy = [...data];
    if (!sortField) {
      copy.sort((a, b) => entryDateTs(b) - entryDateTs(a));
      return copy;
    }
    copy.sort((a, b) => compareEntryRows(a, b, sortField, sortDirection));
    return copy;
  }, [data, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    onPageChange(1);
  };

  const totalEntries = sortedData.length;
  const totalValue = sortedData.reduce((sum, entry) => sum + entry.totalPrice, 0);
  const avgValue = totalEntries > 0 ? totalValue / totalEntries : 0;

  const supplierCounts = sortedData.reduce((acc, entry) => {
    acc[entry.supplierName] = (acc[entry.supplierName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topSupplier = Object.entries(supplierCounts).sort(([, a], [, b]) => b - a)[0];

  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = sortedData.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(sortedData.length / itemsPerPage) || 1;

  const columns = [
    {
      key: 'entryDate',
      label: 'Data',
      sortable: true,
      render: (value: any) => formatDate(value),
    },
    {
      key: 'entrySource',
      label: 'Origem',
      sortable: true,
      render: (_value: unknown, row: any) =>
        row.entrySource === 'balanco' ? 'Balanço' : 'Recebimento',
    },
    {
      key: 'supplierName',
      label: 'Fornecedor',
      sortable: true,
    },
    {
      key: 'productName',
      label: 'Produto',
      sortable: true,
    },
    {
      key: 'quantity',
      label: 'Quantidade',
      sortable: true,
      render: (value: any, row: any) => `${value} ${row.measurementUnit}`,
    },
    {
      key: 'unitPrice',
      label: 'Preço Unit.',
      sortable: true,
      render: (value: any) => formatCurrency(value),
    },
    {
      key: 'totalPrice',
      label: 'Total',
      sortable: true,
      render: (value: any) => (
        <span className="font-semibold text-green-600">{formatCurrency(value)}</span>
      ),
    },
    {
      key: 'batchNumber',
      label: 'Lote',
      render: (value: any) => value || '-',
    },
    {
      key: 'expirationDate',
      label: 'Validade',
      render: (value: any) => (value ? formatDate(value) : '-'),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard
          title="Total de Entradas"
          value={totalEntries}
          subtitle="Registros no período"
          icon={PackagePlus}
          iconColor="text-blue-600"
          variant="info"
        />
        <ReportCard
          title="Valor Total Investido"
          value={formatCurrency(totalValue)}
          subtitle="Soma de todas as entradas"
          icon={DollarSign}
          iconColor="text-green-600"
          variant="success"
        />
        <ReportCard
          title="Valor Médio por Entrada"
          value={formatCurrency(avgValue)}
          subtitle="Média de investimento"
          icon={TrendingUp}
          iconColor="text-purple-600"
          variant="default"
        />
        <ReportCard
          title="Fornecedor Principal"
          value={topSupplier ? topSupplier[0] : 'N/A'}
          subtitle={topSupplier ? `${topSupplier[1]} entradas` : 'Sem dados'}
          icon={Package}
          iconColor="text-orange-600"
          variant="warning"
        />
      </div>

      <ReportTable
        columns={columns}
        data={paginatedData}
        loading={loading}
        emptyMessage="Nenhuma entrada encontrada no período selecionado"
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
