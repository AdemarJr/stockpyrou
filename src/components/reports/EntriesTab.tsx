import React from 'react';
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
}

export function EntriesTab({ data, loading, currentPage, itemsPerPage, onPageChange }: EntriesTabProps) {
  
  // Calculate summary metrics
  const totalEntries = data.length;
  const totalValue = data.reduce((sum, entry) => sum + entry.totalPrice, 0);
  const avgValue = totalEntries > 0 ? totalValue / totalEntries : 0;
  
  // Get top supplier
  const supplierCounts = data.reduce((acc, entry) => {
    acc[entry.supplierName] = (acc[entry.supplierName] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const topSupplier = Object.entries(supplierCounts).sort(([,a], [,b]) => b - a)[0];

  // Paginate data
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(data.length / itemsPerPage);

  // Table columns
  const columns = [
    {
      key: 'entryDate',
      label: 'Data',
      sortable: true,
      render: (value: any) => formatDate(value),
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
      render: (value: any) => value ? formatDate(value) : '-',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
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

      {/* Entries Table */}
      <ReportTable
        columns={columns}
        data={paginatedData}
        loading={loading}
        emptyMessage="Nenhuma entrada encontrada no período selecionado"
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        showPagination={totalPages > 1}
      />
    </div>
  );
}
