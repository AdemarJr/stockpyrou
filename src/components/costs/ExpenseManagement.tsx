import { useState, useEffect } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../ui/alert-dialog';
import { Plus, FileText, Calendar, CheckCircle, Clock, XCircle, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { formatCurrency } from '../../utils/calculations';
import type {
  CostCenter,
  ExpenseType,
  PaymentMethod,
  PaymentStatus,
  PaymentTermsType
} from '../../types/costs';
import type { Supplier } from '../../types';
import { SupplierRepository } from '../../repositories/SupplierRepository';
import { CostRepository } from '../../repositories/CostRepository';

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'pix', label: 'PIX' },
  { value: 'money', label: 'Dinheiro' },
  { value: 'debit', label: 'Cartão de débito' },
  { value: 'credit', label: 'Cartão de crédito' },
  { value: 'bank_transfer', label: 'Transferência bancária' },
  { value: 'boleto', label: 'Boleto' }
];

function paymentMethodLabel(method?: string | null): string {
  if (!method) return '—';
  const row = PAYMENT_METHOD_OPTIONS.find((o) => o.value === method);
  return row?.label ?? method;
}

/** Linha única para listagem (snake_case do Supabase). */
function formatPaymentTermsLine(expense: {
  payment_terms_type?: string | null;
  invoice_days?: number | null;
  installment_count?: number | null;
}): string {
  const t = expense.payment_terms_type || 'avista';
  if (t === 'faturado' && expense.invoice_days != null) {
    return `Faturado ${expense.invoice_days} dia${expense.invoice_days === 1 ? '' : 's'}`;
  }
  if (t === 'parcelado' && expense.installment_count != null) {
    return `Parcelado ${expense.installment_count}x`;
  }
  return 'À vista';
}

function ymdFromDb(value: string | null | undefined): string {
  if (!value) return '';
  return value.split('T')[0];
}

