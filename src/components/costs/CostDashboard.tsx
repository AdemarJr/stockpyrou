import { useState, useEffect } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle,
  PieChart,
  BarChart3,
  FileText,
  Target,
  Settings,
  BadgePercent,
  Package,
  Warehouse
} from 'lucide-react';
import { formatCurrency } from '../../utils/calculations';
import { remainingFromExpenseRow } from '../../utils/expensePaidAmount';
import { CostRepository } from '../../repositories/CostRepository';
import { CostCenterManagement } from './CostCenterManagement';
import { ExpenseManagement } from './ExpenseManagement';
import { BudgetManagement } from './BudgetManagement';
import { CostAnalytics } from './CostAnalytics';
import { CostTargets } from './CostTargets';
import { CommissionCalculator } from './CommissionCalculator';
import { toast } from 'sonner@2.0.3';

interface DashboardMetrics {
  /** Receita do mês (PDV) */
  monthlyRevenue: number;
  /** Custo das vendas do mês (COGS, via stock_movements type=venda) */
  monthlyCogs: number;
  /** Lucro estimado do mês = receita - COGS - despesas do mês (por vencimento) */
  monthlyProfit: number;
  /** Despesas com vencimento no mês */
  monthlyExpensesDue: number;
  /** A pagar (em aberto) com vencimento no mês */
  monthlyToPay: number;
  /** Devedor (atrasado) com vencimento no mês */
  monthlyOverdue: number;
  budgetUtilization: number;
  activeBudgets: number;
  /** Estoque atual × custo médio (estimativa) */
  inventoryValue: number;
  /** Soma das entradas de estoque no mês */
  purchasesMonthTotal: number;
}

