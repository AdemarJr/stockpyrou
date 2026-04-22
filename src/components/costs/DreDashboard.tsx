import { useEffect, useMemo, useState } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { Card } from '../ui/card';
import { formatCurrency } from '../../utils/calculations';
import { CostRepository } from '../../repositories/CostRepository';
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner@2.0.3';

export function DreDashboard() {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);

  const monthNow = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const [fromMonth, setFromMonth] = useState(() => '2026-01');
  const [toMonth, setToMonth] = useState(() => monthNow);
  const [rows, setRows] = useState<Array<any>>([]);

  useEffect(() => {
    if (!currentCompany?.id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id]);

  const load = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const data = await CostRepository.getDreByMonth(currentCompany.id, fromMonth, toMonth);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('DreDashboard load:', e);
      toast.error(e?.message || 'Erro ao carregar DRE');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const revenue = rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
    const cogs = rows.reduce((s, r) => s + (Number(r.cogs) || 0), 0);
    const expenses = rows.reduce((s, r) => s + (Number(r.expenses) || 0), 0);
    const gross = rows.reduce((s, r) => s + (Number(r.grossProfit) || 0), 0);
    const net = rows.reduce((s, r) => s + (Number(r.net) || 0), 0);
    return { revenue, cogs, expenses, gross, net };
  }, [rows]);

  const chartData = rows.map((r) => ({
    month: String(r.month).slice(2),
    net: Number(r.net) || 0,
    gross: Number(r.grossProfit) || 0,
  }));

  if (!currentCompany) return null;

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex gap-3">
            <div>
              <p className="text-xs text-gray-500 mb-1">De</p>
              <input
                type="month"
                value={fromMonth}
                onChange={(e) => setFromMonth(e.target.value)}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Até</p>
              <input
                type="month"
                value={toMonth}
                onChange={(e) => setToMonth(e.target.value)}
                className="rounded-md border border-gray-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Atualizar
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="p-6">
          <p className="text-sm text-gray-500">Receita</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totals.revenue)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500">CMV</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totals.cogs)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500">Lucro bruto</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totals.gross)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500">Despesas</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totals.expenses)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-gray-500">Resultado</p>
          <p className="text-xl font-bold mt-1">{formatCurrency(totals.net)}</p>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Resultado por mês</h3>
        {loading ? (
          <p className="text-center text-gray-500 py-8">Carregando…</p>
        ) : rows.length === 0 ? (
          <p className="text-center text-gray-500 py-8">Sem dados.</p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="gross" name="Lucro bruto" fill="#60a5fa" />
              <Bar dataKey="net" name="Resultado" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Card className="p-6 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="py-2 pr-4">Mês</th>
              <th className="py-2 pr-4">Receita</th>
              <th className="py-2 pr-4">CMV</th>
              <th className="py-2 pr-4">Lucro bruto</th>
              <th className="py-2 pr-4">Despesas</th>
              <th className="py-2 pr-4">Resultado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => (
              <tr key={r.month} className="border-b last:border-0">
                <td className="py-2 pr-4 font-semibold">{r.month}</td>
                <td className="py-2 pr-4 tabular-nums">{formatCurrency(Number(r.revenue) || 0)}</td>
                <td className="py-2 pr-4 tabular-nums">{formatCurrency(Number(r.cogs) || 0)}</td>
                <td className="py-2 pr-4 tabular-nums">{formatCurrency(Number(r.grossProfit) || 0)}</td>
                <td className="py-2 pr-4 tabular-nums">{formatCurrency(Number(r.expenses) || 0)}</td>
                <td className="py-2 pr-4 tabular-nums font-semibold">{formatCurrency(Number(r.net) || 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

