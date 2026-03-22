import { useState, useEffect } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { Card } from '../ui/card';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, DollarSign, Package, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../../utils/calculations';
import { toast } from 'sonner@2.0.3';
import { CostRepository } from '../../repositories/CostRepository';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function CostAnalytics() {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [centersSummary, setCentersSummary] = useState<any[]>([]);
  const [productCosts, setProductCosts] = useState<any[]>([]);
  const [wasteAnalysis, setWasteAnalysis] = useState<any[]>([]);

  useEffect(() => {
    if (currentCompany?.id) {
      loadAnalytics();
    }
  }, [currentCompany?.id]);

  const loadAnalytics = async () => {
    if (!currentCompany?.id) return;

    setLoading(true);
    try {
      const [centersRows, productRows, wasteRows] = await Promise.all([
        CostRepository.getCostCenterSummary(currentCompany.id).catch(() => []),
        CostRepository.getProductCostAnalysis(currentCompany.id).catch(() => []),
        CostRepository.getWasteAnalysis(currentCompany.id).catch(() => [])
      ]);

      setCentersSummary(Array.isArray(centersRows) ? centersRows : []);
      setProductCosts(Array.isArray(productRows) ? productRows : []);
      setWasteAnalysis(Array.isArray(wasteRows) ? wasteRows : []);
    } catch (error) {
      console.error('Error loading analytics:', error);
      toast.error('Erro ao carregar análises');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <p className="text-center text-gray-500">Carregando análises...</p>
      </Card>
    );
  }

  // Prepare data for charts
  const centersChartData = centersSummary
    .filter(center => center && center.cost_center_code) // Filter out null/undefined
    .map((center, idx) => ({
      name: center.cost_center_code,
      total: parseFloat(center.total_spent || 0),
      paid: parseFloat(center.total_paid || 0),
      pending: parseFloat(center.total_pending || 0),
      id: center.cost_center_id || `center-${idx}-${Date.now()}`
    }));

  const topProductsByCost = productCosts
    .filter(p => p && p.product_name) // Filter out null/undefined
    .sort((a, b) => parseFloat(b.inventory_value || 0) - parseFloat(a.inventory_value || 0))
    .slice(0, 10)
    .map((p, idx) => ({
      name: p.product_name,
      value: parseFloat(p.inventory_value || 0),
      margin: parseFloat(p.profit_margin_percentage || 0),
      id: p.product_id || `product-${idx}-${Date.now()}`
    }));

  const wasteByMonth = wasteAnalysis
    .filter(item => item && item.month) // Filter out null/undefined
    .reduce((acc: any[], item: any) => {
      const month = new Date(item.month).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
      const existing = acc.find(a => a.month === month);
      if (existing) {
        existing.cost += parseFloat(item.total_waste_cost || 0);
      } else {
        acc.push({ 
          month, 
          cost: parseFloat(item.total_waste_cost || 0),
          id: `${item.month}-${acc.length}-${Date.now()}`
        });
      }
      return acc;
    }, []);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Gasto</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(centersSummary.reduce((sum, c) => sum + parseFloat(c.total_spent || 0), 0))}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Package className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Valor em Estoque</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(productCosts.reduce((sum, p) => sum + parseFloat(p.inventory_value || 0), 0))}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Desperdício Total</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatCurrency(wasteAnalysis.reduce((sum, w) => sum + parseFloat(w.total_waste_cost || 0), 0))}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Custos por Centro */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Despesas por Centro de Custo
        </h3>
        {centersChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={centersChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Bar dataKey="paid" name="Pago" fill="#10b981" />
              <Bar dataKey="pending" name="Pendente" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-500 py-8">Sem dados disponíveis</p>
        )}
      </Card>

      {/* Top Produtos */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Top 10 Produtos por Valor em Estoque
        </h3>
        {topProductsByCost.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={topProductsByCost}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => `${entry.name}: ${formatCurrency(entry.value)}`}
              >
                {topProductsByCost.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center text-gray-500 py-8">Sem dados disponíveis</p>
        )}
      </Card>

      {/* Desperdício ao Longo do Tempo */}
      {wasteByMonth.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Evolução do Desperdício
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={wasteByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Legend />
              <Line type="monotone" dataKey="cost" name="Custo de Desperdício" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}