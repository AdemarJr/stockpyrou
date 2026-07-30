import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Plus,
  Wallet,
  Loader2,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { formatCurrency } from '../../utils/calculations';
import { formatDateBR, today as todayYmdLocal } from '../../utils/safeDate';
import { ReceivableApi } from '../../repositories/receivableApi';
import type { AccountsReceivable, AccountsReceivablePayment, PaymentMethod } from '../../types/costs';
import { messageFromUnknownError } from '../../utils/errorMessage';

const RECEIVE_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'money', label: 'Dinheiro' },
  { value: 'debit', label: 'Débito' },
  { value: 'credit', label: 'Crédito' },
  { value: 'bank_transfer', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
];

function statusBadge(status: string) {
  if (status === 'paid')
    return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300';
  if (status === 'overdue')
    return 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300';
  if (status === 'cancelled')
    return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  return 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300';
}

function statusLabel(status: string) {
  if (status === 'paid') return 'Recebido';
  if (status === 'overdue') return 'Vencido';
  if (status === 'cancelled') return 'Cancelado';
  return 'Em aberto';
}

export function ReceivableManagement() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;
  const today = todayYmdLocal();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<AccountsReceivable[]>([]);
  const [summary, setSummary] = useState({ openTotal: 0, overdueTotal: 0, next7Total: 0 });
  const [statusFilter, setStatusFilter] = useState('open');
  const [search, setSearch] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    amount: '',
    dueDate: today,
    customerName: '',
    description: '',
    referenceNumber: '',
    installmentCount: '1',
  });

  const [receiveOpen, setReceiveOpen] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [selected, setSelected] = useState<AccountsReceivable | null>(null);
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveMethod, setReceiveMethod] = useState<PaymentMethod>('pix');
  const [history, setHistory] = useState<AccountsReceivablePayment[]>([]);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const statusParam =
        statusFilter === 'open'
          ? undefined
          : statusFilter === 'all'
            ? undefined
            : statusFilter;
      const [list, sum] = await Promise.all([
        ReceivableApi.list(companyId, {
          paymentStatus: statusParam,
          q: search.trim() || undefined,
        }),
        ReceivableApi.summary(companyId),
      ]);
      let filtered = list;
      if (statusFilter === 'open') {
        filtered = list.filter((r) => r.paymentStatus === 'pending' || r.paymentStatus === 'overdue');
      } else if (statusFilter === 'overdue') {
        filtered = list.filter(
          (r) =>
            r.paymentStatus === 'overdue' ||
            (r.paymentStatus === 'pending' && r.dueDate < today),
        );
      }
      setItems(filtered);
      setSummary(sum);
    } catch (err) {
      toast.error(messageFromUnknownError(err));
    } finally {
      setLoading(false);
    }
  }, [companyId, statusFilter, search, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReceive = async (row: AccountsReceivable) => {
    if (!companyId) return;
    setSelected(row);
    setReceiveAmount(String(row.remainingAmount.toFixed(2)));
    setReceiveMethod('pix');
    setReceiveOpen(true);
    try {
      const pays = await ReceivableApi.listPayments(row.id, companyId);
      setHistory(pays);
    } catch {
      setHistory([]);
    }
  };

  const handleCreate = async () => {
    if (!companyId) return;
    const amount = parseFloat(form.amount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    if (!form.dueDate) {
      toast.error('Informe o vencimento');
      return;
    }
    setCreating(true);
    try {
      await ReceivableApi.create(companyId, {
        amount,
        dueDate: form.dueDate,
        customerName: form.customerName.trim() || undefined,
        description: form.description.trim() || undefined,
        referenceNumber: form.referenceNumber.trim() || undefined,
        installmentCount: Math.max(1, parseInt(form.installmentCount, 10) || 1),
      });
      toast.success('Título criado');
      setCreateOpen(false);
      setForm({
        amount: '',
        dueDate: today,
        customerName: '',
        description: '',
        referenceNumber: '',
        installmentCount: '1',
      });
      await load();
    } catch (err) {
      toast.error(messageFromUnknownError(err));
    } finally {
      setCreating(false);
    }
  };

  const handleReceive = async () => {
    if (!companyId || !selected) return;
    const amount = parseFloat(receiveAmount.replace(',', '.'));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }
    setReceiving(true);
    try {
      await ReceivableApi.receivePayment(selected.id, companyId, {
        amount,
        paymentMethod: receiveMethod,
      });
      toast.success('Recebimento registrado');
      setReceiveOpen(false);
      setSelected(null);
      await load();
    } catch (err) {
      toast.error(messageFromUnknownError(err));
    } finally {
      setReceiving(false);
    }
  };

  const handleDelete = async (row: AccountsReceivable) => {
    if (!companyId) return;
    if (!confirm(`Excluir título de ${formatCurrency(row.amount)}?`)) return;
    try {
      await ReceivableApi.remove(row.id, companyId);
      toast.success('Título excluído');
      await load();
    } catch (err) {
      toast.error(messageFromUnknownError(err));
    }
  };

  const totals = useMemo(() => {
    const open = items
      .filter((r) => r.paymentStatus !== 'paid' && r.paymentStatus !== 'cancelled')
      .reduce((s, r) => s + r.remainingAmount, 0);
    return { open };
  }, [items]);

  if (!companyId) {
    return <p className="text-sm text-gray-500">Selecione uma empresa.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Em aberto</p>
          <p className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
            {formatCurrency(summary.openTotal)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Vencidos</p>
          <p className="text-xl font-bold text-red-600 mt-1">
            {formatCurrency(summary.overdueTotal)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold">Próx. 7 dias</p>
          <p className="text-xl font-bold text-amber-600 mt-1">
            {formatCurrency(summary.next7Total)}
          </p>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              className="pl-9"
              placeholder="Cliente, descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Em aberto</SelectItem>
              <SelectItem value="overdue">Vencidos</SelectItem>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="paid">Recebidos</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo título
        </Button>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Carregando...
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Wallet className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p>Nenhum título encontrado.</p>
            <p className="text-xs mt-1">
              Vendas no PDV como Fiado ou Boleto geram títulos automaticamente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-left">
                <tr>
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Descrição</th>
                  <th className="px-4 py-3 font-semibold">Vencimento</th>
                  <th className="px-4 py-3 font-semibold text-right">Valor</th>
                  <th className="px-4 py-3 font-semibold text-right">Saldo</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {items.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3">{row.customerName || '—'}</td>
                    <td className="px-4 py-3">
                      <div>{row.description || '—'}</div>
                      {row.installmentIndex != null && row.installmentOf != null && (
                        <div className="text-xs text-gray-500">
                          Parcela {row.installmentIndex}/{row.installmentOf}
                        </div>
                      )}
                      {row.saleId && (
                        <div className="text-xs text-gray-400">Venda #{row.saleId.slice(0, 8)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateBR(row.dueDate)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(row.amount)}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(row.remainingAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(row.paymentStatus)}`}
                      >
                        {row.paymentStatus === 'overdue' ? (
                          <AlertTriangle className="w-3 h-3" />
                        ) : row.paymentStatus === 'paid' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {statusLabel(row.paymentStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        {row.remainingAmount > 0.005 && row.paymentStatus !== 'cancelled' && (
                          <Button size="sm" variant="outline" onClick={() => void openReceive(row)}>
                            Receber
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => void handleDelete(row)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-xs text-gray-500 border-t">
              Lista: {items.length} · saldo filtrado {formatCurrency(totals.open)}
            </div>
          </div>
        )}
      </Card>

      {/* Novo título */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo título a receber</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Cliente</Label>
              <Input
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                placeholder="Nome do cliente"
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ex.: Venda a prazo"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label>1º vencimento</Label>
                <Input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Parcelas</Label>
                <Input
                  value={form.installmentCount}
                  onChange={(e) => setForm((f) => ({ ...f, installmentCount: e.target.value }))}
                  inputMode="numeric"
                />
              </div>
              <div>
                <Label>Referência</Label>
                <Input
                  value={form.referenceNumber}
                  onChange={(e) => setForm((f) => ({ ...f, referenceNumber: e.target.value }))}
                  placeholder="NF / boleto"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleCreate()} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receber */}
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar recebimento</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 py-2">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {selected.customerName || selected.description || 'Título'} · saldo{' '}
                <strong>{formatCurrency(selected.remainingAmount)}</strong>
              </p>
              <div>
                <Label>Valor recebido</Label>
                <Input
                  value={receiveAmount}
                  onChange={(e) => setReceiveAmount(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div>
                <Label>Forma</Label>
                <Select
                  value={receiveMethod}
                  onValueChange={(v) => setReceiveMethod(v as PaymentMethod)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECEIVE_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(receiveMethod === 'money' || receiveMethod === 'pix') && (
                  <p className="text-xs text-gray-500 mt-1">
                    Dinheiro/PIX creditam o caixa aberto, se houver.
                  </p>
                )}
              </div>
              {history.length > 0 && (
                <div className="border rounded-lg p-2 max-h-32 overflow-y-auto text-xs space-y-1">
                  <p className="font-semibold text-gray-500">Histórico</p>
                  {history.map((p) => (
                    <div key={p.id} className="flex justify-between">
                      <span>
                        {formatDateBR(p.paymentDate)} · {p.paymentMethod || '—'}
                      </span>
                      <span>{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleReceive()} disabled={receiving}>
              {receiving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
