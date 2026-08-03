import { useCallback, useEffect, useState } from 'react';
import {
  CloudDownload,
  Loader2,
  PackagePlus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useCompany } from '../../contexts/CompanyContext';
import {
  InboundNfeApi,
  type InboundNfeNote,
  type InboundPreviewItem,
} from '../../repositories/inboundNfeApi';
import { ApiClientError, apiClient } from '../../lib/apiClient';
import type { Product, StockEntry, Supplier } from '../../types';
import { calculateWeightedAverageCost, formatCurrency } from '../../utils/calculations';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';

interface StockEntrySefazSyncProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  suppliers: Supplier[];
  onEntry: (entry: Omit<StockEntry, 'id' | 'entryDate' | 'userId'>, newAvgCost: number) => void;
  onSupplierCreated?: () => void | Promise<void>;
}

function formatMoney(v: number) {
  return formatCurrency(v);
}

export function StockEntrySefazSync({
  open,
  onOpenChange,
  products,
  suppliers,
  onEntry,
  onSupplierCreated,
}: StockEntrySefazSyncProps) {
  const { currentCompany } = useCompany();
  const [syncing, setSyncing] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [notes, setNotes] = useState<InboundNfeNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<InboundPreviewItem[]>([]);
  const [selectedLines, setSelectedLines] = useState<Record<number, boolean>>({});
  const [supplierId, setSupplierId] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [syncMessages, setSyncMessages] = useState<string[]>([]);
  const [syncEnvironment, setSyncEnvironment] = useState<
    'homologation' | 'production' | null
  >(null);
  const [resettingNsu, setResettingNsu] = useState(false);

  const loadList = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoadingList(true);
    try {
      const data = await InboundNfeApi.list(currentCompany.id);
      setNeedsMigration(!!data.needsMigration);
      setNotes((data.notes || []).filter((n) => n.status !== 'IGNORED'));
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Falha ao listar notas';
      toast.error(msg);
    } finally {
      setLoadingList(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (!open) return;
    void loadList();
    void (async () => {
      try {
        const data = await apiClient.get<{
          config: { ambiente?: string } | null;
        }>('/fiscal/config', currentCompany?.id);
        const amb = data.config?.ambiente;
        setSyncEnvironment(amb === 'production' ? 'production' : 'homologation');
      } catch {
        /* ignore */
      }
    })();
  }, [open, loadList, currentCompany?.id]);

  const handleSync = async () => {
    if (!currentCompany?.id) return;
    setSyncing(true);
    try {
      const res = await InboundNfeApi.sync(currentCompany.id);
      setNotes(res.notes || []);
      setSyncMessages(res.messages || []);
      setSyncEnvironment(res.environment || null);

      const msgs = res.messages || [];
      const envLabel =
        res.environment === 'production' ? 'Produção' : 'Homologação';

      if ((res.newDocuments || 0) === 0 && (res.downloadedFullXml || 0) === 0) {
        toast.message(
          `[${envLabel}] ${
            msgs.find((m) => /^\d{3}/.test(m)) ||
            'SEFAZ não retornou documentos novos neste ambiente (cStat 137 ou fim do NSU).'
          }`,
          { duration: 7000 },
        );
      } else {
        toast.success(
          `[${envLabel}] Sincronizado: ${res.newDocuments} documento(s), ${res.downloadedFullXml} XML completo(s)`,
        );
      }
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erro na sincronização SEFAZ';
      setSyncMessages([msg]);
      toast.error(msg, { duration: 8000 });
    } finally {
      setSyncing(false);
    }
  };

  const handleResetNsu = async () => {
    if (!currentCompany?.id) return;
    if (
      !confirm(
        'Reiniciar o NSU da SEFAZ? Isso reconsulta os DF-e dos últimos ~3 meses. Se acabou de receber “nenhum documento” (137), aguarde 1 hora para evitar bloqueio 656.',
      )
    ) {
      return;
    }
    setResettingNsu(true);
    try {
      await InboundNfeApi.resetNsu(currentCompany.id);
      toast.success('NSU reiniciado. Clique em Sincronizar com SEFAZ.');
      setSyncMessages(['NSU reiniciado para 0 — sincronize novamente.']);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Falha ao reiniciar NSU';
      toast.error(msg);
    } finally {
      setResettingNsu(false);
    }
  };

  const openPreview = async (id: string) => {
    if (!currentCompany?.id) return;
    setSelectedId(id);
    setLoadingPreview(true);
    setPreviewItems([]);
    try {
      const res = await InboundNfeApi.preview(id, currentCompany.id);
      setPreviewItems(res.items || []);
      const sel: Record<number, boolean> = {};
      for (const it of res.items || []) {
        sel[it.line] = !!it.productId;
      }
      setSelectedLines(sel);
      const sug =
        res.suggestedSupplierId ||
        suppliers.find(
          (s) =>
            s.name.toLowerCase() === String(res.suggestedSupplierName || '').toLowerCase(),
        )?.id ||
        '';
      setSupplierId(sug);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Falha ao abrir nota';
      toast.error(msg);
      setSelectedId(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleImport = async () => {
    if (!currentCompany?.id || !selectedId) return;
    const chosen = previewItems.filter((it) => selectedLines[it.line] && it.productId);
    if (chosen.length === 0) {
      toast.error('Selecione itens com produto vinculado no cadastro');
      return;
    }

    setImporting(true);
    try {
      const { supplierId: resolvedSupplier } = await InboundNfeApi.resolveSupplier(
        selectedId,
        supplierId || null,
        currentCompany.id,
      );
      if (onSupplierCreated && !supplierId) {
        await onSupplierCreated();
      }

      const note = notes.find((n) => n.id === selectedId);
      let ok = 0;
      for (const it of chosen) {
        const product = products.find((p) => p.id === it.productId);
        if (!product || !it.productId) continue;
        const quantity = it.qCom;
        const unitPrice = it.vUnCom;
        const totalPrice = quantity * unitPrice;
        const newAvgCost = calculateWeightedAverageCost(
          product.currentStock,
          product.averageCost,
          quantity,
          unitPrice,
        );
        onEntry(
          {
            productId: it.productId,
            supplierId: resolvedSupplier,
            quantity,
            unitPrice,
            totalPrice,
            batchNumber: it.batchNumber || undefined,
            expirationDate: it.expirationDate ? new Date(it.expirationDate) : undefined,
            notes: `NF-e SEFAZ nº ${note?.numero || '?'} — ${it.xProd} (chave ${note?.chaveAcesso || ''})`,
          },
          newAvgCost,
        );
        ok += 1;
      }

      await InboundNfeApi.markImported(selectedId, currentCompany.id);
      toast.success(`${ok} item(ns) lançados no recebimento`);
      setSelectedId(null);
      await loadList();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erro ao dar entrada';
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  const handleIgnore = async () => {
    if (!currentCompany?.id || !selectedId) return;
    try {
      await InboundNfeApi.ignore(selectedId, currentCompany.id);
      toast.message('Nota ignorada');
      setSelectedId(null);
      await loadList();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erro ao ignorar';
      toast.error(msg);
    }
  };

  const pending = notes.filter((n) => n.status === 'PENDING' || n.status === 'READY');
  const imported = notes.filter((n) => n.status === 'IMPORTED');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CloudDownload className="w-5 h-5 text-blue-600" />
            Sincronizar NF-e (SEFAZ)
          </DialogTitle>
          <DialogDescription>
            Busca na SEFAZ as notas fiscais emitidas para o CNPJ desta empresa (DF-e) e permite
            dar entrada no estoque. O recebimento manual e a importação de XML local continuam
            disponíveis.
          </DialogDescription>
        </DialogHeader>

        {needsMigration && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-900 dark:text-amber-100 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Execute no banco:{' '}
              <code className="text-xs">scripts/add_nfe_inbound_dfe.sql</code> e{' '}
              <code className="text-xs">scripts/add_fiscal_dual_environment.sql</code>
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => void handleSync()} disabled={syncing} className="gap-2">
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CloudDownload className="w-4 h-4" />
            )}
            Sincronizar com SEFAZ
          </Button>
          <Button variant="outline" onClick={() => void loadList()} disabled={loadingList} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
            Atualizar lista
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleResetNsu()}
            disabled={resettingNsu || syncing}
            className="gap-2"
          >
            {resettingNsu ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Reiniciar NSU
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Requer certificado A1 e CNPJ em Configurações → Fiscal (mesmo CNPJ do certificado).
          Homologação e Produção usam endpoints e NSU separados. A SEFAZ distribui DF-e dos
          últimos ~3 meses em cada ambiente.
        </p>

        <div
          className={`rounded-lg border p-3 text-sm flex gap-2 ${
            syncEnvironment === 'production'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100'
              : 'border-sky-200 bg-sky-50 text-sky-900 dark:bg-sky-950/30 dark:text-sky-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            {syncEnvironment === 'production' ? (
              <>
                Ambiente ativo: <strong>Produção</strong> — busca DF-e reais no Ambiente Nacional
                da SEFAZ.
              </>
            ) : syncEnvironment === 'homologation' ? (
              <>
                Ambiente ativo: <strong>Homologação</strong> — busca DF-e de teste na SEFAZ hom.
                Para notas reais de fornecedores, alterne para Produção em Configurações → Fiscal
                (o NSU de cada ambiente é independente).
              </>
            ) : (
              <>
                O sync usa o ambiente configurado em <strong>Configurações → Fiscal</strong>{' '}
                (Homologação ou Produção). Ambos são suportados.
              </>
            )}
          </span>
        </div>

        {syncMessages.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-900/40 p-3 text-xs text-slate-700 dark:text-slate-200 space-y-1 max-h-36 overflow-y-auto">
            <p className="font-semibold text-slate-900 dark:text-slate-100">Retorno SEFAZ</p>
            {syncMessages.map((m, i) => (
              <p key={i} className="font-mono break-words">
                {m}
              </p>
            ))}
          </div>
        )}

        {!selectedId ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">
              Pendentes / prontas ({pending.length})
            </h3>
            {loadingList ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
              </div>
            ) : pending.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Nenhuma nota pendente. Clique em <strong>Sincronizar com SEFAZ</strong>.
              </p>
            ) : (
              <div className="space-y-2">
                {pending.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void openPreview(n.id)}
                    className="w-full text-left rounded-lg border border-gray-200 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">
                          {n.emitNome || 'Emitente'}{' '}
                          {n.numero != null ? `— NF ${n.serie}/${n.numero}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-[280px] sm:max-w-md">
                          {n.chaveAcesso}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">{formatMoney(n.valorTotal)}</p>
                        <p className="text-xs text-muted-foreground">
                          {n.status === 'READY' ? 'Pronta' : 'Aguardando XML'}
                          {n.hasFullXml ? ' · XML ok' : ''}
                        </p>
                      </div>
                    </div>
                    {n.errorMessage && (
                      <p className="text-xs text-amber-700 mt-1">{n.errorMessage}</p>
                    )}
                  </button>
                ))}
              </div>
            )}

            {imported.length > 0 && (
              <p className="text-xs text-muted-foreground pt-2">
                {imported.length} nota(s) já importada(s) neste histórico.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => setSelectedId(null)}
              >
                <X className="w-4 h-4" /> Voltar
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void handleIgnore()}>
                Ignorar nota
              </Button>
            </div>

            {loadingPreview ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando itens…
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Fornecedor</Label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Criar automaticamente pelo emitente</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 dark:bg-gray-800/50 text-left">
                        <th className="p-2 w-8" />
                        <th className="p-2 font-medium">Produto (NF-e)</th>
                        <th className="p-2 font-medium">Vínculo</th>
                        <th className="p-2 font-medium">Qtd</th>
                        <th className="p-2 font-medium">Unit.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewItems.map((it) => (
                        <tr key={it.line} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="p-2">
                            <input
                              type="checkbox"
                              checked={!!selectedLines[it.line]}
                              disabled={!it.productId}
                              onChange={(e) =>
                                setSelectedLines((prev) => ({
                                  ...prev,
                                  [it.line]: e.target.checked,
                                }))
                              }
                            />
                          </td>
                          <td className="p-2">
                            <p className="font-medium">{it.xProd}</p>
                            <p className="text-xs text-muted-foreground">
                              {[it.cEAN, it.cProd].filter(Boolean).join(' · ')}
                            </p>
                          </td>
                          <td className="p-2">
                            {it.productId ? (
                              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {it.productName}
                              </span>
                            ) : (
                              <span className="text-xs text-amber-700 dark:text-amber-300">
                                Sem cadastro — cadastre o produto (EAN/código) e atualize
                              </span>
                            )}
                          </td>
                          <td className="p-2 whitespace-nowrap">
                            {it.qCom} {it.uCom}
                          </td>
                          <td className="p-2 whitespace-nowrap">{formatMoney(it.vUnCom)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {previewItems.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    XML completo ainda não disponível. Sincronize novamente após a ciência da
                    operação na SEFAZ.
                  </p>
                )}

                <Button
                  className="gap-2 w-full sm:w-auto"
                  disabled={importing || previewItems.every((i) => !selectedLines[i.line])}
                  onClick={() => void handleImport()}
                >
                  {importing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <PackagePlus className="w-4 h-4" />
                  )}
                  Dar entrada dos itens selecionados
                </Button>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
