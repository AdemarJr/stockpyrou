import { Plus, Trash2 } from 'lucide-react';
import {
  SALE_PAYMENT_OPTIONS,
  type SalePaymentMethod,
} from './SaleCheckoutFields';
import { formatCurrency } from '../../utils/calculations';
import {
  newPaymentLineId,
  paymentsSum,
  type PaymentSplitLine,
  roundMoney,
} from '../../utils/salePricing';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface MixedPaymentEditorProps {
  total: number;
  lines: PaymentSplitLine[];
  onChange: (lines: PaymentSplitLine[]) => void;
  cashReceived: string;
  onCashReceivedChange: (v: string) => void;
}

export function MixedPaymentEditor({
  total,
  lines,
  onChange,
  cashReceived,
  onCashReceivedChange,
}: MixedPaymentEditorProps) {
  const paid = paymentsSum(lines);
  const remaining = roundMoney(total - paid);
  const moneyAmt = roundMoney(
    lines.filter((l) => l.method === 'money').reduce((s, l) => s + l.amount, 0),
  );
  const cash = parseFloat(cashReceived || '0') || 0;
  const change = moneyAmt > 0 ? roundMoney(cash - moneyAmt) : 0;

  const updateLine = (id: string, patch: Partial<PaymentSplitLine>) => {
    onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  };

  const addLine = (method: SalePaymentMethod = 'pix') => {
    const amount = remaining > 0 ? remaining : 0;
    onChange([...lines, { id: newPaymentLineId(), method, amount }]);
  };

  const removeLine = (id: string) => {
    if (lines.length <= 1) return;
    onChange(lines.filter((l) => l.id !== id));
  };

  const fillRemaining = (id: string) => {
    const others = paymentsSum(lines.filter((l) => l.id !== id));
    updateLine(id, { amount: Math.max(0, roundMoney(total - others)) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Pagamento misto</p>
        <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => addLine()}>
          <Plus className="w-3.5 h-3.5" />
          Forma
        </Button>
      </div>

      <div className="space-y-2">
        {lines.map((line) => (
          <div
            key={line.id}
            className="grid grid-cols-[1fr_7rem_auto] gap-2 items-end rounded-xl border border-gray-200 dark:border-gray-700 p-2"
          >
            <div className="space-y-1">
              <Label className="text-xs">Forma</Label>
              <select
                value={line.method}
                onChange={(e) =>
                  updateLine(line.id, { method: e.target.value as SalePaymentMethod })
                }
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {SALE_PAYMENT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valor</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={line.amount || ''}
                onChange={(e) =>
                  updateLine(line.id, { amount: parseFloat(e.target.value) || 0 })
                }
                onBlur={() => {
                  if (!line.amount && remaining > 0) fillRemaining(line.id);
                }}
              />
            </div>
            <div className="flex gap-1 pb-0.5">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                title="Preencher restante"
                onClick={() => fillRemaining(line.id)}
              >
                =
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="text-red-600"
                disabled={lines.length <= 1}
                onClick={() => removeLine(line.id)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div
        className={`rounded-xl px-3 py-2 text-sm font-medium ${
          Math.abs(remaining) < 0.005
            ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
            : remaining > 0
              ? 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
              : 'bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200'
        }`}
      >
        {Math.abs(remaining) < 0.005
          ? `Cobertura completa · ${formatCurrency(paid)}`
          : remaining > 0
            ? `Falta distribuir ${formatCurrency(remaining)}`
            : `Excede o total em ${formatCurrency(Math.abs(remaining))}`}
      </div>

      {moneyAmt > 0 && (
        <div className="space-y-2 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
          <Label>Valor recebido em dinheiro (troco)</Label>
          <Input
            type="number"
            step="0.01"
            value={cashReceived}
            onChange={(e) => onCashReceivedChange(e.target.value)}
            placeholder={moneyAmt.toFixed(2)}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onCashReceivedChange(moneyAmt.toFixed(2))}
            >
              Exato
            </Button>
          </div>
          {cash > 0 && (
            <p
              className={`text-sm font-bold ${
                change < 0 ? 'text-red-600' : 'text-emerald-600'
              }`}
            >
              {change < 0 ? 'Faltam: ' : 'Troco: '}
              {formatCurrency(Math.abs(change))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
