import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Database, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { projectId, publicAnonKey } from '../../utils/supabase/env';
import { formatCurrency } from '../../utils/calculations';

type ZigDayRow = { lines: number; qty: number; value: number };
type LocalDayRow = { movements: number; qty: number; cost: number };

type ZigSaidaComparisonPayload = {
  dateRange: { start: string; end: string };
  zig: {
    lineCount: number;
    totalQty: number;
    totalValue: number;
    byDay: Record<string, ZigDayRow>;
  };
  local: {
    movementCount: number;
    totalQty: number;
    totalCost: number;
    byDay: Record<string, LocalDayRow>;
  };
  note: string;
};

interface ZigSaidaComparisonCardProps {
  startDate: string;
  endDate: string;
}

const ZIG_CONFIG_HEADERS: Record<string, string> = {
  Authorization: `Bearer ${publicAnonKey}`,
  apikey: publicAnonKey,
};

export function ZigSaidaComparisonCard({ startDate, endDate }: ZigSaidaComparisonCardProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [zigIntegrationReady, setZigIntegrationReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ZigSaidaComparisonPayload | null>(null);

  useEffect(() => {
    if (!currentCompany?.id) {
      setZigIntegrationReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/zig/config/${currentCompany.id}`,
          { headers: ZIG_CONFIG_HEADERS },
        );
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        const c = body?.config;
        setZigIntegrationReady(!!(c?.storeId && c?.hasZigToken));
      } catch {
        if (!cancelled) setZigIntegrationReady(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentCompany?.id]);

  const load = useCallback(async () => {
    if (!user?.accessToken || !currentCompany?.id) {
      toast.error('Faça login e selecione uma empresa.');
      return;
    }
    if (startDate && endDate && startDate > endDate) {
      toast.error('A data inicial deve ser anterior ou igual à final.');
      return;
    }

    setLoading(true);
    setData(null);
    try {
      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/reports/zig-saida-comparison?${params}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
            apikey: publicAnonKey,
            'X-Custom-Token': user.accessToken,
            'X-Company-Id': currentCompany.id,
          },
        },
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Falha ao carregar comparativo ZIG');
      }
      setData(json as ZigSaidaComparisonPayload);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar comparativo ZIG');
    } finally {
      setLoading(false);
    }
  }, [user?.accessToken, currentCompany?.id, startDate, endDate]);

  const dayRows = useMemo(() => {
    if (!data) return [];
    const keys = new Set([
      ...Object.keys(data.zig.byDay),
      ...Object.keys(data.local.byDay),
    ]);
    return Array.from(keys)
      .sort()
      .map((ymd) => {
        const z = data.zig.byDay[ymd];
        const l = data.local.byDay[ymd];
        return {
          ymd,
          zigLines: z?.lines ?? 0,
          zigQty: z?.qty ?? 0,
          zigValue: z?.value ?? 0,
          localMov: l?.movements ?? 0,
          localQty: l?.qty ?? 0,
          localCost: l?.cost ?? 0,
        };
      });
  }, [data]);

  if (zigIntegrationReady !== true) {
    return null;
  }

  return (
    <div className="rounded-xl border border-indigo-200/90 dark:border-indigo-800/80 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="flex gap-3">
          <Database className="w-5 h-5 text-indigo-700 dark:text-indigo-300 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-indigo-950 dark:text-indigo-100">
              Comparativo ZIG × saídas (integração)
            </p>
            <p className="text-sm text-indigo-950/85 dark:text-indigo-100/85 mt-1 max-w-3xl">
              Consulta direta à API ZIG (<code className="text-xs bg-white/60 dark:bg-gray-900/50 px-1 rounded">saida-produtos</code>) no período do filtro acima, e cruza com as movimentações locais geradas pela integração ZIG (notas com «Integração automática ZIG»).
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={load}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 shrink-0"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {loading ? 'Consultando ZIG…' : 'Gerar comparativo'}
        </button>
      </div>

      {data && (
        <>
          <p className="text-xs text-gray-600 dark:text-gray-400 bg-white/70 dark:bg-gray-900/40 rounded-lg p-3 border border-indigo-100 dark:border-indigo-900/60">
            {data.note}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3">
              <p className="text-xs font-medium text-gray-500 uppercase">ZIG — linhas</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.zig.lineCount.toLocaleString('pt-BR')}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3">
              <p className="text-xs font-medium text-gray-500 uppercase">ZIG — qtd (itens)</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.zig.totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3">
              <p className="text-xs font-medium text-gray-500 uppercase">ZIG — valor venda (R$)</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {formatCurrency(data.zig.totalValue)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50 p-3">
              <p className="text-xs font-medium text-gray-500 uppercase">Local — movimentos ZIG</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                {data.local.movementCount.toLocaleString('pt-BR')}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Qtd {data.local.totalQty.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} · Custo{' '}
                {formatCurrency(data.local.totalCost)}
              </p>
            </div>
          </div>

          {dayRows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/80 text-left text-xs uppercase text-gray-500">
                    <th className="px-3 py-2 font-semibold">Dia</th>
                    <th className="px-3 py-2 font-semibold text-right">ZIG linhas</th>
                    <th className="px-3 py-2 font-semibold text-right">ZIG qtd</th>
                    <th className="px-3 py-2 font-semibold text-right">ZIG R$</th>
                    <th className="px-3 py-2 font-semibold text-right">Local mov.</th>
                    <th className="px-3 py-2 font-semibold text-right">Local qtd</th>
                    <th className="px-3 py-2 font-semibold text-right">Local custo</th>
                  </tr>
                </thead>
                <tbody>
                  {dayRows.map((row) => (
                    <tr
                      key={row.ymd}
                      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{row.ymd}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.zigLines}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.zigQty.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.zigValue)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.localMov}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.localQty.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.localCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
