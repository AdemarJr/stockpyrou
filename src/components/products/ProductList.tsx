import React, { useState, useMemo } from 'react';
import { Package, Search, Plus, Edit2, AlertCircle, TrendingUp, TrendingDown, Trash2, Eye, MinusCircle, MoreVertical, Upload, Copy } from 'lucide-react';
import type { Product } from '../../types';
import { formatCurrency, getStockStatus } from '../../utils/calculations';
import { EmptyState } from '../EmptyState';
import { StockAdjustmentModal } from '../inventory/StockAdjustmentModal';
import { ProductImport } from './ProductImport';
import { useIsMobile } from '../ui/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { ListPaginationBar } from '../ui/list-pagination-bar';
import { usePagination } from '../../hooks/usePagination';

const CATEGORY_LABELS: Record<string, string> = {
  alimento: 'Alimento',
  bebida: 'Bebida',
  descartavel: 'Descartável',
  limpeza: 'Limpeza',
  outro: 'Outro',
};

interface ProductListProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onView: (product: Product) => void;
  onAdd: () => void;
  onDuplicate?: (product: Product) => void;
  onBulkImport?: () => void;
  onImportFromFile?: (products: any[]) => void;
  categories: any[];
  canDelete: boolean;
}

export function ProductList({ products, onEdit, onDelete, onView, onAdd, onDuplicate, onBulkImport, onImportFromFile, categories, canDelete }: ProductListProps) {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const q = searchTerm.toLowerCase();
        const catLabel = CATEGORY_LABELS[product.category] || product.category;
        const matchesSearch =
          product.name.toLowerCase().includes(q) ||
          !!product.barcode?.toLowerCase().includes(q) ||
          catLabel.toLowerCase().includes(q) ||
          product.measurementUnit.toLowerCase().includes(q);
        const matchesCategory = categoryFilter === 'all' || product.category === categoryFilter;

        let matchesStatus = true;
        if (statusFilter !== 'all') {
          const status = getStockStatus(product.currentStock, product.minStock, product.safetyStock);
          matchesStatus = status === statusFilter;
        }

        return matchesSearch && matchesCategory && matchesStatus;
      }),
    [products, searchTerm, categoryFilter, statusFilter]
  );

  const filterKey = `${searchTerm}|${categoryFilter}|${statusFilter}`;
  const {
    paginatedItems,
    page,
    setPage,
    totalPages,
    from,
    to,
    total: filteredTotal
  } = usePagination(filteredProducts, 15, filterKey);
  
  // Get unique categories
  const uniqueCategories = Array.from(new Set(products.map(p => p.category)));
  
  const getStatusBadge = (product: Product) => {
    const status = getStockStatus(product.currentStock, product.minStock, product.safetyStock);
    
    switch (status) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded">
            <AlertCircle className="w-3 h-3" />
            Crítico
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded">
            <TrendingDown className="w-3 h-3" />
            Baixo
          </span>
        );
      case 'adequate':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded">
            <Package className="w-3 h-3" />
            Adequado
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded">
            <TrendingUp className="w-3 h-3" />
            Alto
          </span>
        );
    }
  };
  
  const getCategoryLabel = (category: string) => CATEGORY_LABELS[category] || category;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2>Gestão de Produtos</h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado
            {filteredProducts.length !== 1 ? 's' : ''}
            {filteredProducts.length > 15 ? ` (exibindo ${from}–${to})` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          {onImportFromFile && (
            <button
              onClick={() => setImportDialogOpen(true)}
              className="flex-1 md:flex-none bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 transition-colors"
              title="Importar produtos via CSV ou XML da NF-e"
            >
              <Upload className="w-5 h-5" />
              <span className="hidden sm:inline">Importar NF-e</span>
            </button>
          )}
          <button
            onClick={onAdd}
            className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Novo Produto</span>
          </button>
        </div>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Nome, código de barras, categoria ou unidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todas as Categorias</option>
            {uniqueCategories.map(cat => (
              <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
            ))}
          </select>
          
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Todos os Status</option>
            <option value="critical">Crítico</option>
            <option value="low">Baixo</option>
            <option value="adequate">Adequado</option>
            <option value="high">Alto</option>
          </select>
        </div>
      </div>
      
      {/* Products Table or Card List */}
      {products.length === 0 ? (
        <EmptyState
          title="Nenhum produto cadastrado"
          description="Comece adicionando produtos ao seu estoque ou importe dados de demonstração"
          type="products"
        />
      ) : isMobile ? (
        <div className="space-y-4">
          {paginatedItems.map((product) => {
            const statusBadge = getStatusBadge(product);
            return (
              <div key={product.id} className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 truncate">{product.name}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{product.barcode || 'Sem código'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {statusBadge}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onView(product)}>
                          <Eye className="w-4 h-4 mr-2" /> Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAdjustingProduct(product)}>
                          <MinusCircle className="w-4 h-4 mr-2" /> Baixa/Perda
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onEdit(product)}>
                          <Edit2 className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        {onDuplicate && (
                          <DropdownMenuItem onClick={() => onDuplicate(product)}>
                            <Copy className="w-4 h-4 mr-2" /> Duplicar
                          </DropdownMenuItem>
                        )}
                        {canDelete && (
                          <DropdownMenuItem onClick={() => onDelete(product)} className="text-red-600">
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 py-3 border-t border-b border-gray-100 my-3">
                   <div>
                      <p className="text-[10px] uppercase font-bold text-gray-400">Estoque</p>
                      <p className="text-sm font-bold">{product.currentStock} {product.measurementUnit}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Custo Médio</p>
                      <p className="text-sm font-bold">{formatCurrency(product.averageCost)}</p>
                   </div>
                   <div>
                      <p className="text-[10px] uppercase font-bold text-gray-400">Preço Venda</p>
                      <p className="text-sm font-bold text-blue-600">{formatCurrency(product.sellingPrice || 0)}</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Lucro Unit.</p>
                      <p className="text-sm font-bold text-green-600">
                        {product.sellingPrice ? formatCurrency(product.sellingPrice - product.averageCost) : '-'}
                      </p>
                   </div>
                </div>
                
                <div className="flex items-center justify-between text-[11px]">
                   <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                     {getCategoryLabel(product.category)}
                   </span>
                   {product.isPerishable && (
                      <span className="text-yellow-600 font-medium">Perecível</span>
                   )}
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum produto encontrado</p>
            </div>
          )}
          {filteredProducts.length > 0 && (
            <ListPaginationBar
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              from={from}
              to={to}
              total={filteredTotal}
            />
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-gray-600">Produto</th>
                  <th className="px-6 py-3 text-left text-gray-600">Categoria</th>
                  <th className="px-6 py-3 text-right text-gray-600">Estoque Atual</th>
                  <th className="px-6 py-3 text-right text-gray-600">Estoque Mín.</th>
                  <th className="px-6 py-3 text-right text-gray-600">Custo Méd.</th>
                  <th className="px-6 py-3 text-right text-gray-600">Preço Venda</th>
                  <th className="px-6 py-3 text-right text-gray-600">Lucro (Margem)</th>
                  <th className="px-6 py-3 text-center text-gray-600">Status</th>
                  <th className="px-6 py-3 text-center text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedItems.map((product) => {
                  const totalValue = product.currentStock * product.averageCost;
                  
                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p>{product.name}</p>
                          {product.barcode && (
                            <p className="text-gray-500 mt-1">
                              {product.barcode}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                            {getCategoryLabel(product.category)}
                          </span>
                          {product.isPerishable && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                              Perecível
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p>
                          {product.currentStock} {product.measurementUnit}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="text-gray-600">
                          {product.minStock} {product.measurementUnit}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p>{formatCurrency(product.averageCost)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-bold text-blue-700">{formatCurrency(product.sellingPrice || 0)}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {product.sellingPrice && product.sellingPrice > 0 ? (
                          <div>
                            <p className="text-green-600 font-medium">
                              {formatCurrency(product.sellingPrice - product.averageCost)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(((product.sellingPrice - product.averageCost) / product.sellingPrice) * 100).toFixed(0)}%
                            </p>
                          </div>
                        ) : (
                          <p className="text-gray-400 text-sm">Não definido</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusBadge(product)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => onView(product)}
                            className="text-gray-600 hover:text-gray-700 p-2 hover:bg-gray-100 rounded"
                            title="Ver detalhes"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setAdjustingProduct(product)}
                            className="text-orange-600 hover:text-orange-700 p-2 hover:bg-orange-50 rounded"
                            title="Baixa de Estoque / Perda"
                          >
                            <MinusCircle className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => onEdit(product)}
                            className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded"
                            title="Editar produto"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          {onDuplicate && (
                            <button
                              onClick={() => onDuplicate(product)}
                              className="text-green-600 hover:text-green-700 p-2 hover:bg-green-50 rounded"
                              title="Duplicar produto"
                            >
                              <Copy className="w-5 h-5" />
                            </button>
                          )}
                          <button
                            onClick={() => onDelete(product)}
                            className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded"
                            title="Deletar produto"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            
            {filteredProducts.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum produto encontrado</p>
                <p className="mt-2">Ajuste os filtros ou adicione novos produtos</p>
              </div>
            )}
            {filteredProducts.length > 0 && (
              <ListPaginationBar
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                from={from}
                to={to}
                total={filteredTotal}
              />
            )}
          </div>
        </div>
      )}
      
      {/* Summary */}
      {products.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 md:p-6">
          <h3 className="mb-4 text-sm md:text-base">Resumo do Inventário</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div>
              <p className="text-[10px] md:text-sm text-gray-600">Valor Estoque (Custo)</p>
              <p className="text-sm md:text-base font-bold">
                {formatCurrency(filteredProducts.reduce((sum, p) => sum + (p.currentStock * p.averageCost), 0))}
              </p>
            </div>
            <div>
              <p className="text-[10px] md:text-sm text-gray-600">Valor Potencial (Venda)</p>
              <p className="text-sm md:text-base font-bold text-blue-700">
                {formatCurrency(filteredProducts.reduce((sum, p) => sum + (p.currentStock * (p.sellingPrice || 0)), 0))}
              </p>
            </div>
            <div>
              <p className="text-[10px] md:text-sm text-gray-600">Lucro Potencial</p>
              <p className="text-sm md:text-base font-bold text-green-600">
                {formatCurrency(filteredProducts.reduce((sum, p) => sum + (p.currentStock * ((p.sellingPrice || 0) - p.averageCost)), 0))}
              </p>
            </div>
            <div>
              <p className="text-[10px] md:text-sm text-gray-600">Alertas</p>
              <p className="text-sm md:text-base font-bold text-orange-600">
                {filteredProducts.filter(p => {
                  const status = getStockStatus(p.currentStock, p.minStock, p.safetyStock);
                  return status === 'critical' || status === 'low';
                }).length} itens
              </p>
            </div>
          </div>
        </div>
      )}
      {adjustingProduct && (
        <StockAdjustmentModal
          product={adjustingProduct}
          onClose={() => setAdjustingProduct(null)}
          onSuccess={() => {
            // A atualização do estado global acontece via App.tsx ou reload
            // Idealmente passaríamos um callback para refrescar os dados aqui
            window.location.reload(); 
          }}
        />
      )}
      
      {/* Product Import Dialog */}
      {onImportFromFile && (
        <ProductImport
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          products={products}
          categories={categories}
          onImport={onImportFromFile}
        />
      )}
    </div>
  );
}