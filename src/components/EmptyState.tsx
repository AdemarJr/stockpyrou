import React from 'react';
import { Database } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  type: 'products' | 'suppliers' | 'recipes' | 'entries';
  onAction: () => void;
}

export function EmptyState({ title, description, type, onAction }: EmptyStateProps) {
  const getInstructions = () => {
    switch (type) {
      case 'products':
        return (
          <>
            <p className="text-gray-600 mb-6">
              Adicione seus primeiros produtos ao estoque para começar a gerenciar seu inventário de forma inteligente.
            </p>
            <button
              onClick={onAction}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Database className="w-5 h-5" />
              Adicionar Produto
            </button>
          </>
        );
      default:
        return (
          <button
            onClick={onAction}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Database className="w-5 h-5" />
            Começar
          </button>
        );
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <div className="bg-gray-100 rounded-full p-6 w-24 h-24 mx-auto mb-6 flex items-center justify-center">
        <Database className="w-12 h-12 text-gray-400" />
      </div>
      
      <h3 className="text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6">{description}</p>
      
      {getInstructions()}
    </div>
  );
}