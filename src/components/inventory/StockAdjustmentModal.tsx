import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { cn } from '../ui/utils';
import { nativeFieldInvalidClass } from '../../lib/formFieldValidation';
import { StockService } from '../../services/StockService';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import type { Product } from '../../types';

interface StockAdjustmentModalProps {
  product: Product;
  onClose: () => void;
  onSuccess: () => void;
}

export function StockAdjustmentModal({ product, onClose, onSuccess }: StockAdjustmentModalProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [quantity, setQuantity] = useState('');
  const [reasonType, setReasonType] = useState<'saida' | 'desperdicio'>('saida');
  const [reasonDescription, setReasonDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ quantity?: boolean; reason?: boolean }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany || !user) return;

    const qtd = parseFloat(quantity);
    const err: { quantity?: boolean; reason?: boolean } = {};
    if (!qtd || qtd <= 0) err.quantity = true;
    if (!reasonDescription.trim()) err.reason = true;
    setFieldErrors(err);
    if (Object.keys(err).length > 0) return;

    if (qtd > product.currentStock) {
      toast.error('Estoque insuficiente para esta baixa');
      return;
    }

    setIsSubmitting(true);
    try {
      await StockService.processStockOutput(
        currentCompany.id,
        product.id,
        qtd,
        reasonDescription,
        reasonType,
        user.id
      );

      toast.success('Baixa de estoque realizada com sucesso!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao realizar baixa:', error);
      toast.error(`Erro ao realizar baixa: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-gray-900">Baixa de Estoque</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-3">
             <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
             <div>
                <p className="font-medium text-blue-900">{product.name}</p>
                <p className="text-sm text-blue-700">Estoque atual: {product.currentStock} {product.measurementUnit}</p>
             </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tipo de Baixa
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setReasonType('saida')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                  reasonType === 'saida'
                    ? 'bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-500'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Uso Interno / Ajuste
              </button>
              <button
                type="button"
                onClick={() => setReasonType('desperdicio')}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-all ${
                  reasonType === 'desperdicio'
                    ? 'bg-red-50 border-red-200 text-red-700 ring-1 ring-red-500'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Perda / Validade
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantidade a Baixar <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={product.currentStock}
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setFieldErrors((prev) => {
                    const n = { ...prev };
                    delete n.quantity;
                    return n;
                  });
                }}
                aria-invalid={fieldErrors.quantity}
                className={cn(
                  'w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all',
                  nativeFieldInvalidClass(!!fieldErrors.quantity),
                  !fieldErrors.quantity && 'border border-gray-300'
                )}
                placeholder="0.00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                {product.measurementUnit}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motivo / Observação <span className="text-destructive">*</span>
            </label>
            <textarea
              value={reasonDescription}
              onChange={(e) => {
                setReasonDescription(e.target.value);
                setFieldErrors((prev) => {
                  const n = { ...prev };
                  delete n.reason;
                  return n;
                });
              }}
              aria-invalid={fieldErrors.reason}
              className={cn(
                'w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none',
                nativeFieldInvalidClass(!!fieldErrors.reason),
                !fieldErrors.reason && 'border border-gray-300'
              )}
              rows={3}
              placeholder={reasonType === 'desperdicio' ? "Ex: Produto vencido, embalagem danificada..." : "Ex: Consumo da cozinha, teste de receita..."}
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 px-4 py-2 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${
                reasonType === 'desperdicio' 
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-100' 
                  : 'bg-blue-600 hover:bg-blue-700 shadow-blue-100'
              } shadow-lg disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Confirmar Baixa
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
