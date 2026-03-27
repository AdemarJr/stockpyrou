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
  BadgePercent
} from 'lucide-react';
import { formatCurrency } from '../../utils/calculations';
import { CostRepository } from '../../repositories/CostRepository';
import { CostCenterManagement } from './CostCenterManagement';
import { ExpenseManagement } from './ExpenseManagement';
import { BudgetManagement } from './BudgetManagement';
import { CostAnalytics } from './CostAnalytics';
import { CostTargets } from './CostTargets';
import { CommissionCalculator } from './CommissionCalculator';
import { toast } from 'sonner@2.0.3';

interface DashboardMetrics {
  totalExpenses: number;
  monthlyExpenses: number;
  pendingPayments: number;
  overduePayments: number;
  budgetUtilization: number;
  activeBudgets: number;
}

export function CostDashboard() {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalExpenses: 0,
    monthlyExpenses: 0,
    pendingPayments: 0,
    overduePayments: 0,
    budgetUtilization: 0,
    activeBudgets: 0
  });
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (currentCompany?.id) {
      loadDashboardData();
    }
  }, [currentCompany?.id]);

  const loadDashboardData = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const [expenses, budgetsList] = await Promise.all([
        CostRepository.findAllExpenses(currentCompany.id),
        CostRepository.findAllBudgets(currentCompany.id)
      ]);

      const budgets = budgetsList as any[];

      // Calculate metrics
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyExpenses = expenses
        .filter((e: any) => new Date(e.due_date) >= firstDayOfMonth)
        .reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);

      const pendingPayments = expenses
        .filter((e: any) => e.payment_status === 'pending')
        .reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);

      const overduePayments = expenses
        .filter((e: any) => e.payment_status === 'overdue')
        .reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);

      const totalExpenses = expenses.reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0);

      const activeBudgets = budgets.filter((b: any) => b.status === 'active').length;

      // Budget utilization (simplified - could be more sophisticated)
      const budgetUtilization = activeBudgets > 0 ? 
        (monthlyExpenses / (budgets.reduce((sum: number, b: any) => sum + parseFloat(b.total_budget), 0) / activeBudgets)) * 100 : 0;

      setMetrics({
        totalExpenses,
        monthlyExpenses,
        pendingPayments,
        overduePayments,
        budgetUtilization: Math.min(budgetUtilization, 100),
        activeBudgets
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
            Gerencie despesas, orçamentos e análises financeiras
          </p>
        </div>
        <Button onClick={initializeCostCenters} variant="outline">
          <Settings className="w-4 h-4 mr-2" />
          Inicializar Centros de Custo
        </Button>
      </div>

      {/* Metrics Cards */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Despesas do Mês</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(metrics.monthlyExpenses)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Pagamentos Pendentes</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                  {formatCurrency(metrics.pendingPayments)}
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
                <p className="text-sm text-gray-500 dark:text-gray-400">Pagamentos Atrasados</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {formatCurrency(metrics.overduePayments)}
                </p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
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
          <ExpenseManagement />
        </TabsContent>

        <TabsContent value="budgets">
          <BudgetManagement />
        </TabsContent>

        <TabsContent value="commissions">
          <CommissionCalculator />
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