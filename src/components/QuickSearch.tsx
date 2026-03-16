import React, { useState, useEffect, useRef } from 'react';
import { Search, Package, TrendingUp, FileText, X, Command } from 'lucide-react';
import type { Product } from '../types';

interface QuickSearchProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onNavigate: (page: string, product?: Product) => void;
}

export function QuickSearch({ isOpen, onClose, products, onNavigate }: QuickSearchProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const actions = [
    { id: 'new-product', label: 'Novo Produto', icon: Package, action: () => onNavigate('products') },
    { id: 'stock-entry', label: 'Recebimento de Estoque', icon: TrendingUp, action: () => onNavigate('stock-entry') },
    { id: 'reports', label: 'Ver Relatórios', icon: FileText, action: () => onNavigate('reports') },
  ];

  const filteredProducts = products
    .filter(p => 
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.barcode?.includes(query) ||
      p.sku?.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 5);

  const filteredActions = actions.filter(a => 
    a.label.toLowerCase().includes(query.toLowerCase())
  );

  const allResults = [
    ...filteredActions.map(a => ({ type: 'action' as const, data: a })),
    ...filteredProducts.map(p => ({ type: 'product' as const, data: p }))
  ];

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, allResults.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelect(allResults[selectedIndex]);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, allResults]);

  const handleSelect = (result: typeof allResults[0]) => {
    if (!result) return;

    if (result.type === 'action') {
      result.data.action();
    } else {
      onNavigate('products', result.data);
    }
    onClose();
    setQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-20 px-4" role="dialog" aria-modal="true" aria-labelledby="quick-search-title">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <Search className="w-5 h-5 text-gray-400" aria-hidden="true" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar produtos, ações..."
            className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400"
            aria-label="Buscar produtos e ações"
            aria-describedby="quick-search-instructions"
          />
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            aria-label="Fechar busca rápida"
          >
            <X className="w-4 h-4 text-gray-500" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {allResults.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {query ? 'Nenhum resultado encontrado' : 'Digite para buscar...'}
            </div>
          ) : (
            <div className="py-2">
              {allResults.map((result, index) => {
                const Icon = result.type === 'action' ? result.data.icon : Package;
                const label = result.type === 'action' ? result.data.label : result.data.name;
                const subtitle = result.type === 'product' 
                  ? `SKU: ${result.data.sku || 'N/A'} | Estoque: ${result.data.currentStock}`
                  : 'Ação rápida';

                return (
                  <button
                    key={result.type === 'action' ? result.data.id : result.data.id}
                    onClick={() => handleSelect(result)}
                    className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                      index === selectedIndex
                        ? 'bg-blue-50 dark:bg-blue-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className={`p-2 rounded ${
                      result.type === 'action' ? 'bg-blue-100 dark:bg-blue-900' : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      <Icon className={`w-4 h-4 ${
                        result.type === 'action' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
                      }`} />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
                    </div>
                    {index === selectedIndex && (
                      <div className="text-xs text-gray-400 dark:text-gray-500">
                        Enter
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400" id="quick-search-instructions">
          <div className="flex items-center gap-1">
            <kbd className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">↑</kbd>
            <kbd className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">↓</kbd>
            <span>navegar</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">Enter</kbd>
            <span>selecionar</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">Esc</kbd>
            <span>fechar</span>
          </div>
        </div>
      </div>
    </div>
  );
}