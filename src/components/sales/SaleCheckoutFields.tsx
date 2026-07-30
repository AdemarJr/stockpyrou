import React from 'react';
import {
  Banknote,
  CreditCard,
  FileText,
  Receipt,
  Smartphone,
} from 'lucide-react';

export type SalePaymentMethod =
  | 'money'
  | 'pix'
  | 'credit'
  | 'debit'
  | 'fiado'
  | 'boleto';

export type SaleDocumentType = 'non_fiscal' | 'nfce';

export const SALE_PAYMENT_OPTIONS: {
  value: SalePaymentMethod;
  label: string;
  hint: string;
  icon: typeof Banknote;
}[] = [
  { value: 'money', label: 'À vista (Dinheiro)', hint: 'Entra no caixa', icon: Banknote },
  { value: 'pix', label: 'PIX', hint: 'Entra no caixa', icon: Smartphone },
  { value: 'debit', label: 'Débito', hint: 'Cartão de débito', icon: CreditCard },
  { value: 'credit', label: 'Crédito', hint: 'Cartão de crédito', icon: CreditCard },
  { value: 'fiado', label: 'A prazo (Fiado)', hint: 'Contas a receber', icon: Receipt },
  { value: 'boleto', label: 'Boleto', hint: 'Contas a receber', icon: Receipt },
];

interface SaleCheckoutFieldsProps {
  paymentMethod: SalePaymentMethod;
  onPaymentMethodChange: (method: SalePaymentMethod) => void;
  documentType: SaleDocumentType;
  onDocumentTypeChange: (type: SaleDocumentType) => void;
  fiscalReady: boolean;
  fiscalLoading?: boolean;
  fiscalReason?: string;
  onOpenFiscalConfig?: () => void;
  /** Extra fields (cliente, troco, vencimento) rendered by parent below payments */
  children?: React.ReactNode;
}

/**
 * Passo comum de checkout: forma de pagamento + tipo de documento.
 * Sem Radix Checkbox (evita crash no modal do PDV).
 */
export function SaleCheckoutFields({
  paymentMethod,
  onPaymentMethodChange,
  documentType,
  onDocumentTypeChange,
  fiscalReady,
  fiscalLoading,
  fiscalReason,
  onOpenFiscalConfig,
  children,
}: SaleCheckoutFieldsProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
          Forma de pagamento
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SALE_PAYMENT_OPTIONS.map((opt) => {
            const selected = paymentMethod === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onPaymentMethodChange(opt.value)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${
                  selected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon
                  className={`w-5 h-5 mb-1 ${selected ? 'text-blue-600' : 'text-gray-400'}`}
                />
                <p
                  className={`text-sm font-bold ${
                    selected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {opt.label}
                </p>
                <p className="text-[11px] text-gray-500">{opt.hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      {children}

      <div>
        <p className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
          Documento da venda
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onDocumentTypeChange('non_fiscal')}
            className={`p-3 rounded-xl border-2 text-left transition-all ${
              documentType === 'non_fiscal'
                ? 'border-slate-500 bg-slate-50 dark:bg-slate-900/40'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <FileText
              className={`w-5 h-5 mb-1 ${
                documentType === 'non_fiscal' ? 'text-slate-700' : 'text-gray-400'
              }`}
            />
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">Cupom não fiscal</p>
            <p className="text-[11px] text-gray-500">Recibo interno — sem envio à SEFAZ</p>
          </button>

          <button
            type="button"
            disabled={!fiscalReady || !!fiscalLoading}
            onClick={() => fiscalReady && onDocumentTypeChange('nfce')}
            className={`p-3 rounded-xl border-2 text-left transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
              documentType === 'nfce'
                ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40'
                : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            <Receipt
              className={`w-5 h-5 mb-1 ${
                documentType === 'nfce' ? 'text-emerald-600' : 'text-gray-400'
              }`}
            />
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">NFC-e (nota fiscal)</p>
            <p className="text-[11px] text-gray-500">
              {fiscalLoading
                ? 'Verificando módulo fiscal…'
                : fiscalReady
                  ? 'Solicita emissão de NFC-e após a venda'
                  : fiscalReason || 'Configure o fiscal em Integrações'}
            </p>
            {!fiscalReady && !fiscalLoading && onOpenFiscalConfig && (
              <span
                role="link"
                tabIndex={0}
                className="text-[11px] text-blue-600 underline font-medium mt-1 inline-block"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFiscalConfig();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.stopPropagation();
                    onOpenFiscalConfig();
                  }
                }}
              >
                Abrir configuração fiscal
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
