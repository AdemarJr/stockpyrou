import React, { useState } from 'react';
import { X, Save, Zap } from 'lucide-react';
import type { Product, MeasurementUnit } from '../../types';
import { cn } from '../ui/utils';
import { nativeFieldInvalidClass } from '../../lib/formFieldValidation';

interface QuickProductFormProps {
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  onSwitchToFull?: () => void;
}

export function QuickProductForm({ onSave, onCancel, onSwitchToFull }: QuickProductFormProps) {
  const [formData, setFormData] = useState({
    name: '',
    category: 'alimento' as 'alimento' | 'bebida' | 'descartavel' | 'limpeza' | 'outro',
    measurementUnit: 'kg' as MeasurementUnit,
    averageCost: 0,
    sellingPrice: 0,
  });
  const [fieldErrors, setFieldErrors] = useState<{ name?: boolean; averageCost?: boolean }>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const err: { name?: boolean; averageCost?: boolean } = {};
    if (!formData.name.trim()) err.name = true;
    if (formData.averageCost <= 0) err.averageCost = true;
    setFieldErrors(err);
    if (Object.keys(err).length > 0) return;

    // Create product with simplified data and smart defaults
    const product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
      name: formData.name.trim(),
      category: formData.category,
      measurementUnit: formData.measurementUnit,
      averageCost: formData.averageCost,
      sellingPrice: formData.sellingPrice || null,
      currentStock: 0, // Will be set via stock entry
      minStock: 5, // Smart default
      safetyStock: 10, // Smart default
      isPerishable: false,
      barcode: undefined,
      supplierId: undefined,
      shelfLife: undefined,
    };

    onSave(product);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (field === 'name') delete next.name;
      if (field === 'averageCost') delete next.averageCost;
      return next;
    });
  };

  // Calculate suggested selling price (30% markup)
  const suggestedPrice = formData.averageCost > 0 ? formData.averageCost * 1.3 : 0;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold dark:text-white">Cadastro Rápido</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Apenas campos essenciais</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="mx-6 mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <strong>Modo Rápido:</strong> Preencha apenas os campos essenciais. Você pode adicionar mais detalhes depois editando o produto.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Product Name */}
          <div>
            <label className="block text-gray-700 dark:text-gray-300 mb-2 font-medium">
              Nome do Produto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              aria-invalid={fieldErrors.name}
              className={cn(
                'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors dark:bg-gray-700 dark:text-white',
                fieldErrors.name
                  ? 'border-destructive ring-2 ring-destructive/30'
                  : 'border-gray-300 dark:border-gray-600'
              )}
              placeholder="Ex: Arroz Branco 5kg"
              autoFocus
            />
          </div>

          {/* Category and Unit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Categoria <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) => handleChange('category', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              >
                <option value="alimento">Alimento</option>
                <option value="bebida">Bebida</option>
                <option value="descartavel">Descartável</option>
                <option value="limpeza">Limpeza</option>
                <option value="outro">Outro</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Unidade <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.measurementUnit}
                onChange={(e) => handleChange('measurementUnit', e.target.value as MeasurementUnit)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              >
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="l">L</option>
                <option value="ml">mL</option>
                <option value="un">un</option>
              </select>
            </div>
          </div>

          {/* Cost and Price */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Custo <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">R$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.averageCost || ''}
                  onChange={(e) => handleChange('averageCost', parseFloat(e.target.value) || 0)}
                  aria-invalid={fieldErrors.averageCost}
                  className={cn(
                    'w-full pl-12 pr-4 py-3 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors dark:bg-gray-700 dark:text-white',
                    nativeFieldInvalidClass(!!fieldErrors.averageCost),
                    !fieldErrors.averageCost && 'border border-gray-300 dark:border-gray-600'
                  )}
                  placeholder="0,00"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 dark:text-gray-300 mb-2 font-medium">
                Preço Venda
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">R$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.sellingPrice || ''}
                  onChange={(e) => handleChange('sellingPrice', parseFloat(e.target.value) || 0)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  placeholder="0,00"
                />
              </div>
              {formData.averageCost > 0 && (
                <button
                  type="button"
                  onClick={() => handleChange('sellingPrice', parseFloat(suggestedPrice.toFixed(2)))}
                  className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Sugerir: R$ {suggestedPrice.toFixed(2)} (30% lucro)
                </button>
              )}
            </div>
          </div>

          {/* Profit Preview */}
          {formData.sellingPrice > 0 && formData.averageCost > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-700 dark:text-green-300 font-medium">Lucro Unitário:</span>
                <span className="text-green-700 dark:text-green-300 font-bold">
                  R$ {(formData.sellingPrice - formData.averageCost).toFixed(2)} 
                  ({(((formData.sellingPrice - formData.averageCost) / formData.sellingPrice) * 100).toFixed(1)}%)
                </span>
              </div>
            </div>
          )}

          {/* Smart Defaults Info */}
          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              <strong>Valores padrão aplicados automaticamente:</strong>
            </p>
            <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-disc list-inside">
              <li>Estoque mínimo: 5 {formData.measurementUnit}</li>
              <li>Estoque de segurança: 10 {formData.measurementUnit}</li>
              <li>Estoque atual: 0 (adicione via Recebimento)</li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 pt-4">
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-lg hover:from-green-700 hover:to-emerald-700 flex items-center justify-center gap-2 font-medium transition-all shadow-lg shadow-green-200 dark:shadow-green-900/30"
            >
              <Save className="w-5 h-5" />
              Salvar Produto
            </button>

            {onSwitchToFull && (
              <button
                type="button"
                onClick={onSwitchToFull}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-6 py-3 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 font-medium transition-colors"
              >
                Usar Formulário Completo
              </button>
            )}

            <button
              type="button"
              onClick={onCancel}
              className="w-full text-gray-600 dark:text-gray-400 px-6 py-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 font-medium transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
