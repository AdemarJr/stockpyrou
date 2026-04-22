import { useEffect, useMemo, useState } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { Card } from '../ui/card';
import { formatCurrency } from '../../utils/calculations';
import { CostRepository } from '../../repositories/CostRepository';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { toast } from 'sonner@2.0.3';

type ProjectionRow = Awaited<ReturnType<typeof CostRepository.getCashFlowProjection>>[number];

export function FinancialDashboard() {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ProjectionRow[]>([]);

  const defaultRange = useMemo(() => {
    const start = new Date();
    const end = new Date(start.getTime() + 30 * 86400000);
    const ymd = (d: Date) => d.toISOString().slice(0, 10);
    return { start: ymd(start), end: ymd(end) };
  }, []);

  const [startYmd, setStartYmd] = useState(defaultRange.start);
  const [endYmd, setEndYmd] = useState(defaultRange.end);

  useEffect(() => {
    if (!currentCompany?.id) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompany?.id]);

  const load = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const data = await CostRepository.getCashFlowProjection(
        currentCompany.id,
        startYmd,
        endYmd
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('FinancialDashboard load:', e);
      toast.error(e?.message || 'Erro ao carregar financeiro');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const today = rows[0];
  const end = rows.length ? rows[rows.length - 1] : undefined;

  const next7Out = rows.slice(0, 7).reduce((s, r) => s + (r.outExpected || 0), 0);
  const next7In = rows.slice(0, 7).reduce((s, r) => s + (r.inRealized || 0), 0);
  const totalOut30 = rows.reduce((s, r) => s + (r.outExpected || 0) + (r.outRealized || 0), 0);

  const chartData = rows.map((r) => ({
    date: r.date.slice(5),
    projectedBalance: r.projectedBalance,
  }));

  if (!currentCompany) return null;

  return (
    <div className="space-y-4">
      {loading ? (
        <Card className="p-6">
          <p className="text-center text-gray-500">Carregando financeiro…</p>
        </Card>
      ) : (
        <>
          <Card className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex gap-3">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Início</p>
                  <input
                    type="date"
                    value={startYmd}
                    onChange={(e) => setStartYmd(e.target.value)}
                    className="rounded-md border border-gray-200 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Fim</p>
                  <input
                    type="date"
                    value={endYmd}
                    onChange={(e) => setEndYmd(e.target.value)}
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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-6">
              <p className="text-sm text-gray-500">Saldo projetado (D+30)</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(end?.projectedBalance ?? 0)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Base: entradas realizadas (cash_date) − saídas realizadas (cash_date) − contas a pagar previstas (due_date).
              </p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-gray-500">Contas a pagar (próx. 7 dias)</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">
                {formatCurrency(next7Out)}
              </p>
              <p className="text-xs text-gray-500 mt-2">Somente lançamentos com status “previsto”.</p>
            </Card>
            <Card className="p-6">
              <p className="text-sm text-gray-500">Entradas realizadas (7 dias)</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">
                {formatCurrency(next7In)}
              </p>
              <p className="text-xs text-gray-500 mt-2">Somente lançamentos com status “realizado”.</p>
            </Card>
          </div>

          <Card className="p-6">
            <p className="text-sm text-gray-500">Total de despesas (D+30)</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {formatCurrency(totalOut30)}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Soma de saídas previstas + realizadas no período.
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-baseline justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Saldo projetado</h3>
                <p className="text-xs text-gray-500">
                  De {startYmd} até {endYmd}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">Saldo inicial (D0)</p>
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(today?.projectedBalance ?? 0)}
                </p>
              </div>
            </div>
            {rows.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} />
                  <Line type="monotone" dataKey="projectedBalance" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-500 py-10">
                Sem dados. Confirme se o script `scripts/finance_ledger.sql` já foi executado no Supabase.
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

