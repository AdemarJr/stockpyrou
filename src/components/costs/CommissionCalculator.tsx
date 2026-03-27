import { useEffect, useMemo, useState, useCallback } from 'react';
import { useCompany } from '../../contexts/CompanyContext';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../ui/table';
import {
  BadgePercent,
  Download,
  Save,
  Trash2,
  Users,
  ConciergeBell,
  UtensilsCrossed,
  History,
  Info
} from 'lucide-react';
import { formatCurrency } from '../../utils/calculations';
import { toast } from 'sonner@2.0.3';
import type { CommissionGroupConfig, CommissionRoleKey } from '../../types/commission';
import {
  CommissionSnapshotService,
  computeGroups,
  loadGroupLabels,
  persistGroupLabels,
  DEFAULT_GROUP_LABELS
} from '../../services/CommissionSnapshotService';
import type { CommissionSnapshot } from '../../types/commission';
import { cn } from '../ui/utils';

const ROLE_META: Record<
  CommissionRoleKey,
  { label: string; description: string; Icon: typeof Users }
> = {
  vendedores: {
    label: 'Vendedores',
    description: 'Equipe de vendas / atendimento ao cliente',
    Icon: Users
  },
  garcons: {
    label: 'Garçons',
    description: 'Salão / serviço de mesa',
    Icon: ConciergeBell
  },
  cozinha: {
    label: 'Cozinha',
    description: 'Produção e apoio',
    Icon: UtensilsCrossed
  }
};