export function ExpenseManagement() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; label: string } | null>(null);
  const [filter, setFilter] = useState('all');
  /** Período por data de vencimento (YYYY-MM-DD), vazio = sem filtro de datas */
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [formData, setFormData] = useState({
    costCenterId: '',
    expenseTypeId: '',
    amount: '',
    description: '',
    referenceNumber: '',
    dueDate: '',
    paymentDate: '',
    paymentStatus: 'pending' as PaymentStatus,
    paymentMethod: '' as PaymentMethod | '',
    paymentTermsType: 'avista' as PaymentTermsType,
    invoiceDays: '',
    installmentCount: '',
    supplierId: ''
  });

  useEffect(() => {
    if (currentCompany?.id) {
      loadData();
    }
  }, [currentCompany?.id, filter, periodFrom, periodTo]);

  const loadData = async () => {
    if (!currentCompany?.id) return;

    if (periodFrom && periodTo && periodFrom > periodTo) {
      toast.error('A data inicial do período deve ser anterior ou igual à data final.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [expensesList, centersList, typesList, suppliersList] = await Promise.all([
        CostRepository.findAllExpenses(currentCompany.id, {
          paymentStatus: filter !== 'all' ? filter : undefined,
          dueDateFrom: periodFrom.trim() || undefined,
          dueDateTo: periodTo.trim() || undefined
        }),
        CostRepository.findAllCostCenters(currentCompany.id),
        CostRepository.findAllExpenseTypes(currentCompany.id),
        SupplierRepository.findAll(currentCompany.id)
      ]);

      setExpenses(expensesList as any[]);
      setCostCenters(centersList);
      setExpenseTypes(typesList);
      setSuppliers(suppliersList);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id || !user?.id) return;

    if (formData.paymentTermsType === 'faturado') {
      const d = parseInt(formData.invoiceDays, 10);
      if (!Number.isFinite(d) || d < 1) {
        toast.error('Informe o prazo em dias para pagamento faturado.');
        return;
      }
    }
    if (formData.paymentTermsType === 'parcelado') {
      const n = parseInt(formData.installmentCount, 10);
      if (!Number.isFinite(n) || n < 2) {
        toast.error('Informe em quantas parcelas (mínimo 2).');
        return;
      }
    }

    if (formData.paymentStatus === 'paid') {
      if (!formData.paymentMethod) {
        toast.error('Informe como foi pago (forma de pagamento).');
        return;
      }
      if (!formData.paymentDate) {
        toast.error('Informe a data do pagamento.');
        return;
      }
    }

    try {
      const paymentMethod =
        formData.paymentStatus === 'paid' && formData.paymentMethod
          ? formData.paymentMethod
          : undefined;
      const paymentDate =
        formData.paymentStatus === 'paid' && formData.paymentDate
          ? formData.paymentDate
          : undefined;

      const paymentTermsType = formData.paymentTermsType;

      if (editingExpenseId) {
        await CostRepository.updateExpense(editingExpenseId, {
          expenseTypeId: formData.expenseTypeId,
          costCenterId: formData.costCenterId,
          amount: parseFloat(formData.amount),
          description: formData.description.trim() || undefined,
          referenceNumber: formData.referenceNumber.trim() || undefined,
          dueDate: formData.dueDate,
          paymentDate,
          paymentStatus: formData.paymentStatus,
          paymentMethod,
          paymentTermsType,
          invoiceDays:
            paymentTermsType === 'faturado' ? parseInt(formData.invoiceDays, 10) : undefined,
          installmentCount:
            paymentTermsType === 'parcelado' ? parseInt(formData.installmentCount, 10) : undefined,
          supplierId: formData.supplierId || null
        });
        toast.success('Despesa atualizada!');
      } else {
        await CostRepository.createExpense({
          companyId: currentCompany.id,
          expenseTypeId: formData.expenseTypeId,
          costCenterId: formData.costCenterId,
          amount: parseFloat(formData.amount),
          description: formData.description.trim() || undefined,
          referenceNumber: formData.referenceNumber.trim() || undefined,
          dueDate: formData.dueDate,
          paymentDate,
          paymentStatus: formData.paymentStatus,
          paymentMethod,
          paymentTermsType,
          invoiceDays:
            paymentTermsType === 'faturado' ? parseInt(formData.invoiceDays, 10) : undefined,
          installmentCount:
            paymentTermsType === 'parcelado' ? parseInt(formData.installmentCount, 10) : undefined,
          supplierId: formData.supplierId || undefined,
          userId: user.id
        });
        toast.success('Despesa registrada com sucesso!');
      }

      setDialogOpen(false);
      setEditingExpenseId(null);
      resetForm();
      loadData();
    } catch (error: unknown) {
      console.error('Error creating expense:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao registrar despesa';
      toast.error(msg);
    }
  };

  const markAsPaid = async (expenseId: string) => {
    try {
      await CostRepository.updateExpense(expenseId, {
        paymentStatus: 'paid',
        paymentDate: new Date().toISOString().split('T')[0]
      });

      toast.success('Despesa marcada como paga!');
      loadData();
    } catch (error: unknown) {
      console.error('Error updating expense:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao atualizar despesa';
      toast.error(msg);
    }
  };

  const populateFromExpense = (expense: any) => {
    const ps = String(expense.payment_status || '');
    const paymentStatus = (
      ['paid', 'pending', 'overdue', 'cancelled'].includes(ps) ? ps : 'pending'
    ) as PaymentStatus;

    setFormData({
      costCenterId: expense.cost_center_id || '',
      expenseTypeId: expense.expense_type_id || '',
      amount: expense.amount != null ? String(expense.amount) : '',
      description: expense.description ?? '',
      referenceNumber: expense.reference_number ?? '',
      dueDate: ymdFromDb(expense.due_date),
      paymentDate: ymdFromDb(expense.payment_date),
      paymentStatus,
      paymentMethod: (expense.payment_method || '') as PaymentMethod | '',
      paymentTermsType: (expense.payment_terms_type || 'avista') as PaymentTermsType,
      invoiceDays: expense.invoice_days != null ? String(expense.invoice_days) : '',
      installmentCount: expense.installment_count != null ? String(expense.installment_count) : '',
      supplierId: expense.supplier_id || ''
    });
    setEditingExpenseId(expense.id);
    setDialogOpen(true);
  };

  const openNewExpense = () => {
    setEditingExpenseId(null);
    resetForm();
    setDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await CostRepository.deleteExpense(deleteTarget.id);
      toast.success('Despesa excluída.');
      setDeleteTarget(null);
      loadData();
    } catch (error: unknown) {
      console.error('Error deleting expense:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao excluir despesa';
      toast.error(msg);
    }
  };

  const resetForm = () => {
    setFormData({
      costCenterId: '',
      expenseTypeId: '',
      amount: '',
      description: '',
      referenceNumber: '',
      dueDate: '',
      paymentDate: '',
      paymentStatus: 'pending',
      paymentMethod: '',
      paymentTermsType: 'avista',
      invoiceDays: '',
      installmentCount: '',
      supplierId: ''
    });
  };

  const setPaymentStatus = (status: PaymentStatus) => {
    setFormData((prev) => {
      if (status === 'paid') {
        const today = new Date().toISOString().split('T')[0];
        return {
          ...prev,
          paymentStatus: status,
          paymentDate: prev.paymentDate || today,
          paymentMethod: prev.paymentMethod || ''
        };
      }
      return {
        ...prev,
        paymentStatus: status,
        paymentDate: '',
        paymentMethod: ''
      };
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'overdue':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      paid: 'Pago',
      pending: 'Pendente',
      overdue: 'Atrasado',
      cancelled: 'Cancelado'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-center text-gray-500">Carregando...</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex flex-col gap-4 mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Despesas Operacionais
            </h2>
            <Button onClick={openNewExpense}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Despesa
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border border-border bg-muted/20">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="paid">Pagas</SelectItem>
                  <SelectItem value="overdue">Atrasadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium text-foreground">Período (vencimento)</span>
            </div>

            <div className="space-y-1">
              <Label htmlFor="periodFrom" className="text-xs text-muted-foreground">
                De
              </Label>
              <Input
                id="periodFrom"
                type="date"
                className="w-[160px]"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="periodTo" className="text-xs text-muted-foreground">
                Até
              </Label>
              <Input
                id="periodTo"
                type="date"
                className="w-[160px]"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const y = now.getFullYear();
                  const m = now.getMonth();
                  const pad = (n: number) => String(n).padStart(2, '0');
                  const first = `${y}-${pad(m + 1)}-01`;
                  const lastDate = new Date(y, m + 1, 0);
                  const last = `${y}-${pad(m + 1)}-${pad(lastDate.getDate())}`;
                  setPeriodFrom(first);
                  setPeriodTo(last);
                }}
              >
                Este mês
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPeriodFrom('');
                  setPeriodTo('');
                }}
              >
                Limpar período
              </Button>
            </div>
          </div>
        </div>

        {expenses.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              {periodFrom || periodTo || filter !== 'all'
                ? 'Nenhuma despesa corresponde aos filtros (status ou período de vencimento).'
                : 'Nenhuma despesa registrada'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b dark:border-gray-700">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Descrição</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Centro</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Tipo</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Fornecedor</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Valor</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Vencimento</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Pagamento</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense: any) => (
                  <tr key={expense.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(expense.payment_status)}
                        <span className="text-sm">{getStatusLabel(expense.payment_status)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium">{expense.description || 'Sem descrição'}</p>
                      {expense.reference_number && (
                        <p className="text-xs text-gray-500">Ref: {expense.reference_number}</p>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">{expense.cost_centers?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">{expense.expense_types?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">{expense.suppliers?.name || '-'}</span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-semibold">{formatCurrency(parseFloat(expense.amount))}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">{new Date(expense.due_date).toLocaleDateString('pt-BR')}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-sm space-y-1">
                        <p className="text-foreground">{formatPaymentTermsLine(expense)}</p>
                        {expense.payment_status === 'paid' ? (
                          <>
                            <p>{paymentMethodLabel(expense.payment_method)}</p>
                            {expense.payment_date && (
                              <p className="text-xs text-gray-500">
                                Pago em {new Date(expense.payment_date).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-gray-500">Ainda não pago</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex flex-wrap items-center justify-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8"
                          onClick={() => populateFromExpense(expense)}
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-destructive hover:text-destructive"
                          onClick={() =>
                            setDeleteTarget({
                              id: expense.id,
                              label: expense.description?.trim() || formatCurrency(parseFloat(expense.amount))
                            })
                          }
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        {expense.payment_status === 'pending' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-8"
                            onClick={() => markAsPaid(expense.id)}
                          >
                            Marcar pago
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
              <span className="mt-2 block font-medium text-foreground">{deleteTarget?.label}</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancelar</AlertDialogCancel>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()}>
              Sim, excluir
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog Form */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingExpenseId(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingExpenseId ? 'Editar despesa operacional' : 'Nova Despesa Operacional'}
            </DialogTitle>
            <DialogDescription>
              {editingExpenseId
                ? 'Altere os dados da despesa e salve.'
                : 'Registre uma nova despesa operacional para o controle de custos.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="costCenter">Centro de Custo *</Label>
                <Select
                  value={formData.costCenterId}
                  onValueChange={(value) => setFormData({ ...formData, costCenterId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.name} ({center.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="expenseType">Tipo de Despesa *</Label>
                <Select
                  value={formData.expenseTypeId}
                  onValueChange={(value) => setFormData({ ...formData, expenseTypeId: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="amount">Valor *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <Label htmlFor="dueDate">Data de Vencimento *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da despesa"
              />
            </div>

            <div>
              <Label htmlFor="referenceNumber">Número de Referência</Label>
              <Input
                id="referenceNumber"
                value={formData.referenceNumber}
                onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })}
                placeholder="NF, Recibo, etc."
              />
            </div>

            <div>
              <Label htmlFor="supplier">Fornecedor</Label>
              <Select
                value={formData.supplierId || 'none'}
                onValueChange={(value) =>
                  setFormData({ ...formData, supplierId: value === 'none' ? '' : value })
                }
              >
                <SelectTrigger id="supplier">
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem fornecedor</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {suppliers.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Cadastre fornecedores em Fornecedores para associar aqui.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/30">
              <p className="text-sm font-medium text-foreground">Pagamento</p>
              <p className="text-xs text-muted-foreground -mt-2">
                Condição negociada com o fornecedor e situação atual do título.
              </p>

              <div>
                <Label htmlFor="paymentTermsType">Tipo de pagamento *</Label>
                <Select
                  value={formData.paymentTermsType}
                  onValueChange={(v) => {
                    const terms = v as PaymentTermsType;
                    setFormData((prev) => ({
                      ...prev,
                      paymentTermsType: terms,
                      invoiceDays: terms === 'faturado' ? prev.invoiceDays || '30' : '',
                      installmentCount: terms === 'parcelado' ? prev.installmentCount || '2' : ''
                    }));
                  }}
                >
                  <SelectTrigger id="paymentTermsType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="avista">À vista</SelectItem>
                    <SelectItem value="faturado">Faturado (prazo em dias)</SelectItem>
                    <SelectItem value="parcelado">Parcelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.paymentTermsType === 'faturado' && (
                <div className="max-w-xs">
                  <Label htmlFor="invoiceDays">Prazo (dias) *</Label>
                  <Input
                    id="invoiceDays"
                    type="number"
                    min={1}
                    step={1}
                    value={formData.invoiceDays}
                    onChange={(e) => setFormData({ ...formData, invoiceDays: e.target.value })}
                    placeholder="ex.: 30, 60"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dias para pagamento após emissão / vencimento conforme combinado.
                  </p>
                </div>
              )}

              {formData.paymentTermsType === 'parcelado' && (
                <div className="max-w-xs">
                  <Label htmlFor="installmentCount">Parcelas *</Label>
                  <Input
                    id="installmentCount"
                    type="number"
                    min={2}
                    step={1}
                    value={formData.installmentCount}
                    onChange={(e) => setFormData({ ...formData, installmentCount: e.target.value })}
                    placeholder="ex.: 3, 6, 12"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Quantidade total de parcelas.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentStatus">Situação do título *</Label>
                  <Select value={formData.paymentStatus} onValueChange={(v) => setPaymentStatus(v as PaymentStatus)}>
                    <SelectTrigger id="paymentStatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">A pagar</SelectItem>
                      <SelectItem value="paid">Já pago</SelectItem>
                      <SelectItem value="overdue">Atrasado</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.paymentStatus === 'paid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="paymentDate">Data do pagamento *</Label>
                    <Input
                      id="paymentDate"
                      type="date"
                      value={formData.paymentDate}
                      onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                      required={formData.paymentStatus === 'paid'}
                    />
                  </div>
                  <div>
                    <Label htmlFor="paymentMethod">Forma de pagamento *</Label>
                    <Select
                      value={formData.paymentMethod || 'none'}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          paymentMethod: value === 'none' ? '' : (value as PaymentMethod)
                        })
                      }
                    >
                      <SelectTrigger id="paymentMethod">
                        <SelectValue placeholder="Como foi pago?" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Selecione</SelectItem>
                        {PAYMENT_METHOD_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editingExpenseId ? 'Salvar alterações' : 'Criar Despesa'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}