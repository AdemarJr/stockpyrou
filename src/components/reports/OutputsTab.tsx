import React from 'react';
import { PackageX, TrendingDown, Package, AlertCircle } from 'lucide-react';
import { ReportCard } from './ReportCard';
import { ReportTable } from './ReportTable';
import { formatCurrency, formatDate } from '../../utils/calculations';
import type { StockMovement, Product } from '../../types';

interface OutputsTabProps {
  movements: StockMovement[];
  products: Product[];
  loading?: boolean;
  currentPage: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export function OutputsTab({ movements, products, loading = false, currentPage, itemsPerPage, onPageChange }: OutputsTabProps) {
  
  // Filter only output movements (saida, venda, desperdicio)
  const outputMovements = movements.filter(m => 
    m.type === 'saida' || m.type === 'venda' || m.type === 'desperdicio'
  );

  // Calculate summary metrics
  const totalOutputs = outputMovements.length;
  const totalQuantity = outputMovements.reduce((sum, m) => sum + m.quantity, 0);
  const totalValue = outputMovements.reduce((sum, m) => {
    const product = products.find(p => p.id === m.productId);
    const value = product ? m.quantity * product.averageCost : 0;
    return sum + value;
  }, 0);

  // Count by type
  const byType = outputMovements.reduce((acc, m) => {
    acc[m.type] = (acc[m.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get most moved product
  const productCounts = outputMovements.reduce((acc, m) => {
    const product = products.find(p => p.id === m.productId);
    if (product) {
      acc[product.name] = (acc[product.name] || 0) + m.quantity;
    }
    return acc;
  }, {} as Record<string, number>);
  const mostMoved = Object.entries(productCounts).sort(([,a], [,b]) => b - a)[0];

  // Paginate data
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = outputMovements.slice(startIndex, startIndex + itemsPerPage);
  const totalPages = Math.ceil(outputMovements.length / itemsPerPage);

  // Table columns
  const columns = [
    {
      key: 'date',
      label: 'Data',
      sortable: true,
      render: (value: any) => formatDate(value),
    },
    {
      key: 'type',
      label: 'Tipo',
      sortable: true,
      render: (value: string) => {
        const types: Record<string, { label: string; color: string }> = {
          saida: { label: 'Saída', color: 'bg-blue-100 text-blue-700' },
          venda: { label: 'Venda', color: 'bg-green-100 text-green-700' },
          desperdicio: { label: 'Desperdício', color: 'bg-red-100 text-red-700' },
        };
        const type = types[value] || { label: value, color: 'bg-gray-100 text-gray-700' };
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
        const product = products.find(p => p.id === value);
        return product?.name || 'Produto desconhecido';
      },
    },
    {
      key: 'quantity',
      label: 'Quantidade',
      sortable: true,
      render: (value: number, row: StockMovement) => {
        const product = products.find(p => p.id === row.productId);
        return `${value} ${product?.measurementUnit || 'un'}`;
      },
    },
    {
      key: 'cost',
      label: 'Valor Estimado',
      sortable: true,
      render: (value: any, row: StockMovement) => {
        const product = products.find(p => p.id === row.productId);
        const estimatedValue = product ? row.quantity * product.averageCost : 0;
        return formatCurrency(estimatedValue);
      },
    },
    {
      key: 'reason',
      label: 'Motivo',
      render: (value: any) => value || '-',
    },
    {
      key: 'userId',
      label: 'Usuário',
      render: (value: any) => value || 'Sistema',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ReportCard
          title="Total de Saídas"
          value={totalOutputs}
          subtitle="Movimentações no período"
          icon={PackageX}
          iconColor="text-red-600"
          variant="danger"
        />
        <ReportCard
          title="Quantidade Total"
          value={totalQuantity.toFixed(2)}
          subtitle="Unidades movimentadas"
          icon={TrendingDown}
          iconColor="text-orange-600"
          variant="warning"
        />
        <ReportCard
          title="Valor Total Estimado"
          value={formatCurrency(totalValue)}
          subtitle="Custo das saídas"
          icon={Package}
          iconColor="text-purple-600"
          variant="default"
        />
        <ReportCard
          title="Produto Mais Movido"
          value={mostMoved ? mostMoved[0] : 'N/A'}
          subtitle={mostMoved ? `${mostMoved[1].toFixed(2)} unidades` : 'Sem dados'}
          icon={AlertCircle}
          iconColor="text-blue-600"
          variant="info"
        />
      </div>

      {/* Breakdown by Type */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Distribuição por Tipo</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700 font-medium">Saídas</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{byType.saida || 0}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <p className="text-sm text-green-700 font-medium">Vendas</p>
            <p className="text-2xl font-bold text-green-900 mt-1">{byType.venda || 0}</p>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <p className="text-sm text-red-700 font-medium">Desperdícios</p>
            <p className="text-2xl font-bold text-red-900 mt-1">{byType.desperdicio || 0}</p>
          </div>
        </div>
      </div>

      {/* Outputs Table */}
      <ReportTable
        columns={columns}
        data={paginatedData}
        loading={loading}
        emptyMessage="Nenhuma saída encontrada no período selecionado"
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange}
        showPagination={totalPages > 1}
      />
    </div>
  );
}
