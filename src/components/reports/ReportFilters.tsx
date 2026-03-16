import React from 'react';
import { Filter, X, Calendar, Search, Package, Users } from 'lucide-react';

interface Period Preset {
  label: string;
  value: string;
  getDates: () => { start: string; end: string };
}

interface ReportFiltersProps {
  startDate: string;
  endDate: string;
  searchQuery: string;
  selectedSupplier: string;
  selectedCategory: string;
  selectedProduct: string;
  showFilters: boolean;
  suppliers: any[];
  categories: string[];
  products: any[];
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onSearchChange: (query: string) => void;
  onSupplierChange: (supplier: string) => void;
  onCategoryChange: (category: string) => void;
  onProductChange: (product: string) => void;
  onToggleFilters: () => void;
  onClearFilters: () => void;
}

export function ReportFilters({
  startDate,
  endDate,
  searchQuery,
  selectedSupplier,
  selectedCategory,
  selectedProduct,
  showFilters,
  suppliers,
  categories,
  products,
  onStartDateChange,
  onEndDateChange,
  onSearchChange,
  onSupplierChange,
  onCategoryChange,
  onProductChange,
  onToggleFilters,
  onClearFilters,
}: ReportFiltersProps) {
  
  const periodPresets: PeriodPreset[] = [
    {
      label: 'Hoje',
      value: 'today',
      getDates: () => {
        const today = new Date().toISOString().split('T')[0];
        return { start: today, end: today };
      }
    },
    {
      label: 'Últimos 7 dias',
      value: 'last7days',
      getDates: () => {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date();
        start.setDate(start.getDate() - 7);
        return { start: start.toISOString().split('T')[0], end };
      }
    },
    {
      label: 'Últimos 30 dias',
      value: 'last30days',
      getDates: () => {
        const end = new Date().toISOString().split('T')[0];
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return { start: start.toISOString().split('T')[0], end };
      }
    },
    {
      label: 'Este mês',
      value: 'thisMonth',
      getDates: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const end = new Date().toISOString().split('T')[0];
        return { start, end };
      }
    },
  ];

  const applyPreset = (preset: PeriodPreset) => {
    const dates = preset.getDates();
    onStartDateChange(dates.start);
    onEndDateChange(dates.end);
  };

  const hasActiveFilters = selectedSupplier !== 'all' || selectedCategory !== 'all' || selectedProduct !== 'all' || searchQuery !== '';

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-600" />
          <h3 className="font-semibold text-gray-900">Filtros</h3>
          {hasActiveFilters && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full font-medium">
              Ativos
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="text-sm text-gray-600 hover:text-gray-900 flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
          )}
          <button
            onClick={onToggleFilters}
            className="lg:hidden text-gray-600 hover:text-gray-900 p-1 rounded hover:bg-gray-100"
          >
            {showFilters ? <X className="w-5 h-5" /> : <Filter className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Filters Content */}
      <div className={`p-4 space-y-4 ${!showFilters && 'hidden lg:block'}`}>
        {/* Period Presets */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">
            Período Rápido
          </label>
          <div className="flex flex-wrap gap-2">
            {periodPresets.map((preset) => (
              <button
                key={preset.value}
                onClick={() => applyPreset(preset)}
                className="px-3 py-1.5 text-sm font-medium bg-gray-100 hover:bg-blue-50 hover:text-blue-700 text-gray-700 rounded-lg transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Data Início
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900 bg-white"
              style={{ color: '#111827', backgroundColor: '#ffffff' }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              Data Fim
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900 bg-white"
              style={{ color: '#111827', backgroundColor: '#ffffff' }}
            />
          </div>
        </div>

        {/* Search */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1">
            <Search className="w-4 h-4" />
            Buscar
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="Digite para buscar..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900 bg-white placeholder-gray-400"
              style={{ color: '#111827', backgroundColor: '#ffffff' }}
            />
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter */}
        {categories.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1">
              <Package className="w-4 h-4" />
              Categoria
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900 bg-white"
              style={{ color: '#111827', backgroundColor: '#ffffff' }}
            >
              <option value="all">Todas as categorias</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        )}

        {/* Supplier Filter */}
        {suppliers.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1">
              <Users className="w-4 h-4" />
              Fornecedor
            </label>
            <select
              value={selectedSupplier}
              onChange={(e) => onSupplierChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900 bg-white"
              style={{ color: '#111827', backgroundColor: '#ffffff' }}
            >
              <option value="all">Todos os fornecedores</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Product Filter */}
        {products.length > 0 && products.length < 100 && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase mb-2 flex items-center gap-1">
              <Package className="w-4 h-4" />
              Produto
            </label>
            <select
              value={selectedProduct}
              onChange={(e) => onProductChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow text-gray-900 bg-white"
              style={{ color: '#111827', backgroundColor: '#ffffff' }}
            >
              <option value="all">Todos os produtos</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}