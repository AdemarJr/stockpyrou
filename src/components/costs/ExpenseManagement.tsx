import { useState, useEffect, useMemo, useCallback } from 'react';
import { usePagination } from '../../hooks/usePagination';
import { ListPaginationBar } from '../ui/list-pagination-bar';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../ui/alert-dialog';
import {
  Plus,
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
  Pencil,
  Trash2,
  Download,
  Printer,
  Wallet,
  AlertTriangle,
  Landmark,
  CalendarClock,
  Search,
  Package,
  Layers
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { formatCurrency } from '../../utils/calculations';
import { cn } from '../ui/utils';
import type {
  CostCenter,
  ExpenseType,
  PaymentMethod,
  PaymentStatus,
  PaymentTermsType
} from '../../types/costs';
import type { Supplier } from '../../types';
import { SupplierRepository } from '../../repositories/SupplierRepository';
import { ProductRepository } from '../../repositories/ProductRepository';
import { StockRepository } from '../../repositories/StockRepository';
import { CostRepository } from '../../repositories/CostRepository';
import type { StockEntry } from '../../types';
import { rowMatchesSearch } from '../../utils/listFilters';
import { messageFromUnknownError } from '../../utils/errorMessage';
import {
  paidAmountFromExpenseRow as expensePaidAmount,
  remainingFromExpenseRow as expenseRemaining
} from '../../utils/expensePaidAmount';
import { splitTotalIntoParts, sumMoneyParts } from '../../utils/expenseInstallments';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

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
  installment_index?: number | null;
  installment_of?: number | null;
}): string {
  const idx = expense.installment_index;
  const of = expense.installment_of;
  if (idx != null && of != null && of >= 1) {
    return `Parcela ${idx}/${of}`;
  }
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

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function expenseMatchesStatusFilter(
  expense: { payment_status?: string; due_date?: string },
  statusFilter: string,
  todayYmd: string
): boolean {
  if (statusFilter === 'all') return true;
  const st = String(expense.payment_status || '');
  const due = ymdFromDb(expense.due_date);
  if (statusFilter === 'paid') return st === 'paid';
  if (statusFilter === 'cancelled') return st === 'cancelled';
  if (statusFilter === 'pending') return st === 'pending';
  if (statusFilter === 'overdue') {
    return st === 'overdue' || (st === 'pending' && due !== '' && due < todayYmd);
  }
  return true;
}

function csvEscape(cell: string): string {
  const s = String(cell ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildExpenseReportCsvRows(expenses: any[]): string {
  const header = [
    'Status',
    'Descrição',
    'Ref.',
    'Centro de custo',
    'Tipo',
    'Fornecedor',
    'Valor total',
    'Já pago',
    'Saldo',
    'Vencimento',
    'Condição',
    'Forma pagto',
    'Data pagamento'
  ].join(';');
  const lines = expenses.map((e) =>
    [
      getStatusLabelStatic(e.payment_status),
      csvEscape(e.description || ''),
      csvEscape(e.reference_number || ''),
      csvEscape(e.cost_centers?.name || ''),
      csvEscape(e.expense_types?.name || ''),
      csvEscape(e.suppliers?.name || ''),
      (parseFloat(e.amount) || 0).toFixed(2).replace('.', ','),
      expensePaidAmount(e).toFixed(2).replace('.', ','),
      expenseRemaining(e).toFixed(2).replace('.', ','),
      e.due_date ? ymdFromDb(e.due_date) : '',
      csvEscape(formatPaymentTermsLine(e)),
      paymentMethodLabel(e.payment_method),
      e.payment_date ? ymdFromDb(e.payment_date) : ''
    ].join(';')
  );
  return [header, ...lines].join('\r\n');
}

function getStatusLabelStatic(status: string): string {
  const labels: Record<string, string> = {
    paid: 'Pago',
    pending: 'Pendente',
    overdue: 'Atrasado',
    cancelled: 'Cancelado'
  };
  return labels[status] || status;
}

export function ExpenseManagement({
  forcedPeriod
}: {
  /** Período forçado (YYYY-MM-DD) vindo do filtro superior do dashboard. */
  forcedPeriod?: { from: string; to: string };
} = {}) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<
    | { mode: 'single'; id: string; label: string }
    | { mode: 'group'; groupId: string; label: string }
    | null
  >(null);
  const [filter, setFilter] = useState('all');
  /** Período por data de vencimento (YYYY-MM-DD), vazio = sem filtro de datas */
  /** Período aplicado na API / lista (atualiza ao clicar Filtrar, Enter ou atalhos). */
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  /** Rascunho dos campos de data (não dispara carga até aplicar). */
  const [periodDraftFrom, setPeriodDraftFrom] = useState('');
  const [periodDraftTo, setPeriodDraftTo] = useState('');
  const [costCenterFilter, setCostCenterFilter] = useState('');
  const [expenseTypeFilter, setExpenseTypeFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [deleteRunning, setDeleteRunning] = useState(false);
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [paymentDialogExpense, setPaymentDialogExpense] = useState<any | null>(null);
  const [paymentPartialAmount, setPaymentPartialAmount] = useState('');
  const [paymentPartialMethod, setPaymentPartialMethod] = useState<PaymentMethod>('pix');
  const [stockEntriesList, setStockEntriesList] = useState<StockEntry[]>([]);
  const [productNameById, setProductNameById] = useState<Record<string, string>>({});
  /** Busca textual na lista (descrição, ref., nomes, valor) — não altera o recorte do servidor. */
  const [listSearch, setListSearch] = useState('');

  const filteredExpenses = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return expenses.filter((e: any) => {
      if (!expenseMatchesStatusFilter(e, filter, today)) return false;
      if (!listSearch.trim()) return true;
      const amount = parseFloat(String(e.amount ?? '0')) || 0;
      const paid = expensePaidAmount(e) || 0;
      return rowMatchesSearch(listSearch, [
        e.description,
        e.reference_number,
        e.cost_centers?.name,
        e.expense_types?.name,
        e.suppliers?.name,
        // Valor: aceita busca por "100", "100,00", "R$ 100", etc.
        e.amount != null ? String(e.amount) : '',
        amount.toFixed(2),
        amount.toFixed(2).replace('.', ','),
        formatCurrency(amount),
        // Pago: idem
        e.paid_amount != null ? String(e.paid_amount) : '',
        paid.toFixed(2),
        paid.toFixed(2).replace('.', ','),
        formatCurrency(paid)
      ]);
    });
  }, [expenses, filter, listSearch]);

  const expenseKpis = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    let totalPaid = 0;
    let totalOpen = 0;
    let totalOverdue = 0;
    let dueNext7Days = 0;
    let totalCancelled = 0;
    let countOpen = 0;
    const horizon = addDaysYmd(today, 7);

    for (const e of expenses) {
      const amt = parseFloat(e.amount) || 0;
      const paid = expensePaidAmount(e);
      const rem = expenseRemaining(e);
      const st = String(e.payment_status || '');
      const due = ymdFromDb(e.due_date);
      if (st === 'cancelled') {
        totalCancelled += amt;
        continue;
      }
      if (st === 'paid') {
        totalPaid += paid || amt;
        continue;
      }
      totalOpen += rem;
      if (rem > 0) countOpen += 1;
      const trulyOverdue = st === 'overdue' || (st === 'pending' && due !== '' && due < today);
      if (trulyOverdue) {
        totalOverdue += rem;
      } else if (st === 'pending' && due >= today && due <= horizon) {
        dueNext7Days += rem;
      }
    }

    return {
      totalPaid,
      totalOpen,
      totalOverdue,
      dueNext7Days,
      totalCancelled,
      countOpen,
      countAll: expenses.length
    };
  }, [expenses]);

  const listResetKey = `${filter}|${periodFrom}|${periodTo}|${costCenterFilter}|${expenseTypeFilter}|${supplierFilter}|${listSearch}`;
  const {
    paginatedItems,
    page,
    setPage,
    totalPages,
    from,
    to,
    total: pageTotal
  } = usePagination(filteredExpenses, 15, listResetKey);

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
    supplierId: '',
    stockEntryId: ''
  });

  /** Dentro de "Parcelado": um título com N parcelas (resumo) ou N títulos com datas/valores. */
  const [parceladoVariant, setParceladoVariant] = useState<'single_row' | 'multi_dates'>('single_row');
  const [multiParcelCount, setMultiParcelCount] = useState('3');
  const [multiFirstDue, setMultiFirstDue] = useState('');
  const [multiIntervalDays, setMultiIntervalDays] = useState('30');
  const [installmentRows, setInstallmentRows] = useState<{ dueDate: string; amount: string }[]>([]);

  /** Parcelado com uma despesa por parcela (datas/valores); só para nova despesa. */
  const isMultiParcelDates =
    !editingExpenseId &&
    formData.paymentTermsType === 'parcelado' &&
    parceladoVariant === 'multi_dates';

  type ExpenseFieldErrKey =
    | 'costCenterId'
    | 'expenseTypeId'
    | 'amount'
    | 'dueDate'
    | 'invoiceDays'
    | 'installmentCount'
    | 'paymentMethod'
    | 'paymentDate';
  const [expenseFieldErrors, setExpenseFieldErrors] = useState<
    Partial<Record<ExpenseFieldErrKey, boolean>>
  >({});

  useEffect(() => {
    setExpenseFieldErrors({});
  }, [formData]);

  useEffect(() => {
    if (currentCompany?.id) {
      loadData();
    }
  }, [currentCompany?.id, periodFrom, periodTo, costCenterFilter, expenseTypeFilter, supplierFilter]);

  // Sync com o filtro superior do dashboard (mês definido).
  useEffect(() => {
    const fp = forcedPeriod?.from?.trim();
    const tp = forcedPeriod?.to?.trim();
    if (!fp || !tp) return;
    if (fp === periodFrom && tp === periodTo && fp === periodDraftFrom && tp === periodDraftTo) return;
    setPeriodDraftFrom(fp);
    setPeriodDraftTo(tp);
    setPeriodFrom(fp);
    setPeriodTo(tp);
  }, [forcedPeriod?.from, forcedPeriod?.to]);

  useEffect(() => {
    if (!dialogOpen || !currentCompany?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [entries, products] = await Promise.all([
          StockRepository.findAllEntries(currentCompany.id),
          ProductRepository.findAll(currentCompany.id)
        ]);
        if (cancelled) return;
        setStockEntriesList(entries);
        setProductNameById(Object.fromEntries(products.map((p) => [p.id, p.name])));
      } catch (e) {
        console.error('Stock entries for expense form:', e);
        if (!cancelled) {
          setStockEntriesList([]);
          setProductNameById({});
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dialogOpen, currentCompany?.id]);

  const stockEntriesForForm = useMemo(() => {
    const sorted = [...stockEntriesList].sort(
      (a, b) => b.entryDate.getTime() - a.entryDate.getTime()
    );
    const filtered = formData.supplierId
      ? sorted.filter((e) => e.supplierId === formData.supplierId)
      : sorted;
    let list = filtered.slice(0, 100);
    if (formData.stockEntryId && !list.some((e) => e.id === formData.stockEntryId)) {
      const missing = stockEntriesList.find((e) => e.id === formData.stockEntryId);
      if (missing) list = [missing, ...list];
    }
    return list;
  }, [stockEntriesList, formData.supplierId, formData.stockEntryId]);

  const applyPeriodFilters = useCallback(() => {
    if (periodDraftFrom && periodDraftTo && periodDraftFrom > periodDraftTo) {
      toast.error('A data inicial do período deve ser anterior ou igual à data final.');
      return;
    }
    setPeriodFrom(periodDraftFrom);
    setPeriodTo(periodDraftTo);
  }, [periodDraftFrom, periodDraftTo]);

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
          dueDateFrom: periodFrom.trim() || undefined,
          dueDateTo: periodTo.trim() || undefined,
          costCenterId: costCenterFilter || undefined,
          expenseTypeId: expenseTypeFilter || undefined,
          supplierId: supplierFilter || undefined
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

  const fillEqualInstallments = () => {
    const total = parseFloat(formData.amount.replace(',', '.'));
    const n = parseInt(multiParcelCount, 10);
    const first = multiFirstDue.trim() || formData.dueDate.trim();
    const interval = parseInt(multiIntervalDays, 10);
    if (!formData.amount.trim() || !Number.isFinite(total) || total <= 0) {
      toast.error('Informe o valor total da NF.');
      return;
    }
    if (!Number.isFinite(n) || n < 2) {
      toast.error('A quantidade de parcelas deve ser pelo menos 2.');
      return;
    }
    if (!first) {
      toast.error('Informe a data do 1º vencimento.');
      return;
    }
    if (!Number.isFinite(interval) || interval < 0) {
      toast.error('Intervalo entre parcelas inválido.');
      return;
    }
    const parts = splitTotalIntoParts(total, n);
    setInstallmentRows(
      parts.map((amt, i) => ({
        dueDate: addDaysYmd(first, i * interval),
        amount: amt.toFixed(2)
      }))
    );
    toast.success('Parcelas preenchidas. Ajuste datas ou valores se precisar.');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany?.id || !user?.id) return;

    const errs: Partial<Record<ExpenseFieldErrKey, boolean>> = {};
    if (!formData.costCenterId.trim()) errs.costCenterId = true;
    if (!formData.expenseTypeId.trim()) errs.expenseTypeId = true;
    const amountNum = parseFloat(formData.amount.replace(',', '.'));
    if (!formData.amount.trim() || !Number.isFinite(amountNum) || amountNum <= 0) errs.amount = true;
    if (!isMultiParcelDates && !formData.dueDate.trim()) errs.dueDate = true;

    if (editingExpenseId && amountNum > 0) {
      const ex = expenses.find((x: any) => x.id === editingExpenseId);
      const paidSoFar = ex ? expensePaidAmount(ex) : 0;
      if (amountNum + 1e-6 < paidSoFar) {
        toast.error('O valor total não pode ser menor que o já pago.');
        errs.amount = true;
      }
    }

    if (formData.stockEntryId) {
      const se = stockEntriesList.find((s) => s.id === formData.stockEntryId);
      if (se && formData.supplierId && se.supplierId && se.supplierId !== formData.supplierId) {
        toast.error('O fornecedor deve ser o mesmo da entrada de estoque selecionada.');
        return;
      }
    }

    if (!editingExpenseId && isMultiParcelDates) {
      if (formData.stockEntryId) {
        toast.error('Remova o vínculo com estoque para lançar várias parcelas.');
        return;
      }
      if (formData.paymentStatus !== 'pending') {
        toast.error('Crie as parcelas como "A pagar" e registre pagamentos na lista.');
        return;
      }
      if (installmentRows.length < 2) {
        toast.error('Defina pelo menos 2 parcelas com datas e valores.');
        return;
      }
      const parts = installmentRows.map((r) => parseFloat(String(r.amount).replace(',', '.')));
      if (parts.some((p) => !Number.isFinite(p) || p <= 0)) {
        toast.error('Cada parcela precisa de valor maior que zero.');
        return;
      }
      if (installmentRows.some((r) => !r.dueDate?.trim())) {
        toast.error('Informe a data de vencimento de cada parcela.');
        return;
      }
      const sum = sumMoneyParts(parts);
      if (Math.abs(sum - amountNum) > 0.02) {
        toast.error(
          `A soma das parcelas (${sum.toFixed(2)}) deve igualar o valor total (${amountNum.toFixed(2)}).`
        );
        return;
      }
    }

    if (formData.paymentTermsType === 'faturado') {
      const d = parseInt(formData.invoiceDays, 10);
      if (!Number.isFinite(d) || d < 1) errs.invoiceDays = true;
    }
    if (formData.paymentTermsType === 'parcelado' && !isMultiParcelDates) {
      const n = parseInt(formData.installmentCount, 10);
      if (!Number.isFinite(n) || n < 2) errs.installmentCount = true;
    }

    if (formData.paymentStatus === 'paid') {
      if (!formData.paymentMethod) errs.paymentMethod = true;
      if (!formData.paymentDate) errs.paymentDate = true;
    }

    if (Object.keys(errs).length > 0) {
      setExpenseFieldErrors(errs);
      return;
    }

    setSubmitLoading(true);
    try {
      // Importante: salvar forma de pagamento mesmo quando está "a pagar",
      // para boletos/parcelas exibirem corretamente e manter rastreio.
      // Quando pago, continua obrigatório.
      const paymentMethod = formData.paymentMethod ? formData.paymentMethod : undefined;
      const paymentDate =
        formData.paymentStatus === 'paid' && formData.paymentDate
          ? formData.paymentDate
          : undefined;

      const paymentTermsType = formData.paymentTermsType;

      if (!editingExpenseId && isMultiParcelDates) {
        const groupId = crypto.randomUUID();
        const n = installmentRows.length;
        const baseDesc = formData.description.trim();
        const ref = formData.referenceNumber.trim();
        const items = installmentRows.map((row, i) => ({
          companyId: currentCompany.id,
          expenseTypeId: formData.expenseTypeId,
          costCenterId: formData.costCenterId,
          amount: parseFloat(String(row.amount).replace(',', '.')),
          description: n > 1 ? `${baseDesc || 'Despesa'} (Parcela ${i + 1}/${n})` : baseDesc || undefined,
          referenceNumber: ref || undefined,
          // Cada parcela precisa respeitar o vencimento informado pelo usuário
          // (não gerar/derivar a partir da data base).
          dueDate: row.dueDate,
          paymentDate: undefined,
          paymentStatus: 'pending' as PaymentStatus,
          paymentMethod,
          paymentTermsType: 'parcelado' as const,
          invoiceDays: undefined,
          installmentCount: n,
          expenseGroupId: groupId,
          installmentIndex: i + 1,
          installmentOf: n,
          supplierId: formData.supplierId || undefined,
          stockEntryId: undefined,
          userId: user.id
        }));
        await CostRepository.createExpensesBatch(items);
        toast.success(`${n} parcelas registradas com sucesso.`);
        setDialogOpen(false);
        setEditingExpenseId(null);
        resetForm();
        loadData();
        return;
      }

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
          supplierId: formData.supplierId || null,
          stockEntryId: formData.stockEntryId || null
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
          stockEntryId: formData.stockEntryId || undefined,
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
      toast.error(messageFromUnknownError(error));
    } finally {
      setSubmitLoading(false);
    }
  };

  const openPaymentDialog = (expense: any) => {
    const rem = expenseRemaining(expense);
    if (rem <= 0) {
      toast.info('Não há saldo em aberto para esta despesa.');
      return;
    }
    setPaymentDialogExpense(expense);
    setPaymentPartialAmount(rem.toFixed(2).replace('.', ','));
    const raw = expense.payment_method;
    setPaymentPartialMethod(
      PAYMENT_METHOD_OPTIONS.some((o) => o.value === raw) ? (raw as PaymentMethod) : 'pix'
    );
  };

  const submitPartialPayment = async () => {
    if (!paymentDialogExpense) return;
    const raw = paymentPartialAmount.replace(/\s/g, '').replace(',', '.');
    const val = parseFloat(raw);
    if (!Number.isFinite(val) || val <= 0) {
      toast.error('Informe um valor válido maior que zero.');
      return;
    }
    const rem = expenseRemaining(paymentDialogExpense);
    if (val > rem + 0.0001) {
      toast.error(`O valor não pode ser maior que o saldo (${formatCurrency(rem)}).`);
      return;
    }

    setMarkPaidId(paymentDialogExpense.id);
    try {
      await CostRepository.registerExpensePayment(paymentDialogExpense.id, val, paymentPartialMethod);
      const willClose = val >= rem - 0.005;
      toast.success(willClose ? 'Despesa quitada.' : 'Pagamento parcial registrado.');
      setPaymentDialogExpense(null);
      loadData();
    } catch (error: unknown) {
      console.error('Error registering payment:', error);
      toast.error(messageFromUnknownError(error));
    } finally {
      setMarkPaidId(null);
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
      supplierId: expense.supplier_id || '',
      stockEntryId: expense.stock_entry_id || ''
    });
    setParceladoVariant('single_row');
    setInstallmentRows([]);
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
    setDeleteRunning(true);
    try {
      if (deleteTarget.mode === 'group') {
        if (!currentCompany?.id) return;
        await CostRepository.deleteExpenseGroup(currentCompany.id, deleteTarget.groupId);
        toast.success('Todas as parcelas do grupo foram excluídas.');
      } else {
        await CostRepository.deleteExpense(deleteTarget.id);
        toast.success('Despesa excluída.');
      }
      setDeleteTarget(null);
      loadData();
    } catch (error: unknown) {
      console.error('Error deleting expense:', error);
      const msg = error instanceof Error ? error.message : 'Erro ao excluir despesa';
      toast.error(msg);
    } finally {
      setDeleteRunning(false);
    }
  };

  const handleExportCsv = useCallback(() => {
    if (filteredExpenses.length === 0) {
      toast.error('Nenhuma despesa para exportar com os filtros atuais.');
      return;
    }
    const csv = buildExpenseReportCsvRows(filteredExpenses);
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeName = (currentCompany?.name || 'empresa').replace(/[^\w\-]+/g, '_');
    a.href = url;
    a.download = `despesas_${safeName}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo CSV gerado.');
  }, [filteredExpenses, currentCompany?.name]);

  const handlePrint = useCallback(() => {
    if (filteredExpenses.length === 0) {
      toast.error('Nenhuma despesa para imprimir com os filtros atuais.');
      return;
    }
    const w = window.open('', '_blank');
    if (!w) {
      toast.error('Permita pop-ups para imprimir o relatório.');
      return;
    }
    const companyName = currentCompany?.name || 'Empresa';
    const periodLabel =
      periodFrom || periodTo
        ? `Vencimento de ${periodFrom || '…'} até ${periodTo || '…'}`
        : 'Todos os vencimentos (sem período)';
    const filterLabel =
      filter === 'all'
        ? 'Todos os status'
        : filter === 'pending'
          ? 'Pendentes'
          : filter === 'paid'
            ? 'Pagas'
            : filter === 'overdue'
              ? 'Atrasadas'
              : filter === 'cancelled'
                ? 'Canceladas'
                : filter;

    const rowsHtml = filteredExpenses
      .map((e: any) => {
        const amt = formatCurrency(parseFloat(e.amount));
        const saldo = formatCurrency(expenseRemaining(e));
        const due = e.due_date ? new Date(e.due_date).toLocaleDateString('pt-BR') : '—';
        const paidDt = e.payment_date ? new Date(e.payment_date).toLocaleDateString('pt-BR') : '—';
        return `<tr>
          <td>${getStatusLabelStatic(e.payment_status)}</td>
          <td>${(e.description || '—').replace(/</g, '&lt;')}</td>
          <td>${(e.cost_centers?.name || '—').replace(/</g, '&lt;')}</td>
          <td>${(e.expense_types?.name || '—').replace(/</g, '&lt;')}</td>
          <td>${(e.suppliers?.name || '—').replace(/</g, '&lt;')}</td>
          <td style="text-align:right">${amt}</td>
          <td style="text-align:right">${saldo}</td>
          <td>${due}</td>
          <td>${paidDt}</td>
        </tr>`;
      })
      .join('');

    w.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Despesas — ${companyName}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 1.25rem; margin: 0 0 4px; }
        .meta { color: #555; font-size: 0.85rem; margin-bottom: 16px; }
        .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 10px; }
        .kpi span { display: block; font-size: 0.75rem; color: #666; }
        .kpi strong { font-size: 1.1rem; }
        table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
        th { background: #f5f5f5; }
        @media print { body { padding: 12px; } }
      </style></head><body>
      <h1>Relatório de despesas operacionais</h1>
      <div class="meta">${companyName} · ${periodLabel} · ${filterLabel}</div>
      <div class="kpis">
        <div class="kpi"><span>Em aberto (a pagar)</span><strong>${formatCurrency(expenseKpis.totalOpen)}</strong></div>
        <div class="kpi"><span>Já pago (período filtrado)</span><strong>${formatCurrency(expenseKpis.totalPaid)}</strong></div>
        <div class="kpi"><span>Atrasado</span><strong>${formatCurrency(expenseKpis.totalOverdue)}</strong></div>
        <div class="kpi"><span>Vence em 7 dias</span><strong>${formatCurrency(expenseKpis.dueNext7Days)}</strong></div>
      </div>
      <table><thead><tr>
        <th>Status</th><th>Descrição</th><th>Centro</th><th>Tipo</th><th>Fornecedor</th><th>Valor total</th><th>Saldo</th><th>Venc.</th><th>Últ. pagamento</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      <p class="meta" style="margin-top:16px">Gerado em ${new Date().toLocaleString('pt-BR')} · ${filteredExpenses.length} título(s)</p>
      </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => {
      w.print();
      w.close();
    }, 250);
  }, [
    filteredExpenses,
    currentCompany?.name,
    periodFrom,
    periodTo,
    filter,
    expenseKpis.totalOpen,
    expenseKpis.totalPaid,
    expenseKpis.totalOverdue,
    expenseKpis.dueNext7Days
  ]);

  const resetForm = () => {
    setExpenseFieldErrors({});
    setParceladoVariant('single_row');
    setMultiParcelCount('3');
    setMultiFirstDue('');
    setMultiIntervalDays('30');
    setInstallmentRows([]);
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
      supplierId: '',
      stockEntryId: ''
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
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Despesas Operacionais
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Visão financeira por vencimento, centro de custo e status. Exporte ou imprima o que está filtrado na
                tabela.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={handleExportCsv}>
                <Download className="w-4 h-4 mr-2" />
                Exportar CSV
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
              <Button onClick={openNewExpense}>
                <Plus className="w-4 h-4 mr-2" />
                Nova Despesa
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-4 flex gap-3">
              <div className="p-2 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-400">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">A pagar (em aberto)</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(expenseKpis.totalOpen)}</p>
                <p className="text-[11px] text-muted-foreground">
                  {expenseKpis.countOpen} título{expenseKpis.countOpen === 1 ? '' : 's'}
                </p>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 flex gap-3">
              <div className="p-2 rounded-md bg-green-500/15 text-green-700 dark:text-green-400">
                <Landmark className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">Já pago</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(expenseKpis.totalPaid)}</p>
                <p className="text-[11px] text-muted-foreground">No recorte filtrado acima</p>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 flex gap-3">
              <div className="p-2 rounded-md bg-red-500/15 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">Atrasado</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(expenseKpis.totalOverdue)}</p>
                <p className="text-[11px] text-muted-foreground">Inclui pendente com vencimento passado</p>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4 flex gap-3">
              <div className="p-2 rounded-md bg-blue-500/15 text-blue-700 dark:text-blue-400">
                <CalendarClock className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium">Vence nos próximos 7 dias</p>
                <p className="text-lg font-semibold tabular-nums">{formatCurrency(expenseKpis.dueNext7Days)}</p>
                <p className="text-[11px] text-muted-foreground">Pendentes no prazo, até a semana</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border border-border bg-muted/20">
            <div className="w-full min-w-0 space-y-1">
              <Label htmlFor="expenseListSearch" className="text-xs text-muted-foreground">
                Buscar na listagem (nome, ref., fornecedor, valor…)
              </Label>
              <div className="relative max-w-xl">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="expenseListSearch"
                  type="search"
                  placeholder="Filtra os resultados já carregados…"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Status (lista)</Label>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="paid">Pagas</SelectItem>
                  <SelectItem value="overdue">Atrasadas</SelectItem>
                  <SelectItem value="cancelled">Canceladas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Centro de custo</Label>
              <Select
                value={costCenterFilter || 'all'}
                onValueChange={(v) => setCostCenterFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {costCenters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tipo de despesa</Label>
              <Select
                value={expenseTypeFilter || 'all'}
                onValueChange={(v) => setExpenseTypeFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {expenseTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Fornecedor</Label>
              <Select
                value={supplierFilter || 'all'}
                onValueChange={(v) => setSupplierFilter(v === 'all' ? '' : v)}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground ml-auto">
              <Calendar className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium text-foreground">Vencimento</span>
            </div>

            <div className="space-y-1">
              <Label htmlFor="periodFrom" className="text-xs text-muted-foreground">
                De
              </Label>
              <Input
                id="periodFrom"
                type="date"
                className="w-[160px]"
                value={periodDraftFrom}
                onChange={(e) => setPeriodDraftFrom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyPeriodFilters();
                  }
                }}
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
                value={periodDraftTo}
                onChange={(e) => setPeriodDraftTo(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyPeriodFilters();
                  }
                }}
              />
            </div>

            <div className="flex flex-wrap gap-2 items-end">
              <Button type="button" variant="default" size="sm" onClick={() => applyPeriodFilters()}>
                Filtrar período
              </Button>
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
                  setPeriodDraftFrom(first);
                  setPeriodDraftTo(last);
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
                  setPeriodDraftFrom('');
                  setPeriodDraftTo('');
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
              {periodFrom || periodTo || costCenterFilter || expenseTypeFilter || supplierFilter
                ? 'Nenhuma despesa corresponde ao período ou aos filtros de centro / tipo / fornecedor.'
                : 'Nenhuma despesa registrada'}
            </p>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              Nenhuma despesa com o status selecionado. Ajuste o filtro &quot;Status (lista)&quot; ou use
              &quot;Todas&quot;.
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
                {paginatedItems.map((expense: any) => (
                  <tr key={expense.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(expense.payment_status)}
                        <span className="text-sm">{getStatusLabel(expense.payment_status)}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{expense.description || 'Sem descrição'}</p>
                        {expense.installment_index != null &&
                          expense.installment_of != null &&
                          expense.installment_of >= 1 && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                              {expense.installment_index}/{expense.installment_of}
                            </span>
                          )}
                      </div>
                      {expense.reference_number && (
                        <p className="text-xs text-gray-500">Ref: {expense.reference_number}</p>
                      )}
                      {expense.linked_stock_entry && (
                        <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 flex items-center gap-1">
                          <Package className="w-3 h-3 shrink-0" />
                          Estoque:{' '}
                          {(
                            expense.linked_stock_entry.products as { name?: string } | null | undefined
                          )?.name ?? 'Compra'}{' '}
                          · {formatCurrency(parseFloat(String(expense.linked_stock_entry.total_cost)))}
                        </p>
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
                      <span className="text-sm font-semibold">
                        {formatCurrency(parseFloat(expense.amount))}
                      </span>
                      {expensePaidAmount(expense) > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Pago {formatCurrency(expensePaidAmount(expense))} · Saldo{' '}
                          {formatCurrency(expenseRemaining(expense))}
                        </p>
                      )}
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
                        ) : expensePaidAmount(expense) > 0 ? (
                          <p className="text-xs text-amber-700 dark:text-amber-500">
                            Pagamento parcial
                            {expense.payment_date && (
                              <> · último em {new Date(expense.payment_date).toLocaleDateString('pt-BR')}</>
                            )}
                          </p>
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
                          disabled={!!markPaidId}
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
                              mode: 'single',
                              id: expense.id,
                              label: expense.description?.trim() || formatCurrency(parseFloat(expense.amount))
                            })
                          }
                          title="Excluir esta parcela"
                          disabled={!!markPaidId}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                        {expense.expense_group_id && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-destructive hover:text-destructive"
                            onClick={() =>
                              setDeleteTarget({
                                mode: 'group',
                                groupId: expense.expense_group_id,
                                label:
                                  expense.reference_number?.trim() ||
                                  `Grupo ${String(expense.expense_group_id).slice(0, 8)}… · ${
                                    expense.installment_of ?? '?'
                                  } parcelas`
                              })
                            }
                            title="Excluir todas as parcelas desta NF"
                            disabled={!!markPaidId}
                          >
                            <Layers className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {(expense.payment_status === 'pending' || expense.payment_status === 'overdue') &&
                          expenseRemaining(expense) > 0 && (
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="h-8"
                            onClick={() => openPaymentDialog(expense)}
                            disabled={markPaidId !== null}
                          >
                            {markPaidId === expense.id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span className="ml-1">Salvando…</span>
                              </>
                            ) : (
                              'Pagamento'
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {totalPages > 1 && (
              <ListPaginationBar
                page={page}
                totalPages={totalPages}
                from={from}
                to={to}
                total={pageTotal}
                onPageChange={setPage}
                className="mt-4"
              />
            )}
          </div>
        )}
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.mode === 'group' ? (
                <>
                  Todas as parcelas vinculadas a esta nota serão excluídas. Esta ação não pode ser desfeita.
                  <span className="mt-2 block font-medium text-foreground">{deleteTarget.label}</span>
                </>
              ) : (
                <>
                  Tem certeza que deseja excluir esta despesa? Esta ação não pode ser desfeita.
                  <span className="mt-2 block font-medium text-foreground">{deleteTarget?.label}</span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={deleteRunning}>
              Cancelar
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteRunning}
              onClick={() => void confirmDelete()}
            >
              {deleteRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Excluindo…
                </>
              ) : (
                'Sim, excluir'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!paymentDialogExpense}
        onOpenChange={(open) => {
          if (!open) setPaymentDialogExpense(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar pagamento</DialogTitle>
            <DialogDescription>
              Informe o valor pago agora. Se for menor que o saldo, a despesa continua pendente (ou
              atrasada) até quitar.
            </DialogDescription>
          </DialogHeader>
          {paymentDialogExpense && (
            <div className="space-y-4 py-1">
              <p className="text-sm rounded-md bg-muted/60 px-3 py-2">
                Total {formatCurrency(parseFloat(paymentDialogExpense.amount))} · Saldo em aberto{' '}
                <span className="font-semibold">
                  {formatCurrency(expenseRemaining(paymentDialogExpense))}
                </span>
              </p>
              <div className="space-y-2">
                <Label htmlFor="expense-partial-pay-amount">Valor deste pagamento</Label>
                <Input
                  id="expense-partial-pay-amount"
                  inputMode="decimal"
                  value={paymentPartialAmount}
                  onChange={(e) => setPaymentPartialAmount(e.target.value)}
                  placeholder="0,00"
                  disabled={markPaidId !== null}
                  className={cn(markPaidId && 'opacity-70')}
                />
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select
                  value={paymentPartialMethod}
                  onValueChange={(v) => setPaymentPartialMethod(v as PaymentMethod)}
                  disabled={markPaidId !== null}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentDialogExpense(null)}
              disabled={markPaidId !== null}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void submitPartialPayment()}
              disabled={markPaidId !== null}
            >
              {markPaidId ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2 inline" />
                  Salvando…
                </>
              ) : (
                'Confirmar pagamento'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <Label htmlFor="costCenter" className={cn(expenseFieldErrors.costCenterId && 'text-destructive')}>
                  Centro de Custo <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.costCenterId}
                  onValueChange={(value) => setFormData({ ...formData, costCenterId: value })}
                >
                  <SelectTrigger aria-invalid={!!expenseFieldErrors.costCenterId}>
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
                <Label htmlFor="expenseType" className={cn(expenseFieldErrors.expenseTypeId && 'text-destructive')}>
                  Tipo de Despesa <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.expenseTypeId}
                  onValueChange={(value) => setFormData({ ...formData, expenseTypeId: value })}
                >
                  <SelectTrigger aria-invalid={!!expenseFieldErrors.expenseTypeId}>
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
                <Label htmlFor="amount" className={cn(expenseFieldErrors.amount && 'text-destructive')}>
                  {isMultiParcelDates ? 'Valor total (NF)' : 'Valor'}{' '}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  aria-invalid={!!expenseFieldErrors.amount}
                />
              </div>

              {!isMultiParcelDates || editingExpenseId ? (
                <div>
                  <Label htmlFor="dueDate" className={cn(expenseFieldErrors.dueDate && 'text-destructive')}>
                    Data de Vencimento <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    aria-invalid={!!expenseFieldErrors.dueDate}
                  />
                </div>
              ) : (
                <div className="flex flex-col justify-end text-sm text-muted-foreground pb-1">
                  <span>Vencimentos na seção Pagamento (parcelas com datas).</span>
                </div>
              )}
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
                onValueChange={(value) => {
                  const supplierId = value === 'none' ? '' : value;
                  setFormData((prev) => {
                    let stockEntryId = prev.stockEntryId;
                    if (stockEntryId) {
                      const se = stockEntriesList.find((s) => s.id === stockEntryId);
                      if (se?.supplierId && supplierId && se.supplierId !== supplierId) {
                        stockEntryId = '';
                      }
                    }
                    return { ...prev, supplierId, stockEntryId };
                  });
                }}
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

            <div>
              <Label htmlFor="stockEntryLink">Vínculo com estoque (opcional)</Label>
              <Select
                value={formData.stockEntryId || 'none'}
                disabled={isMultiParcelDates}
                onValueChange={(value) => {
                  if (value === 'none') {
                    setFormData((prev) => ({ ...prev, stockEntryId: '' }));
                    return;
                  }
                  const se = stockEntriesList.find((s) => s.id === value);
                  setFormData((prev) => ({
                    ...prev,
                    stockEntryId: value,
                    supplierId: se?.supplierId || prev.supplierId
                  }));
                }}
              >
                <SelectTrigger id="stockEntryLink" className="w-full">
                  <SelectValue placeholder="Nenhuma entrada vinculada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo com entrada de estoque</SelectItem>
                  {stockEntriesForForm.map((e) => {
                    const pname = productNameById[e.productId] || 'Produto';
                    const d = e.entryDate.toLocaleDateString('pt-BR');
                    return (
                      <SelectItem key={e.id} value={e.id}>
                        {d} · {pname} · {formatCurrency(e.totalPrice)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1.5">
                <Package className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Associe a despesa à compra registrada em <strong>Estoque → Entradas</strong>. Ao
                escolher uma entrada, o fornecedor é alinhado ao da compra quando aplicável.
              </p>
              {isMultiParcelDates && (
                <p className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                  Com parcelamento por várias datas, o vínculo com uma única entrada de estoque fica desativado.
                </p>
              )}
              {formData.supplierId && stockEntriesForForm.length === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  Nenhuma entrada de estoque para este fornecedor. Cadastre uma entrada em Estoque ou
                  remova o filtro de fornecedor.
                </p>
              )}
            </div>

            <div className="rounded-lg border border-border p-4 space-y-4 bg-muted/30">
              <p className="text-sm font-medium text-foreground">Pagamento</p>
              <p className="text-xs text-muted-foreground -mt-2">
                Condição negociada com o fornecedor e situação atual do título.
              </p>

              <div>
                <Label htmlFor="paymentTermsType">
                  Tipo de pagamento <span className="text-destructive">*</span>
                </Label>
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
                    if (terms !== 'parcelado') {
                      setParceladoVariant('single_row');
                      setInstallmentRows([]);
                    }
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
                  <Label htmlFor="invoiceDays" className={cn(expenseFieldErrors.invoiceDays && 'text-destructive')}>
                    Prazo (dias) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="invoiceDays"
                    type="number"
                    min={1}
                    step={1}
                    value={formData.invoiceDays}
                    onChange={(e) => setFormData({ ...formData, invoiceDays: e.target.value })}
                    placeholder="ex.: 30, 60"
                    aria-invalid={!!expenseFieldErrors.invoiceDays}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dias para pagamento após emissão / vencimento conforme combinado.
                  </p>
                </div>
              )}

              {formData.paymentTermsType === 'parcelado' && !editingExpenseId && (
                <div className="rounded-md border border-border bg-background p-3 space-y-3">
                  <Label className="text-xs font-medium text-foreground">Parcelamento</Label>
                  <RadioGroup
                    value={parceladoVariant}
                    onValueChange={(v) => {
                      const next = v as 'single_row' | 'multi_dates';
                      setParceladoVariant(next);
                      if (next === 'multi_dates') {
                        setFormData((prev) => ({ ...prev, stockEntryId: '' }));
                        setMultiFirstDue((prev) => prev || formData.dueDate);
                      } else {
                        setInstallmentRows([]);
                      }
                    }}
                    className="gap-3"
                  >
                    <div className="flex items-start gap-2.5">
                      <RadioGroupItem value="single_row" id="pv-single" className="mt-0.5" />
                      <label htmlFor="pv-single" className="text-sm leading-snug cursor-pointer">
                        <span className="font-medium">Um título na lista</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          Informe a quantidade de parcelas; permanece uma única despesa.
                        </span>
                      </label>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <RadioGroupItem value="multi_dates" id="pv-multi" className="mt-0.5" />
                      <label htmlFor="pv-multi" className="text-sm leading-snug cursor-pointer">
                        <span className="font-medium">Várias datas (faturado em vezes)</span>
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          Uma despesa por parcela, com vencimento e valor; a soma fecha o total da NF.
                        </span>
                      </label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {formData.paymentTermsType === 'parcelado' && parceladoVariant === 'single_row' && (
                <div className="max-w-xs">
                  <Label htmlFor="installmentCount" className={cn(expenseFieldErrors.installmentCount && 'text-destructive')}>
                    Parcelas <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="installmentCount"
                    type="number"
                    min={2}
                    step={1}
                    value={formData.installmentCount}
                    onChange={(e) => setFormData({ ...formData, installmentCount: e.target.value })}
                    placeholder="ex.: 3, 6, 12"
                    aria-invalid={!!expenseFieldErrors.installmentCount}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Quantidade total de parcelas (título único).</p>
                </div>
              )}

              {isMultiParcelDates && (
                <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/20">
                  <p className="text-sm font-medium">Parcelas (datas e valores)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Quantidade</Label>
                      <Input
                        type="number"
                        min={2}
                        step={1}
                        value={multiParcelCount}
                        onChange={(e) => {
                          setMultiParcelCount(e.target.value);
                          setFormData((prev) => ({ ...prev, installmentCount: e.target.value }));
                        }}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">1º vencimento</Label>
                      <Input
                        type="date"
                        value={multiFirstDue}
                        onChange={(e) => setMultiFirstDue(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Intervalo (dias)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={multiIntervalDays}
                        onChange={(e) => setMultiIntervalDays(e.target.value)}
                      />
                    </div>
                    <div className="flex items-end">
                      <Button type="button" variant="secondary" className="w-full" onClick={fillEqualInstallments}>
                        Preencher parcelas iguais
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gera valores iguais (centavos na última parcela) e datas somando o intervalo. Edite a tabela
                    abaixo se precisar.
                  </p>
                  {installmentRows.length > 0 && (
                    <div className="overflow-x-auto border rounded-md">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left p-2 w-12">#</th>
                            <th className="text-left p-2">Vencimento</th>
                            <th className="text-right p-2">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {installmentRows.map((row, idx) => (
                            <tr key={idx} className="border-b border-border/60">
                              <td className="p-2 text-muted-foreground">{idx + 1}</td>
                              <td className="p-2">
                                <Input
                                  type="date"
                                  className="h-8"
                                  value={row.dueDate}
                                  onChange={(e) => {
                                    const next = [...installmentRows];
                                    next[idx] = { ...next[idx], dueDate: e.target.value };
                                    setInstallmentRows(next);
                                  }}
                                />
                              </td>
                              <td className="p-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  className="h-8 text-right"
                                  value={row.amount}
                                  onChange={(e) => {
                                    const next = [...installmentRows];
                                    next[idx] = { ...next[idx], amount: e.target.value };
                                    setInstallmentRows(next);
                                  }}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {installmentRows.length > 0 && formData.amount.trim() && (
                    <p className="text-xs">
                      Soma das parcelas:{' '}
                      <span className="font-semibold">
                        {sumMoneyParts(
                          installmentRows.map((r) => parseFloat(String(r.amount).replace(',', '.')) || 0)
                        ).toFixed(2)}
                      </span>{' '}
                      · Total informado:{' '}
                      <span className="font-semibold">
                        {parseFloat(formData.amount.replace(',', '.')).toFixed(2)}
                      </span>
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="paymentStatus">
                    Situação do título <span className="text-destructive">*</span>
                  </Label>
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
                    <Label htmlFor="paymentDate" className={cn(expenseFieldErrors.paymentDate && 'text-destructive')}>
                      Data do pagamento <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="paymentDate"
                      type="date"
                      value={formData.paymentDate}
                      onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                      aria-invalid={!!expenseFieldErrors.paymentDate}
                    />
                  </div>
                  <div>
                    <Label htmlFor="paymentMethod" className={cn(expenseFieldErrors.paymentMethod && 'text-destructive')}>
                      Forma de pagamento <span className="text-destructive">*</span>
                    </Label>
                    <Select
                      value={formData.paymentMethod || 'none'}
                      onValueChange={(value) =>
                        setFormData({
                          ...formData,
                          paymentMethod: value === 'none' ? '' : (value as PaymentMethod)
                        })
                      }
                    >
                      <SelectTrigger id="paymentMethod" aria-invalid={!!expenseFieldErrors.paymentMethod}>
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
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitLoading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={submitLoading}>
                {submitLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {editingExpenseId ? 'Salvando…' : isMultiParcelDates ? 'Criando parcelas…' : 'Registrando…'}
                  </>
                ) : editingExpenseId ? (
                  'Salvar alterações'
                ) : isMultiParcelDates ? (
                  'Criar parcelas'
                ) : (
                  'Criar Despesa'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}