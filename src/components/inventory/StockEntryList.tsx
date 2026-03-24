import React, { useState, useMemo } from 'react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Package, Search, Filter, Edit2, Trash2, Calendar, FileText, MoreVertical } from 'lucide-react';
import type { Product, Supplier, StockEntry } from '../../types';
import { formatCurrency, formatDateTime } from '../../utils/calculations';
import { useIsMobile } from '../ui/use-mobile';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import { ListPaginationBar } from '../ui/list-pagination-bar';
import { usePagination } from '../../hooks/usePagination';

interface StockEntryListProps {
  entries: StockEntry[];
  products: Product[];
  suppliers: Supplier[];
  onEdit: (entry: StockEntry) => void;
  onDelete: (id: string) => void;
}

export function StockEntryList({ entries, products, suppliers, onEdit, onDelete }: StockEntryListProps) {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const product = products.find((p) => p.id === entry.productId);
      const supplier = suppliers.find((s) => s.id === entry.supplierId);
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        (product?.name.toLowerCase().includes(q) ?? false) ||
        (entry.notes?.toLowerCase().includes(q) ?? false) ||
        (entry.batchNumber?.toLowerCase().includes(q) ?? false) ||
        (supplier?.name.toLowerCase().includes(q) ?? false);
      const matchesSupplier = filterSupplier ? entry.supplierId === filterSupplier : true;
      const entryDay = new Date(entry.entryDate).toISOString().split('T')[0];
      const matchesFrom = !dateFrom || entryDay >= dateFrom;
      const matchesTo = !dateTo || entryDay <= dateTo;
      return matchesSearch && matchesSupplier && matchesFrom && matchesTo;
    });
  }, [entries, products, suppliers, searchTerm, filterSupplier, dateFrom, dateTo]);

  const filterKey = `${searchTerm}|${filterSupplier}|${dateFrom}|${dateTo}`;
  const { paginatedItems, page, setPage, totalPages, from, to, total: filteredTotal } =
    usePagination(filteredEntries, 12, filterKey);

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm mt-8">
      <div className="p-6 border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-500" />
            Histórico de Recebimentos
          </h3>
          
          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col md:flex-row flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="search"
                  placeholder="Produto, fornecedor, lote, observação..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent md:min-w-[200px]"
              >
                <option value="">Todos os Fornecedores</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">Recebimento de</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-500">até</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <button
                type="button"
                className="text-sm text-blue-600 hover:underline px-2"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                Limpar datas
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {isMobile ? (
        <div className="p-4 space-y-4">
          {filteredEntries.length > 0 ? (
            paginatedItems.map((entry) => {
              const product = products.find(p => p.id === entry.productId);
              const supplier = suppliers.find(s => s.id === entry.supplierId);
              
              return (
                <div key={entry.id} className="bg-gray-50 rounded-lg border border-gray-100 p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-xs font-bold text-blue-600 mb-1">{formatDateTime(entry.entryDate)}</p>
                      <h4 className="font-bold text-gray-900">{product?.name || 'Produto Removido'}</h4>
                      <p className="text-xs text-gray-500">{supplier?.name || 'Fornecedor não informado'}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(entry)}>
                          <Edit2 className="w-4 h-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDelete(entry.id)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-gray-200">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-gray-400">Quantidade</p>
                      <p className="text-sm font-bold">{entry.quantity} {product?.measurementUnit}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-gray-400">Total</p>
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(entry.totalPrice)}</p>
                    </div>
                  </div>
                  
                  {entry.batchNumber && (
                    <div className="mt-2">
                       <p className="text-[10px] uppercase font-bold text-gray-400">Lote</p>
                       <p className="text-xs text-gray-600">{entry.batchNumber}</p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum recebimento encontrado</p>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 font-medium text-gray-500">Data</th>
              <th className="px-6 py-3 font-medium text-gray-500">Produto</th>
              <th className="px-6 py-3 font-medium text-gray-500">Fornecedor</th>
              <th className="px-6 py-3 font-medium text-gray-500 text-right">Qtd.</th>
              <th className="px-6 py-3 font-medium text-gray-500 text-right">Custo Un.</th>
              <th className="px-6 py-3 font-medium text-gray-500 text-right">Total</th>
              <th className="px-6 py-3 font-medium text-gray-500">Lote</th>
              <th className="px-6 py-3 font-medium text-gray-500 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredEntries.length > 0 ? (
              paginatedItems.map((entry) => {
                const product = products.find(p => p.id === entry.productId);
                const supplier = suppliers.find(s => s.id === entry.supplierId);
                
                return (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {formatDateTime(entry.entryDate)}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {product?.name || 'Produto Removido'}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {supplier?.name || '-'}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-900">
                      {entry.quantity} {product?.measurementUnit}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {formatCurrency(entry.unitPrice)}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {formatCurrency(entry.totalPrice)}
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {entry.batchNumber || '-'}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEdit(entry)}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(entry.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Nenhum recebimento encontrado</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )}
      
      <div className="px-4 pb-2 border-t border-gray-200">
        <p className="text-sm text-gray-500 text-center py-2">
          Filtrados: {filteredEntries.length} de {entries.length} registros
        </p>
        {filteredEntries.length > 0 && (
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
  );
}
