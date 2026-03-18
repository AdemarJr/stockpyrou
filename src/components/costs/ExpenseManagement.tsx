import { useState, useEffect } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Plus, FileText, DollarSign, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { formatCurrency } from '../../utils/calculations';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import type { OperationalExpense, CostCenter, ExpenseType } from '../../types/costs';

export function ExpenseManagement() {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [expenseTypes, setExpenseTypes] = useState<ExpenseType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [formData, setFormData] = useState({
    costCenterId: '',
    expenseTypeId: '',
    amount: '',
    description: '',
    referenceNumber: '',
    dueDate: '',
    paymentDate: '',
    paymentStatus: 'pending' as const,
    paymentMethod: ''
  });

  useEffect(() => {
    if (currentCompany?.id) {
      loadData();
    }
  }, [currentCompany?.id, filter]);

  const loadData = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const [expensesRes, centersRes, typesRes] = await Promise.all([
        fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/costs/expenses${
            filter !== 'all' ? `?paymentStatus=${filter}` : ''
          }`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'X-Company-Id': currentCompany.id
            }
          }
        ),
        fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/costs/centers`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'X-Company-Id': currentCompany.id
            }
          }
        ),
        fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/costs/expense-types`,
          {
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'X-Company-Id': currentCompany.id
            }
          }
        )
      ]);

      const [expensesData, centersData, typesData] = await Promise.all([
        expensesRes.json(),
        centersRes.json(),
        typesRes.json()
      ]);

      setExpenses(expensesData.expenses || []);
      setCostCenters(centersData.centers || []);
      setExpenseTypes(typesData.types || []);
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

    try {
      const payload = {
        company_id: currentCompany.id,
        expense_type_id: formData.expenseTypeId,
        cost_center_id: formData.costCenterId,
        amount: parseFloat(formData.amount),
        description: formData.description,
        reference_number: formData.referenceNumber,
        due_date: formData.dueDate,
        payment_date: formData.paymentDate || null,
        payment_status: formData.paymentStatus,
        payment_method: formData.paymentMethod || null,
        user_id: user.id
      };

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/costs/expenses`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
            'X-Company-Id': currentCompany.id
          },
          body: JSON.stringify(payload)
        }
      );

      if (!res.ok) throw new Error('Failed to create expense');

      toast.success('Despesa registrada com sucesso!');
      setDialogOpen(false);
      resetForm();
      loadData();
    } catch (error) {
      console.error('Error creating expense:', error);
      toast.error('Erro ao registrar despesa');
    }
  };

  const markAsPaid = async (expenseId: string) => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/costs/expenses/${expenseId}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json',
            'X-Company-Id': currentCompany?.id || ''
          },
          body: JSON.stringify({
            payment_status: 'paid',
            payment_date: new Date().toISOString().split('T')[0]
          })
        }
      );

      if (!res.ok) throw new Error('Failed to update expense');

      toast.success('Despesa marcada como paga!');
      loadData();
    } catch (error) {
      console.error('Error updating expense:', error);
      toast.error('Erro ao atualizar despesa');
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
      paymentMethod: ''
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Despesas Operacionais
            </h2>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagas</SelectItem>
                <SelectItem value="overdue">Atrasadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Despesa
          </Button>
        </div>

        {expenses.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              Nenhuma despesa registrada
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
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Valor</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Vencimento</th>
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
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-semibold">{formatCurrency(parseFloat(expense.amount))}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm">{new Date(expense.due_date).toLocaleDateString('pt-BR')}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {expense.payment_status === 'pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markAsPaid(expense.id)}
                        >
                          Marcar como Pago
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Dialog Form */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Despesa Operacional</DialogTitle>
            <DialogDescription>
              Registre uma nova despesa operacional para o controle de custos.
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

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">
                Criar Despesa
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}