function monthNow(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function CommissionCalculator() {
  const { currentCompany } = useCompany();
  const [referenceMonth, setReferenceMonth] = useState(monthNow);
  const [totalSales, setTotalSales] = useState<string>('');
  const [percents, setPercents] = useState<Record<CommissionRoleKey, string>>({
    vendedores: '',
    garcons: '',
    cozinha: ''
  });
  const [people, setPeople] = useState<Record<CommissionRoleKey, string>>({
    vendedores: '',
    garcons: '',
    cozinha: ''
  });
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState<CommissionSnapshot[]>([]);
  const [groupLabels, setGroupLabels] = useState<Record<CommissionRoleKey, string>>(() => ({
    ...DEFAULT_GROUP_LABELS
  }));

  const salesNum = useMemo(() => {
    const n = parseFloat(String(totalSales).replace(',', '.'));
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }, [totalSales]);

  const groupsConfig: CommissionGroupConfig[] = useMemo(() => {
    return (Object.keys(ROLE_META) as CommissionRoleKey[]).map((key) => {
      const custom = (groupLabels[key] ?? '').trim();
      return {
        key,
        label: custom || ROLE_META[key].label,
        percent: Math.max(0, parseFloat(String(percents[key]).replace(',', '.')) || 0),
        peopleCount: Math.max(0, Math.floor(parseFloat(String(people[key]).replace(',', '.')) || 0))
      };
    });
  }, [percents, people, groupLabels]);

  const results = useMemo(() => computeGroups(salesNum, groupsConfig), [salesNum, groupsConfig]);

  const sumPercent = useMemo(
    () => results.reduce((s, g) => s + g.percent, 0),
    [results]
  );

  const loadHistory = useCallback(() => {
    if (!currentCompany?.id) return;
    setHistory(CommissionSnapshotService.list(currentCompany.id));
  }, [currentCompany?.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!currentCompany?.id) return;
    setGroupLabels(loadGroupLabels(currentCompany.id));
  }, [currentCompany?.id]);

  const setLabelForKey = (key: CommissionRoleKey, value: string) => {
    setGroupLabels((prev) => {
      const next = { ...prev, [key]: value };
      if (currentCompany?.id) {
        persistGroupLabels(currentCompany.id, next);
      }
      return next;
    });
  };

  const resetLabelsToDefaults = () => {
    setGroupLabels({ ...DEFAULT_GROUP_LABELS });
    if (currentCompany?.id) {
      persistGroupLabels(currentCompany.id, { ...DEFAULT_GROUP_LABELS });
    }
    toast.success('Nomes restaurados para o padrão.');
  };

  const handleSave = () => {
    if (!currentCompany?.id) {
      toast.error('Selecione uma empresa.');
      return;
    }
    if (salesNum <= 0) {
      toast.error('Informe o total de vendas do mês.');
      return;
    }
    const invalidPeople = results.some((g) => g.percent > 0 && g.peopleCount <= 0);
    if (invalidPeople) {
      toast.error('Para cada grupo com percentual maior que zero, informe a quantidade de pessoas.');
      return;
    }

    CommissionSnapshotService.save(currentCompany.id, {
      companyId: currentCompany.id,
      referenceMonth,
      totalSales: salesNum,
      groups: results,
      notes: notes.trim() || undefined
    });
    loadHistory();
    toast.success('Simulação salva neste navegador.');
  };

  const handleDelete = (id: string) => {
    if (!currentCompany?.id) return;
    if (!confirm('Remover este registro do histórico?')) return;
    CommissionSnapshotService.delete(currentCompany.id, id);
    loadHistory();
    toast.success('Registro removido.');
  };

  const handleExportCsv = (snap: CommissionSnapshot) => {
    const csv = CommissionSnapshotService.toCsv(snap);
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comissoes_${snap.referenceMonth}_${snap.id.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Arquivo CSV gerado.');
  };

  if (!currentCompany) {
    return (
      <Card className="p-6">
        <p className="text-muted-foreground">Selecione uma empresa para usar a calculadora de comissões.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BadgePercent className="w-6 h-6 text-primary" />
            Comissões sobre vendas
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Informe o faturamento do mês e, para cada equipe, o percentual sobre as vendas e quantas pessoas
            dividem a fatia. O sistema calcula o total da comissão do grupo e o valor por pessoa.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 flex gap-3 text-sm text-amber-900 dark:text-amber-200">
        <Info className="w-5 h-5 shrink-0 mt-0.5" />
        <p>
          Os registros e os <strong>nomes das equipes</strong> ficam guardados neste navegador (por empresa).
          Use exportar CSV para backup ou planilha. A soma dos percentuais pode ser livre (ex.: 3% + 2% + 1,5%).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-6 lg:col-span-1 space-y-4">
          <div>
            <Label htmlFor="refMonth">Mês de referência</Label>
            <Input
              id="refMonth"
              type="month"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="totalSales">Total de vendas do mês (R$)</Label>
            <Input
              id="totalSales"
              inputMode="decimal"
              value={totalSales}
              onChange={(e) => setTotalSales(e.target.value)}
              placeholder="0,00"
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: fechamento parcial, promoções…"
              rows={3}
              className="mt-2"
            />
          </div>
        </Card>

        <Card className="p-6 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <p className="text-sm font-medium">Nomes das equipes, percentual e pessoas</p>
            <Button type="button" variant="ghost" size="sm" className="text-xs h-8" onClick={resetLabelsToDefaults}>
              Restaurar nomes padrão
            </Button>
          </div>
          <div className="space-y-6">
            {(Object.keys(ROLE_META) as CommissionRoleKey[]).map((key) => {
              const { description, Icon } = ROLE_META[key];
              const row = results.find((r) => r.key === key)!;
              const warn = row.percent > 0 && row.peopleCount <= 0;
              return (
                <div
                  key={key}
                  className={cn(
                    'rounded-xl border p-4 grid grid-cols-1 sm:grid-cols-2 gap-4',
                    warn && 'border-destructive/60 bg-destructive/5'
                  )}
                >
                  <div className="flex gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-muted h-fit shrink-0">
                      <Icon className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <Label htmlFor={`label-${key}`} className="text-xs text-muted-foreground">
                          Nome da equipe
                        </Label>
                        <Input
                          id={`label-${key}`}
                          value={groupLabels[key] ?? ''}
                          onChange={(e) => setLabelForKey(key, e.target.value)}
                          placeholder={ROLE_META[key].label}
                          className="mt-1 font-medium"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Percentual (%)</Label>
                      <Input
                        inputMode="decimal"
                        value={percents[key]}
                        onChange={(e) =>
                          setPercents((p) => ({ ...p, [key]: e.target.value }))
                        }
                        placeholder="0"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Pessoas</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={people[key]}
                        onChange={(e) =>
                          setPeople((p) => ({ ...p, [key]: e.target.value }))
                        }
                        placeholder="0"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            Soma dos percentuais: <strong>{sumPercent.toFixed(2)}%</strong>
          </p>
        </Card>
      </div>

      <Card className="p-6 overflow-x-auto">
        <h3 className="font-medium mb-4">Resultado</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipe</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Pessoas</TableHead>
              <TableHead className="text-right">Total comissão (grupo)</TableHead>
              <TableHead className="text-right">Por pessoa</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((r) => (
              <TableRow key={r.key}>
                <TableCell className="font-medium">{r.label}</TableCell>
                <TableCell className="text-right">{r.percent.toFixed(2)}%</TableCell>
                <TableCell className="text-right">{r.peopleCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(r.poolAmount)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {r.peopleCount > 0 ? formatCurrency(r.perPersonAmount) : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button type="button" onClick={handleSave} className="gap-2">
          <Save className="w-4 h-4" />
          Salvar no histórico
        </Button>
      </div>

      <Card className="p-6">
        <h3 className="font-medium flex items-center gap-2 mb-4">
          <History className="w-5 h-5" />
          Histórico (este navegador)
        </h3>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro salvo ainda.</p>
        ) : (
          <div className="space-y-3">
            {history.map((snap) => (
              <div
                key={snap.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">
                    {snap.referenceMonth} · {formatCurrency(snap.totalSales)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(snap.createdAt).toLocaleString('pt-BR')}
                    {snap.notes ? ` · ${snap.notes}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => handleExportCsv(snap)}>
                    <Download className="w-4 h-4 mr-1" />
                    CSV
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => handleDelete(snap.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