export function CostDashboard() {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [referenceMonth, setReferenceMonth] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    monthlyRevenue: 0,
    monthlyCogs: 0,
    monthlyProfit: 0,
    monthlyExpensesDue: 0,
    monthlyToPay: 0,
    monthlyOverdue: 0,
    budgetUtilization: 0,
    activeBudgets: 0,
    inventoryValue: 0,
    purchasesMonthTotal: 0
  });
  const [activeTab, setActiveTab] = useState('overview');

  const forcedPeriod = (() => {
    const m = referenceMonth.trim();
    const start = `${m}-01`;
    const startDt = new Date(`${start}T00:00:00.000Z`);
    const endDt = new Date(Date.UTC(startDt.getUTCFullYear(), startDt.getUTCMonth() + 1, 0));
    const pad = (n: number) => String(n).padStart(2, '0');
    const end = `${endDt.getUTCFullYear()}-${pad(endDt.getUTCMonth() + 1)}-${pad(endDt.getUTCDate())}`;
    return { from: start, to: end };
  })();

  useEffect(() => {
    if (currentCompany?.id) {
      loadDashboardData();
    }
  }, [currentCompany?.id, referenceMonth]);

  const loadDashboardData = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const [expenses, budgetsList, stockMetrics, fin] = await Promise.all([
        CostRepository.findAllExpenses(currentCompany.id),
        CostRepository.findAllBudgets(currentCompany.id),
        CostRepository.getStockCostMetrics(currentCompany.id, referenceMonth).catch((err) => {
          console.warn('Stock cost metrics:', err);
          return { inventoryValue: 0, purchasesMonthTotal: 0 };
        }),
        CostRepository.getMonthlyFinancialSnapshot(currentCompany.id, referenceMonth).catch((err) => {
          console.warn('Monthly financial snapshot:', err);
          return { month: referenceMonth, revenue: 0, cogs: 0 };
        }),
      ]);

      const budgets = budgetsList as any[];

      // Calculate metrics
      const monthYmdPrefix = `${referenceMonth}-`;
      const todayYmd = new Date().toISOString().split('T')[0];

      const monthExpenses = (expenses as any[]).filter((e: any) => {
        const due = String(e.due_date || '').split('T')[0];
        return due.startsWith(monthYmdPrefix);
      });

      const monthlyExpensesDue = monthExpenses.reduce(
        (sum: number, e: any) => sum + (parseFloat(String(e.amount ?? 0)) || 0),
        0
      );

      const monthlyToPay = monthExpenses
        .filter((e: any) => String(e.payment_status || '') === 'pending')
        .reduce((sum: number, e: any) => sum + remainingFromExpenseRow(e), 0);

      const monthlyOverdue = monthExpenses
        .filter((e: any) => {
          const st = String(e.payment_status || '');
          const due = String(e.due_date || '').split('T')[0];
          return st === 'overdue' || (st === 'pending' && due && due < todayYmd);
        })
        .reduce((sum: number, e: any) => sum + remainingFromExpenseRow(e), 0);

      const activeBudgets = budgets.filter((b: any) => b.status === 'active').length;

      // Budget utilization (simplified - could be more sophisticated)
      const budgetUtilization = activeBudgets > 0 ? 
        (monthlyExpensesDue / (budgets.reduce((sum: number, b: any) => sum + parseFloat(b.total_budget), 0) / activeBudgets)) * 100 : 0;

      const monthlyRevenue = fin.revenue || 0;
      const monthlyCogs = fin.cogs || 0;
      const monthlyProfit = monthlyRevenue - monthlyCogs - monthlyExpensesDue;

      setMetrics({
        monthlyRevenue,
        monthlyCogs,
        monthlyProfit,
        monthlyExpensesDue,
        monthlyToPay,
        monthlyOverdue,
        budgetUtilization: Math.min(budgetUtilization, 100),
        activeBudgets,
        inventoryValue: stockMetrics.inventoryValue,
        purchasesMonthTotal: stockMetrics.purchasesMonthTotal
      });

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const initializeCostCenters = async () => {
    if (!currentCompany?.id) return;

    try {
      const { created } = await CostRepository.seedDefaultCostCentersIfEmpty(currentCompany.id);
      if (created === 0) {
        toast.info('Já existem centros de custo cadastrados.');
        return;
      }

      toast.success('Centros de custo padrão criados no banco de dados.');
      loadDashboardData();
    } catch (error) {
      console.error('Error initializing cost centers:', error);
      toast.error(`Erro ao inicializar centros de custo: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  if (!currentCompany) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">Selecione uma empresa para visualizar o controle de custos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Controle de Custos
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Despesas e orçamentos integrados ao estoque: vincule compras às entradas e acompanhe valor em
            inventário.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Mês</span>
            <input
              type="month"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
              className="bg-transparent text-sm text-gray-900 dark:text-gray-100 outline-none"
            />
          </div>
          <Button onClick={initializeCostCenters} variant="outline">
            <Settings className="w-4 h-4 mr-2" />
            Inicializar Centros de Custo
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Lucro (mês)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(metrics.monthlyProfit)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Gastos (vencimento no mês)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(metrics.monthlyExpensesDue)}
                </p>
              </div>
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <DollarSign className="w-6 h-6 text-slate-700 dark:text-slate-300" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">A pagar (mês)</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {formatCurrency(metrics.monthlyToPay)}
                </p>
              </div>
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Devedor / Atrasado (mês)</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {formatCurrency(metrics.monthlyOverdue)}
                </p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Receita (mês)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(metrics.monthlyRevenue)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Base: vendas do Caixa/PDV (tabela <code>sales</code>).
                </p>
              </div>
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <TrendingUp className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">COGS (mês)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(metrics.monthlyCogs)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Base: baixas por venda (estoque), quando disponíveis.
                </p>
              </div>
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <TrendingDown className="w-6 h-6 text-slate-700 dark:text-slate-300" />
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Utilização do Orçamento</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {metrics.budgetUtilization.toFixed(1)}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {metrics.activeBudgets} orçamento(s) ativo(s)
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Target className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Valor em estoque (estimado)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(metrics.inventoryValue)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Soma de quantidade × custo médio dos produtos (mesma base do módulo Estoque).
                </p>
              </div>
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <Warehouse className="w-6 h-6 text-slate-600 dark:text-slate-300" />
              </div>
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Compras no mês (entradas)</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(metrics.purchasesMonthTotal)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Total das entradas de estoque registradas desde o dia 1 do mês.
                </p>
              </div>
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <Package className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1 h-auto">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <PieChart className="w-4 h-4" />
            <span className="hidden md:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="expenses" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span className="hidden md:inline">Despesas</span>
          </TabsTrigger>
          <TabsTrigger value="budgets" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden md:inline">Orçamentos</span>
          </TabsTrigger>
          <TabsTrigger value="commissions" className="flex items-center gap-2">
            <BadgePercent className="w-4 h-4" />
            <span className="hidden md:inline">Comissões</span>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden md:inline">Análises</span>
          </TabsTrigger>
          <TabsTrigger value="targets" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            <span className="hidden md:inline">Metas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <CostCenterManagement />
        </TabsContent>

        <TabsContent value="expenses">
          <ExpenseManagement forcedPeriod={forcedPeriod} />
        </TabsContent>

        <TabsContent value="budgets">
          <BudgetManagement />
        </TabsContent>

        <TabsContent value="commissions">
          <CommissionCalculator forcedMonth={referenceMonth} />
        </TabsContent>

        <TabsContent value="analytics">
          <CostAnalytics />
        </TabsContent>

        <TabsContent value="targets">
          <CostTargets />
        </TabsContent>
      </Tabs>
    </div>
  );
}