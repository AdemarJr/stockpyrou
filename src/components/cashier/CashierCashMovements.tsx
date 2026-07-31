import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { getBackendUrl } from '../../lib/backendUrl';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface CashMovement {
  id: string;
  amount: number;
  reason: string;
  timestamp?: string;
  performedBy?: string;
}

interface CashierCashMovementsProps {
  register: {
    id: string;
    currentBalance: number;
    withdrawals?: CashMovement[];
    deposits?: CashMovement[];
  };
  onUpdated: () => void | Promise<void>;
}

export function CashierCashMovements({ register, onUpdated }: CashierCashMovementsProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [mode, setMode] = useState<'withdrawal' | 'deposit' | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const withdrawals = register.withdrawals || [];
  const deposits = register.deposits || [];
  const totalOut = withdrawals.reduce((s, w) => s + (w.amount || 0), 0);
  const totalIn = deposits.reduce((s, d) => s + (d.amount || 0), 0);

  const authHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${user?.accessToken || ''}`,
      'X-Custom-Token': user?.accessToken || '',
      'Content-Type': 'application/json',
    };
    if (currentCompany?.id) headers['X-Company-Id'] = currentCompany.id;
    return headers;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mode) return;
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    const reasonText = reason.trim();
    if (reasonText.length < 3) {
      toast.error(
        mode === 'withdrawal'
          ? 'Informe o motivo da sangria'
          : 'Informe o motivo do suprimento (ex.: troco)',
      );
      return;
    }

    setSaving(true);
    try {
      const path = mode === 'withdrawal' ? '/cashier/withdrawal' : '/cashier/deposit';
      const res = await fetch(getBackendUrl(path), {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          registerId: register.id,
          amount: value,
          reason: reasonText,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      toast.success(mode === 'withdrawal' ? 'Sangria registrada' : 'Suprimento (troco) registrado');
      setAmount('');
      setReason('');
      setMode(null);
      await onUpdated();
    } catch {
      toast.error(mode === 'withdrawal' ? 'Erro ao registrar sangria' : 'Erro ao registrar suprimento');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <Wallet className="w-5 h-5 text-emerald-700 dark:text-emerald-300" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Saldo atual em caixa</p>
            <p className="text-2xl font-bold tabular-nums">
              R$ {(register.currentBalance || 0).toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={mode === 'withdrawal' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setMode(mode === 'withdrawal' ? null : 'withdrawal')}
          >
            <ArrowDown className="w-4 h-4" />
            Sangria (retirada)
          </Button>
          <Button
            type="button"
            variant={mode === 'deposit' ? 'default' : 'outline'}
            className="gap-2"
            onClick={() => setMode(mode === 'deposit' ? null : 'deposit')}
          >
            <ArrowUp className="w-4 h-4" />
            Suprimento / troco
          </Button>
        </div>
      </div>

      {mode && (
        <form
          onSubmit={submit}
          className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5 space-y-4"
        >
          <h3 className="font-semibold text-lg">
            {mode === 'withdrawal' ? 'Registrar sangria' : 'Inserir dinheiro (troco / reforço)'}
          </h3>
          <div className="space-y-1.5">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0,00"
              autoFocus
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Motivo *</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                mode === 'withdrawal'
                  ? 'Ex.: pagamento de fornecedor, retirada parcial…'
                  : 'Ex.: troco para o caixa, reforço de fundo…'
              }
              required
              minLength={3}
            />
            <p className="text-xs text-muted-foreground">Obrigatório informar o motivo da operação.</p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Confirmar
            </Button>
            <Button type="button" variant="outline" onClick={() => setMode(null)} disabled={saving}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-red-100 dark:border-red-900/40 bg-white dark:bg-gray-800 p-4">
          <h4 className="font-semibold text-red-700 dark:text-red-300 mb-3 flex items-center gap-2">
            <ArrowDown className="w-4 h-4" />
            Sangrias (R$ {totalOut.toFixed(2)})
          </h4>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma sangria neste caixa.</p>
          ) : (
            <ul className="space-y-2">
              {withdrawals.map((w) => (
                <li key={w.id} className="rounded-lg bg-red-50 dark:bg-red-950/30 p-3 text-sm">
                  <div className="flex justify-between font-medium">
                    <span>R$ {w.amount.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">
                      {w.timestamp ? new Date(w.timestamp).toLocaleTimeString('pt-BR') : ''}
                    </span>
                  </div>
                  <p className="mt-0.5">{w.reason || '—'}</p>
                  {w.performedBy && (
                    <p className="text-xs text-muted-foreground mt-1">{w.performedBy}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-white dark:bg-gray-800 p-4">
          <h4 className="font-semibold text-emerald-700 dark:text-emerald-300 mb-3 flex items-center gap-2">
            <ArrowUp className="w-4 h-4" />
            Suprimentos (R$ {totalIn.toFixed(2)})
          </h4>
          {deposits.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum suprimento neste caixa.</p>
          ) : (
            <ul className="space-y-2">
              {deposits.map((d) => (
                <li key={d.id} className="rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3 text-sm">
                  <div className="flex justify-between font-medium">
                    <span>R$ {d.amount.toFixed(2)}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.timestamp ? new Date(d.timestamp).toLocaleTimeString('pt-BR') : ''}
                    </span>
                  </div>
                  <p className="mt-0.5">{d.reason || '—'}</p>
                  {d.performedBy && (
                    <p className="text-xs text-muted-foreground mt-1">{d.performedBy}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
