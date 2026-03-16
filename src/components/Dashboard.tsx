import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Package, DollarSign, ShoppingCart, AlertCircle, CheckCircle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import type { Product, StockMovement, Recipe } from '../types';
import { formatCurrency, formatPercentage, getDaysUntilExpiration, getExpirationColor, getStockStatus } from '../utils/calculations';

interface DashboardProps {
  products: Product[];
  movements: StockMovement[];
  recipes: Recipe[];
}

export function Dashboard({ products, movements, recipes }: DashboardProps) {
  // Calculate KPIs
  const totalStockValue = products.reduce((sum, p) => sum + (p.currentStock * p.averageCost), 0);
  const potentialSalesValue = products.reduce((sum, p) => sum + (p.currentStock * (p.sellingPrice || 0)), 0);
  const potentialProfit = potentialSalesValue - totalStockValue;
  
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  const weeklyWasteMovements = movements.filter(
    m => m.type === 'desperdicio' && new Date(m.date) >= weekAgo
  );
  const weeklyWaste = weeklyWasteMovements.reduce((sum, m) => sum + (m.cost || 0), 0);
  
  const monthlyWasteMovements = movements.filter(
    m => m.type === 'desperdicio' && new Date(m.date) >= monthAgo
  );
  const monthlyWaste = monthlyWasteMovements.reduce((sum, m) => sum + (m.cost || 0), 0);
  
  const weeklyWastePercentage = totalStockValue > 0 ? (weeklyWaste / totalStockValue) * 100 : 0;
  const monthlyWastePercentage = totalStockValue > 0 ? (monthlyWaste / totalStockValue) * 100 : 0;
  
  const lowStockItems = products.filter(p => {
    const status = getStockStatus(p.currentStock, p.minStock, p.safetyStock);
    return status === 'critical' || status === 'low';
  }).length;
  
  const expiringItems = products.filter(p => p.isPerishable).length;
  
  const averageMargin = recipes.length > 0
    ? recipes.reduce((sum, r) => sum + r.profitMargin, 0) / recipes.length
    : products.filter(p => (p.sellingPrice || 0) > 0).length > 0
      ? products.filter(p => (p.sellingPrice || 0) > 0).reduce((sum, p) => {
          const margin = ((p.sellingPrice! - p.averageCost) / p.sellingPrice!) * 100;
          return sum + margin;
        }, 0) / products.filter(p => (p.sellingPrice || 0) > 0).length
      : 0;
  
  // Top 5 most sold items (by movement)
  const productSales = movements
    .filter(m => m.type === 'saida' && !m.wasteReason)
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
      <div>
        <h2 className="text-xl md:text-2xl dark:text-white">Dashboard Executivo</h2>
        <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Visão geral do seu estoque e operação</p>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Stock Value */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">Valor Total (Custo)</p>
              <p className="mt-1 text-lg md:text-2xl font-bold dark:text-white">{formatCurrency(totalStockValue)}</p>
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
        
        {/* Average Margin */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 md:p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">Margem Média</p>
              <p className="mt-1 text-lg md:text-2xl font-bold dark:text-white">{formatPercentage(averageMargin)}</p>
            </div>
            <div className="bg-orange-100 dark:bg-orange-900/30 rounded-full p-2 md:p-3">
              <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>
      
      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Weekly Waste */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-xs uppercase font-bold">Desperdício Semanal</p>
              <p className="mt-1 font-bold dark:text-white">{formatCurrency(weeklyWaste)}</p>
              <p className="text-red-600 dark:text-red-400 text-xs mt-1">{formatPercentage(weeklyWastePercentage)} do estoque</p>
            </div>
            <TrendingDown className="w-5 h-5 text-red-500 dark:text-red-400" />
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

        {/* Total Profit % */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-xs uppercase font-bold">Lucratividade Geral</p>
              <p className="mt-1 font-bold">
                {potentialSalesValue > 0 ? (((potentialSalesValue - totalStockValue) / potentialSalesValue) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-green-600 dark:text-green-400 text-xs mt-1">Margem média ponderada</p>
            </div>
            <TrendingUp className="w-5 h-5 text-green-500 dark:text-green-400" />
          </div>
        </div>
      </div>
      
      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Most Sold */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="mb-4">Top 5 Itens Mais Vendidos</h3>
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
        <h3 className="mb-4">Resumo do Mês</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-gray-600 dark:text-gray-400">Total Desperdiçado</p>
            <p className="mt-1">{formatCurrency(monthlyWaste)}</p>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{formatPercentage(monthlyWastePercentage)} do estoque</p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Produtos Cadastrados</p>
            <p className="mt-1">{products.length} itens</p>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{products.filter(p => p.isPerishable).length} perecíveis</p>
          </div>
          <div>
            <p className="text-gray-600 dark:text-gray-400">Receitas Ativas</p>
            <p className="mt-1">{recipes.filter(r => r.isActive).length} receitas</p>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Margem média: {formatPercentage(averageMargin)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}