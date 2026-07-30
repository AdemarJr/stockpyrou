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
  /** Módulo fiscal ativado — libera seleção NFC-e */
  fiscalReady: boolean;
  /** Cadastro completo (CSC, cert, etc.) */
  fiscalConfigComplete?: boolean;
  fiscalLoading?: boolean;
  fiscalReason?: string;
  fiscalReasons?: string[];
  onOpenFiscalConfig?: () => void;
  children?: React.ReactNode;
}

/**
 * Passo comum de checkout: documento (cupom / NFC-e) + forma de pagamento.
 * Documento fica no topo para não exigir rolagem.
 */
export function SaleCheckoutFields({
  paymentMethod,
  onPaymentMethodChange,
  documentType,
  onDocumentTypeChange,
  fiscalReady,
  fiscalConfigComplete,
  fiscalLoading,
  fiscalReason,
  fiscalReasons,
  onOpenFiscalConfig,
  children,
}: SaleCheckoutFieldsProps) {
  const pendingReasons = (fiscalReasons || []).filter(Boolean);
  const showPending =
    fiscalReady && fiscalConfigComplete === false && pendingReasons.length > 0;

  return (
    <div className="space-y-5">
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
                documentType === 'non_fiscal' ? 'text-slate-700 dark:text-slate-200' : 'text-gray-400'
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
            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
              NFC-e / cupom fiscal
            </p>
            <p className="text-[11px] text-gray-500">
              {fiscalLoading
                ? 'Verificando módulo fiscal…'
                : fiscalReady
                  ? 'Emite nota fiscal eletrônica (NFC-e) após a venda'
                  : fiscalReason || 'Ative o módulo fiscal em Integrações → Fiscal'}
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

        {showPending && (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-[11px] text-amber-900 dark:text-amber-200">
            <p className="font-semibold mb-1">NFC-e liberada, mas cadastro incompleto:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {pendingReasons.slice(0, 4).map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {onOpenFiscalConfig && (
              <button
                type="button"
                className="mt-1 text-blue-600 underline font-medium"
                onClick={onOpenFiscalConfig}
              >
                Completar em Integrações
              </button>
            )}
          </div>
        )}
      </div>

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
    </div>
  );
}
