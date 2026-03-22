import { useState, useEffect } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { PieChart, TrendingUp, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../utils/calculations';
import { toast } from 'sonner@2.0.3';
import { CostRepository } from '../../repositories/CostRepository';

export function BudgetManagement() {
  const { currentCompany } = useCompany();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id) {
      loadBudgets();
    }
  }, [currentCompany?.id]);

  const loadBudgets = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const budgetsList = await CostRepository.findAllBudgets(currentCompany.id);
      setBudgets(budgetsList as any[]);

      try {
        const analysisRows = await CostRepository.getBudgetAnalysis(currentCompany.id);
        setAnalysis(Array.isArray(analysisRows) ? analysisRows : []);
      } catch {
        setAnalysis([]);
      }
    } catch (error) {
      console.error('Error loading budgets:', error);
      toast.error('Erro ao carregar orçamentos');
    } finally {
      setLoading(false);
    }
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
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Orçamentos
        </h2>

        {analysis.length === 0 && budgets.length === 0 ? (
          <div className="text-center py-8">
            <PieChart className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              Nenhum orçamento cadastrado
            </p>
          </div>
        ) : analysis.length === 0 && budgets.length > 0 ? (
          <div className="space-y-3">
            {budgets.map((b: any) => (
              <Card key={b.id} className="p-4">
                <h3 className="font-semibold text-gray-900 dark:text-white">{b.name}</h3>
                <p className="text-sm text-gray-500">
                  {new Date(b.start_date).toLocaleDateString('pt-BR')} —{' '}
                  {new Date(b.end_date).toLocaleDateString('pt-BR')}
                </p>
                <p className="text-sm mt-2">
                  Valor total: <span className="font-semibold">{formatCurrency(parseFloat(b.total_budget ?? 0))}</span>
                  {' · '}
                  Status: {b.status}
                </p>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {analysis.map((budget: any) => {
              const utilizationPercent = parseFloat(budget.utilization_percentage || 0);
              const isOverBudget = utilizationPercent > 100;
              const isNearLimit = utilizationPercent > 80 && utilizationPercent <= 100;

              return (
                <Card key={budget.budget_id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {budget.budget_name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {new Date(budget.start_date).toLocaleDateString('pt-BR')} até{' '}
                        {new Date(budget.end_date).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOverBudget && (
                        <AlertCircle className="w-5 h-5 text-red-600" />
                      )}
                      {isNearLimit && (
                        <TrendingUp className="w-5 h-5 text-yellow-600" />
                      )}
                      <span className={`text-sm font-semibold ${
                        isOverBudget ? 'text-red-600' : isNearLimit ? 'text-yellow-600' : 'text-green-600'
                      }`}>
                        {utilizationPercent.toFixed(1)}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Progress 
                      value={Math.min(utilizationPercent, 100)} 
                      className={isOverBudget ? 'bg-red-200' : isNearLimit ? 'bg-yellow-200' : ''}
                    />
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Realizado: {formatCurrency(parseFloat(budget.total_spent || 0))}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400">
                        Total: {formatCurrency(parseFloat(budget.total_budget || 0))}
                      </span>
                    </div>

                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Disponível: <span className="font-semibold">
                        {formatCurrency(parseFloat(budget.remaining_budget || 0))}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}