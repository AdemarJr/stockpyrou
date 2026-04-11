import React, { useMemo, useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Package, DollarSign, ShoppingCart, AlertCircle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import type { Product, StockMovement, Recipe } from '../types';
import { formatCurrency, formatPercentage, getExpirationColor, getStockStatus } from '../utils/calculations';
import { isExitConsumption, lineCostAtMovement } from '../utils/stockMovementFilters';

interface DashboardProps {
  products: Product[];
  movements: StockMovement[];
  recipes: Recipe[];
}

type DashboardPeriod = '7d' | '30d' | '90d' | 'ytd' | 'all';

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Início do período (00:00 horário local). `all` = sem filtro. */
function periodStartDate(period: DashboardPeriod): Date | null {
  const today0 = startOfLocalDay(new Date());
  if (period === 'all') return null;
  const d = new Date(today0);
  if (period === '7d') {
    d.setDate(d.getDate() - 7);
  } else if (period === '30d') {
    d.setDate(d.getDate() - 30);
  } else if (period === '90d') {
    d.setDate(d.getDate() - 90);
  } else if (period === 'ytd') {
    d.setMonth(0, 1);
  }
  return d;
}

function movementInPeriod(m: StockMovement, rangeStart: Date | null): boolean {
  if (rangeStart === null) return true;
  return new Date(m.date).getTime() >= rangeStart.getTime();
}

const PERIOD_LABEL: Record<DashboardPeriod, string> = {
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '90d': 'Últimos 90 dias',
  ytd: 'Ano atual',
  all: 'Todo o período',
};

export function Dashboard({ products, movements, recipes }: DashboardProps) {
  const [period, setPeriod] = useState<DashboardPeriod>('30d');

  const rangeStart = useMemo(() => periodStartDate(period), [period]);

  const movementsInPeriod = useMemo(
    () => movements.filter((m) => movementInPeriod(m, rangeStart)),
    [movements, rangeStart],
  );

  // Valor em estoque ao custo (CMP): Σ (estoque atual × custo médio). Snapshot atual — não muda com o período.
  const totalStockValue = products.reduce((sum, p) => sum + (p.currentStock * p.averageCost), 0);
  const potentialSalesValue = products.reduce((sum, p) => sum + (p.currentStock * (p.sellingPrice || 0)), 0);
  const potentialProfit = potentialSalesValue - totalStockValue;
  /** Alinha com Lucro Potencial: margem % sobre o valor de venda do estoque atual (ponderada). */
  const marginOnCurrentStockPct =
    potentialSalesValue > 0 ? ((potentialSalesValue - totalStockValue) / potentialSalesValue) * 100 : 0;

  const productsWithStock = products.filter((p) => (p.currentStock || 0) > 0).length;
  const productsWithStockAndCost = products.filter(
    (p) => (p.currentStock || 0) > 0 && (p.averageCost || 0) > 0,
  ).length;
  const productsWithStockButNoCost = products.filter(
    (p) => (p.currentStock || 0) > 0 && !(p.averageCost || 0),
  ).length;

  const periodWasteMovements = movementsInPeriod.filter((m) => m.type === 'desperdicio');
  const periodWaste = periodWasteMovements.reduce(
    (sum, m) => sum + lineCostAtMovement(m, products),
    0,
  );
  const periodWastePercentage = totalStockValue > 0 ? (periodWaste / totalStockValue) * 100 : 0;

  const periodExitMovements = movementsInPeriod.filter(isExitConsumption);
  const periodExitUnits = periodExitMovements.reduce(
    (sum, m) => sum + (Number(m.quantity) || 0),
    0,
  );
  const periodExitsCost = periodExitMovements.reduce(
    (sum, m) => sum + lineCostAtMovement(m, products),
    0,
  );
  const periodExitsRevenueEstimate = periodExitMovements.reduce((sum, m) => {
    const p = products.find((x) => x.id === m.productId);
    const q = Number(m.quantity) || 0;
    return sum + q * (p?.sellingPrice ?? 0);
  }, 0);

  const periodEntryMovements = movementsInPeriod.filter((m) => m.type === 'entrada');
  const periodEntriesValue = periodEntryMovements.reduce(
    (sum, m) => sum + lineCostAtMovement(m, products),
    0,
  );
  
  const lowStockItems = products.filter(p => {
    const status = getStockStatus(p.currentStock, p.minStock, p.safetyStock);
    return status === 'critical' || status === 'low';
  }).length;
  
  const expiringItems = products.filter(p => p.isPerishable).length;
  
  // Top 5 most sold items (by movement) no período selecionado
  const productSales = movementsInPeriod
    .filter(isExitConsumption)
    .reduce((acc, m) => {
      acc[m.productId] = (acc[m.productId] || 0) + m.quantity;
      return acc;
    }, {} as Record<string, number>);
  
  const topSoldItems = Object.entries(productSales)
    .map(([productId, quantity]) => {
      const product = products.find(p => p.id === productId);
      return { name: product?.name || 'Unknown', quantity };
    })
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);
  
  // Items expiring soon
  const expiringProducts = products
    .filter(p => p.isPerishable)
    .map(p => {
      // Mock expiration dates for demo
      const daysUntil = Math.floor(Math.random() * 45);
      return { ...p, daysUntilExpiration: daysUntil };
    })
    .sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration)
    .slice(0, 5);
  
  // Stock status distribution
  const stockStatusData = products.reduce((acc, product) => {
    const status = getStockStatus(product.currentStock, product.minStock, product.safetyStock);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Use CSS variables for chart colors (compatible with Recharts)
  const getChartColor = (index: number) => {
    if (typeof window !== 'undefined') {
      const style = getComputedStyle(document.documentElement);
      return style.getPropertyValue(`--chart-${index}`).trim() || 
             ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'][index - 1];
    }
    return ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'][index - 1];
  };

  const stockDistribution = [
    { name: 'Crítico', value: stockStatusData.critical || 0, color: getChartColor(1) },
    { name: 'Baixo', value: stockStatusData.low || 0, color: getChartColor(2) },
    { name: 'Adequado', value: stockStatusData.adequate || 0, color: getChartColor(3) },
    { name: 'Alto', value: stockStatusData.high || 0, color: getChartColor(4) },
  ];
  
  // Recipe margins
  const recipeMarginData = recipes
    .sort((a, b) => b.profitMargin - a.profitMargin)
    .slice(0, 8)
    .map(r => ({
      name: r.name.length > 20 ? r.name.substring(0, 20) + '...' : r.name,
      margin: r.profitMargin,
    }));
  
  return (
    <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl md:text-2xl dark:text-white">Dashboard Executivo</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
            Visão geral do estoque (atual) e das movimentações no período escolhido.
          </p>
        </div>
        <div className="flex flex-col gap-1 sm:items-end">
          <label htmlFor="dashboard-period" className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Período (movimentações)
          </label>
          <select
            id="dashboard-period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
            className="text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 min-w-[200px]"
          >
            <option value="7d">{PERIOD_LABEL['7d']}</option>
            <option value="30d">{PERIOD_LABEL['30d']}</option>
            <option value="90d">{PERIOD_LABEL['90d']}</option>
            <option value="ytd">{PERIOD_LABEL.ytd}</option>
            <option value="all">{PERIOD_LABEL.all}</option>
          </select>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 pt-2 border-t border-gray-200 dark:border-gray-700">
        Estoque atual
        <span className="font-normal text-gray-500 dark:text-gray-400 ml-2">(não muda ao trocar o período)</span>
      </h3>
      
      {/* KPI Cards — snapshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Stock Value */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">Valor Total (Custo)</p>
              <p className="mt-1 text-lg md:text-2xl font-bold dark:text-white">{formatCurrency(totalStockValue)}</p>
              <p className="mt-2 text-[11px] md:text-xs text-gray-500 dark:text-gray-400 leading-snug max-w-[260px]">
                Soma de <strong className="font-medium text-gray-600 dark:text-gray-300">estoque × custo médio</strong> (CMP).
                {products.length > 0 && (
                  <>
                    {' '}
                    {productsWithStockAndCost} de {products.length} cadastros têm estoque e custo &gt; 0
                    {productsWithStockButNoCost > 0 && (
                      <span className="text-amber-700 dark:text-amber-300">
                        {' '}
                        · {productsWithStockButNoCost} com estoque mas custo zerado (não entram no valor)
                      </span>
                    )}
                    .
                  </>
                )}
              </p>
            </div>
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded-full p-2 md:p-3">
              <Package className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* Potential Sales Value */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">Potencial Venda</p>
              <p className="mt-1 text-lg md:text-2xl font-bold text-blue-700 dark:text-blue-400">{formatCurrency(potentialSalesValue)}</p>
            </div>
            <div className="bg-indigo-100 dark:bg-indigo-900/30 rounded-full p-2 md:p-3">
              <ShoppingCart className="w-5 h-5 md:w-6 md:h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </div>

        {/* Potential Profit */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">Lucro Potencial</p>
              <p className="mt-1 text-lg md:text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(potentialProfit)}</p>
            </div>
            <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-2 md:p-3">
              <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>
        
        {/* Margem coerente com Lucro Potencial */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">Margem no estoque</p>
              <p className="mt-1 text-lg md:text-2xl font-bold dark:text-white">
                {formatPercentage(marginOnCurrentStockPct)}
              </p>
              <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                Mesma base do Lucro Potencial: (Potencial Venda − Custo) / Potencial Venda.
              </p>
            </div>
            <div className="bg-orange-100 dark:bg-orange-900/30 rounded-full p-2 md:p-3">
              <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>

      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 pt-4">
        Atividade no período: {PERIOD_LABEL[period]}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-indigo-200 dark:border-indigo-800 p-4 md:p-6 shadow-sm">
          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">Saídas (unidades)</p>
          <p className="mt-1 text-xl md:text-2xl font-bold dark:text-white">
            {periodExitUnits.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
            Saídas manuais + vendas PDV (sem desperdício, tipo próprio).
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-indigo-200 dark:border-indigo-800 p-4 md:p-6 shadow-sm">
          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">Custo das saídas</p>
          <p className="mt-1 text-xl md:text-2xl font-bold dark:text-white">{formatCurrency(periodExitsCost)}</p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
            Soma dos valores das saídas (total no movimento ou qtd × CMP).
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-indigo-200 dark:border-indigo-800 p-4 md:p-6 shadow-sm">
          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">Receita estimada (saídas)</p>
          <p className="mt-1 text-xl md:text-2xl font-bold text-blue-700 dark:text-blue-300">
            {formatCurrency(periodExitsRevenueEstimate)}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
            Qtd × preço de venda cadastrado (referência; não substitui relatório fiscal).
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-indigo-200 dark:border-indigo-800 p-4 md:p-6 shadow-sm">
          <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">Entradas (valor)</p>
          <p className="mt-1 text-xl md:text-2xl font-bold dark:text-emerald-600 dark:text-emerald-400">
            {formatCurrency(periodEntriesValue)}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">Movimentos tipo entrada no período.</p>
        </div>
      </div>
      
      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Desperdício no período */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-xs uppercase font-bold">Desperdício</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{PERIOD_LABEL[period]}</p>
              <p className="mt-1 font-bold dark:text-white">{formatCurrency(periodWaste)}</p>
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">
                {formatPercentage(periodWastePercentage)} do valor em estoque (hoje)
              </p>
            </div>
            <TrendingDown className="w-5 h-5 text-red-500 dark:text-red-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-xs uppercase font-bold">Movimentos no período</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{PERIOD_LABEL[period]}</p>
              <p className="mt-1 font-bold dark:text-white">{movementsInPeriod.length}</p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">Registros filtrados</p>
            </div>
            <Package className="w-5 h-5 text-gray-400" />
          </div>
        </div>
        
        {/* Low Stock Items */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-xs uppercase font-bold">Itens em Falta</p>
              <p className="mt-1 font-bold dark:text-white">{lowStockItems} produtos</p>
              {lowStockItems > 0 && (
                <p className="text-orange-600 dark:text-orange-400 text-xs mt-1">Requer atenção</p>
              )}
            </div>
            <AlertTriangle className="w-5 h-5 text-orange-500 dark:text-orange-400" />
          </div>
        </div>

        {/* Expiring Items */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-xs uppercase font-bold">Perecíveis Ativos</p>
              <p className="mt-1 font-bold dark:text-white">{expiringItems} produtos</p>
            </div>
            <AlertCircle className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-xs uppercase font-bold">Lucro estimado (saídas no período)</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{PERIOD_LABEL[period]}</p>
              <p className="mt-1 font-bold text-green-700 dark:text-green-400">
                {formatCurrency(periodExitsRevenueEstimate - periodExitsCost)}
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                Receita estimada − custo das saídas
              </p>
            </div>
            <TrendingUp className="w-5 h-5 text-green-500 dark:text-green-400" />
          </div>
        </div>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Most Sold */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="mb-1">Top 5 Itens Mais Vendidos</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{PERIOD_LABEL[period]}</p>
          {topSoldItems.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topSoldItems}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  interval={0}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="quantity" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-400 dark:text-gray-500">
              Sem dados de venda ainda
            </div>
          )}
        </div>
        
        {/* Stock Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="mb-4">Distribuição de Status do Estoque</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stockDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${entry.value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {stockDistribution.map((entry, index) => (
                  <Cell key={`stock-cell-${entry.name}-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Recipe Margins Chart */}
      {recipeMarginData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="mb-4">Margem de Lucro por Receita</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={recipeMarginData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={120}
                interval={0}
              />
              <YAxis label={{ value: 'Margem (%)', angle: -90, position: 'insideLeft' }} />
              <Tooltip formatter={(value: number) => `${value.toFixed(1)}%`} />
              <Bar dataKey="margin" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring Products */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-orange-500 dark:text-orange-400" />
            Produtos Próximos ao Vencimento
          </h3>
          <div className="space-y-3">
            {expiringProducts.map((product) => {
              const color = getExpirationColor(product.daysUntilExpiration);
              const bgColor = 
                color === 'red' ? 'bg-red-50 border-red-200' :
                color === 'yellow' ? 'bg-yellow-50 border-yellow-200' :
                'bg-green-50 border-green-200';
              const textColor =
                color === 'red' ? 'text-red-700' :
                color === 'yellow' ? 'text-yellow-700' :
                'text-green-700';
              
              return (
                <div key={product.id} className={`p-3 rounded border ${bgColor}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p>{product.name}</p>
                      <p className="text-gray-600 mt-1">
                        Estoque: {product.currentStock} {product.measurementUnit}
                      </p>
                    </div>
                    <div className={`text-right ${textColor}`}>
                      <p>
                        {product.daysUntilExpiration === 0 ? 'Hoje' :
                         product.daysUntilExpiration === 1 ? 'Amanhã' :
                         `${product.daysUntilExpiration} dias`}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500 dark:text-orange-400" />
            Alertas de Estoque Baixo
          </h3>
          <div className="space-y-3">
            {products
              .filter(p => {
                const status = getStockStatus(p.currentStock, p.minStock, p.safetyStock);
                return status === 'critical' || status === 'low';
              })
              .slice(0, 5)
              .map((product) => {
                const status = getStockStatus(product.currentStock, product.minStock, product.safetyStock);
                const isCritical = status === 'critical';
                
                return (
                  <div 
                    key={product.id} 
                    className={`p-3 rounded border ${
                      isCritical ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p>{product.name}</p>
                        <p className="text-gray-600 mt-1">
                          Atual: {product.currentStock} | Mínimo: {product.minStock} {product.measurementUnit}
                        </p>
                      </div>
                      <div className={`text-right ${isCritical ? 'text-red-700' : 'text-orange-700'}`}>
                        <p>
                          {isCritical ? 'Crítico' : 'Baixo'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            {products.filter(p => {
              const status = getStockStatus(p.currentStock, p.minStock, p.safetyStock);
              return status === 'critical' || status === 'low';
            }).length === 0 && (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500 flex flex-col items-center gap-2">
                <CheckCircle className="w-12 h-12" />
                <p>Todos os produtos com estoque adequado!</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:bg-gradient-to-r dark:from-blue-900 dark:to-indigo-900 rounded-lg border border-blue-200 dark:border-blue-700 p-6">
        <h3 className="mb-1">Resumo</h3>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">Desperdício no período: {PERIOD_LABEL[period]}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-gray-600 dark:text-gray-400">Total Desperdiçado</p>
            <p className="mt-1">{formatCurrency(periodWaste)}</p>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{formatPercentage(periodWastePercentage)} do valor em estoque</p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Produtos Cadastrados</p>
            <p className="mt-1">{products.length} itens</p>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {productsWithStock} com estoque &gt; 0 · {productsWithStockAndCost} com estoque e custo para o valor em estoque
            </p>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{products.filter(p => p.isPerishable).length} perecíveis</p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Receitas Ativas</p>
            <p className="mt-1">{recipes.filter(r => r.isActive).length} receitas</p>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Margem no estoque: {formatPercentage(marginOnCurrentStockPct)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}