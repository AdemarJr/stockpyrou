import { useState, useEffect } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { Card } from '../ui/card';
import { Target, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '../../utils/calculations';
import { toast } from 'sonner@2.0.3';
import { CostRepository } from '../../repositories/CostRepository';
import { Progress } from '../ui/progress';

export function CostTargets() {
  const { currentCompany } = useCompany();
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentCompany?.id) {
      loadTargets();
    }
  }, [currentCompany?.id]);

  const loadTargets = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const rows = await CostRepository.findAllCostTargets(currentCompany.id, true);
      setTargets(rows as any[]);
    } catch (error) {
      console.error('Error loading targets:', error);
      toast.error('Erro ao carregar metas');
    } finally {
      setLoading(false);
    }
  };

  const getTargetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      waste_reduction: 'Redução de Desperdício',
      cost_per_product: 'Custo por Produto',
      operational_limit: 'Limite Operacional',
      profit_margin: 'Margem de Lucro'
    };
    return labels[type] || type;
  };

  const calculateProgress = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
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
          Metas de Custo
        </h2>

        {targets.length === 0 ? (
          <div className="text-center py-8">
            <Target className="w-12 h-12 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-500 dark:text-gray-400">
              Nenhuma meta configurada
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
              Funcionalidade em desenvolvimento
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {targets.map((target: any) => {
              const progress = calculateProgress(
                parseFloat(target.current_value || 0),
                parseFloat(target.target_value || 0)
              );
              const isOnTarget = progress >= 80;

              return (
                <Card key={target.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isOnTarget ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'
                      }`}>
                        {isOnTarget ? (
                          <TrendingUp className={`w-5 h-5 ${isOnTarget ? 'text-green-600' : 'text-orange-600'}`} />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-orange-600" />
                        )}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">
                          {getTargetTypeLabel(target.target_type)}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {target.cost_centers?.name ||
                            target.products?.name ||
                            (target.product_id ? 'Por produto' : 'Geral')}
                        </p>
                      </div>
                    </div>
                    <span className={`text-sm font-semibold ${
                      isOnTarget ? 'text-green-600' : 'text-orange-600'
                    }`}>
                      {progress.toFixed(0)}%
                    </span>
                  </div>

                  <Progress value={progress} className="mb-2" />

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      Atual: {formatCurrency(parseFloat(target.current_value || 0))}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      Meta: {formatCurrency(parseFloat(target.target_value || 0))}
                    </span>
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