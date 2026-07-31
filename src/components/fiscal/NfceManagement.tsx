import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Eye,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Receipt,
  Send,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useCompany } from '../../contexts/CompanyContext';
import { usePagination } from '../../hooks/usePagination';
import {
  NfceApi,
  openDanfePrintWindow,
  type NfcePendingSale,
  type NfceSummary,
} from '../../repositories/nfceApi';
import { ApiClientError } from '../../lib/apiClient';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ListPaginationBar } from '../ui/list-pagination-bar';

type Tab = 'emitidas' | 'pendentes';

const PAGE_SIZE = 12;

function monthBounds(year: number, month: number) {
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1));
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function statusBadge(status: string) {
  const s = status.toUpperCase();
  const cls =
    s === 'AUTHORIZED'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
      : s === 'CANCELLED'
        ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200';
  return (
    <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>
  );
}

function downloadText(filename: string, content: string, mime = 'application/xml') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function NfceManagement() {
  const { currentCompany } = useCompany();
  const now = new Date();
  const [tab, setTab] = useState<Tab>('emitidas');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [mode, setMode] = useState<'requested' | 'all'>('requested');
  const [loading, setLoading] = useState(true);
  const [emittingId, setEmittingId] = useState<string | null>(null);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [issued, setIssued] = useState<NfceSummary[]>([]);
  const [pending, setPending] = useState<NfcePendingSale[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<NfceSummary | null>(null);
  const [danfeHtml, setDanfeHtml] = useState<string | null>(null);
  const [reprinting, setReprinting] = useState(false);
  const [downloadingXml, setDownloadingXml] = useState(false);

  const bounds = useMemo(() => monthBounds(year, month), [year, month]);
  const issuedResetKey = `${bounds.from}|${bounds.to}|${tab}`;
  const pendingResetKey = `${bounds.from}|${bounds.to}|${mode}|${tab}`;

  const issuedPage = usePagination(issued, PAGE_SIZE, issuedResetKey);
  const pendingPage = usePagination(pending, PAGE_SIZE, pendingResetKey);

  const load = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      if (tab === 'emitidas') {
        const items = await NfceApi.list(currentCompany.id, {
          limit: 200,
          from: bounds.from,
          to: bounds.to,
        });
        setIssued(items);
      } else {
        const sales = await NfceApi.listPendingSales(currentCompany.id, {
          from: bounds.from,
          to: bounds.to,
          mode,
          limit: 200,
        });
        setPending(sales);
      }
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Falha ao carregar notas';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id, tab, bounds.from, bounds.to, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const emitOne = async (saleId: string) => {
    setEmittingId(saleId);
    try {
      const res = await NfceApi.emitFromSale(saleId, currentCompany?.id);
      if (res.success) {
        toast.success(res.message || 'NFC-e autorizada');
      } else {
        toast.error(res.error || res.message || 'Emissão não autorizada');
      }
      await load();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erro na emissão';
      toast.error(msg);
    } finally {
      setEmittingId(null);
    }
  };

  const emitAllPending = async () => {
    if (pending.length === 0) return;
    if (
      !confirm(
        `Emitir NFC-e para ${pending.length} venda(s) pendente(s) deste mês? Isso pode levar alguns minutos.`,
      )
    ) {
      return;
    }
    setBulkRunning(true);
    let ok = 0;
    let fail = 0;
    for (const sale of pending) {
      try {
        const res = await NfceApi.emitFromSale(sale.saleId, currentCompany?.id);
        if (res.success) ok += 1;
        else fail += 1;
      } catch {
        fail += 1;
      }
    }
    setBulkRunning(false);
    toast.message(`Emissão em lote: ${ok} ok, ${fail} falha(s)`);
    await load();
  };

  const printDanfe = async (id: string) => {
    setReprinting(true);
    try {
      const { html } = await NfceApi.getDanfe(id, currentCompany?.id);
      if (!openDanfePrintWindow(html)) {
        toast.error('Permita pop-ups para imprimir o DANFE');
      }
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'DANFE indisponível';
      toast.error(msg);
    } finally {
      setReprinting(false);
    }
  };

  const openDetail = async (nfce: NfceSummary) => {
    setDetailOpen(true);
    setDetail(nfce);
    setDanfeHtml(null);
    setDetailLoading(true);
    try {
      const fresh = await NfceApi.get(nfce.id, currentCompany?.id);
      setDetail(fresh);
      if (fresh.hasDanfe && fresh.status === 'AUTHORIZED') {
        try {
          const { html } = await NfceApi.getDanfe(fresh.id, currentCompany?.id);
          setDanfeHtml(html);
        } catch {
          setDanfeHtml(null);
        }
      }
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Falha ao carregar a nota';
      toast.error(msg);
    } finally {
      setDetailLoading(false);
    }
  };

  const downloadXml = async (id: string, chave?: string | null) => {
    setDownloadingXml(true);
    try {
      const { xml, chaveAcesso } = await NfceApi.getXml(id, currentCompany?.id);
      const name = `NFCe-${chaveAcesso || chave || id}.xml`;
      downloadText(name, xml);
      toast.success('XML baixado');
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'XML indisponível';
      toast.error(msg);
    } finally {
      setDownloadingXml(false);
    }
  };

  if (!currentCompany) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Selecione uma empresa para gerenciar as notas fiscais.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Receipt className="w-7 h-7 text-blue-600" aria-hidden />
            Notas fiscais (NFC-e)
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Consulte, visualize e reimprima as emitidas; emita as pendentes do mês.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => void load()}>
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Ano</Label>
            <Input
              type="number"
              min={2020}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())}
            />
          </div>
          {tab === 'pendentes' && (
            <div className="space-y-1.5 col-span-2">
              <Label>Filtro de pendentes</Label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'requested' | 'all')}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="requested">Marcadas para NFC-e / com falha</option>
                <option value="all">Todas as vendas sem NFC-e autorizada</option>
              </select>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('emitidas')}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            tab === 'emitidas'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
          }`}
        >
          Emitidas
        </button>
        <button
          type="button"
          onClick={() => setTab('pendentes')}
          className={`rounded-md px-3 py-2 text-sm font-medium ${
            tab === 'pendentes'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200'
          }`}
        >
          Pendentes do mês
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      ) : tab === 'emitidas' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              NFC-e do período ({issuedPage.total})
            </CardTitle>
            <CardDescription>Notas já geradas neste mês (qualquer status).</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {issued.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma NFC-e neste período.</p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-3 font-medium">Nº</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Chave</th>
                      <th className="py-2 pr-3 font-medium">Emissão</th>
                      <th className="py-2 pr-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issuedPage.paginatedItems.map((n) => (
                      <tr key={n.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          {n.serie}/{n.numero}
                        </td>
                        <td className="py-2 pr-3">{statusBadge(n.status)}</td>
                        <td className="py-2 pr-3 font-mono text-xs max-w-[180px] truncate">
                          {n.chaveAcesso || '—'}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">{formatDate(n.dataEmissao)}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={() => void openDetail(n)}
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Visualizar
                            </Button>
                            {n.hasDanfe && n.status === 'AUTHORIZED' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                disabled={reprinting}
                                onClick={() => void printDanfe(n.id)}
                              >
                                <Printer className="w-3.5 h-3.5" />
                                Reimprimir
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ListPaginationBar
                  page={issuedPage.page}
                  totalPages={issuedPage.totalPages}
                  onPageChange={issuedPage.setPage}
                  from={issuedPage.from}
                  to={issuedPage.to}
                  total={issuedPage.total}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base">Pendentes ({pendingPage.total})</CardTitle>
              <CardDescription>
                Vendas sem NFC-e autorizada — emita individualmente ou em lote no fim do mês.
              </CardDescription>
            </div>
            <Button
              className="gap-2"
              disabled={bulkRunning || pending.length === 0}
              onClick={() => void emitAllPending()}
            >
              {bulkRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Emitir todas
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma venda pendente de NFC-e neste filtro.
              </p>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                      <th className="py-2 pr-3 font-medium">Data</th>
                      <th className="py-2 pr-3 font-medium">Cliente</th>
                      <th className="py-2 pr-3 font-medium">Total</th>
                      <th className="py-2 pr-3 font-medium">Último status</th>
                      <th className="py-2 pr-3 font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingPage.paginatedItems.map((s) => (
                      <tr key={s.saleId} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 pr-3 whitespace-nowrap">{formatDate(s.timestamp)}</td>
                        <td className="py-2 pr-3">{s.customerName || 'Consumidor'}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{formatMoney(s.total)}</td>
                        <td className="py-2 pr-3">
                          {s.lastNfceStatus ? (
                            <div className="space-y-0.5">
                              {statusBadge(s.lastNfceStatus)}
                              {s.lastNfceMotivo && (
                                <p className="text-xs text-muted-foreground max-w-xs truncate">
                                  {s.lastNfceMotivo}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Não emitida</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1.5">
                            {s.lastNfceId && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1"
                                onClick={() =>
                                  void openDetail({
                                    id: s.lastNfceId!,
                                    companyId: currentCompany.id,
                                    saleId: s.saleId,
                                    customerId: s.customerId,
                                    chaveAcesso: null,
                                    numero: 0,
                                    serie: 0,
                                    modelo: '65',
                                    ambiente: '',
                                    status: s.lastNfceStatus || 'REJECTED',
                                    protocolo: null,
                                    codigoStatus: null,
                                    motivoStatus: s.lastNfceMotivo,
                                    qrCodeUrl: null,
                                  })
                                }
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Ver
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="gap-1"
                              disabled={emittingId === s.saleId || bulkRunning}
                              onClick={() => void emitOne(s.saleId)}
                            >
                              {emittingId === s.saleId ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                              Emitir
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ListPaginationBar
                  page={pendingPage.page}
                  totalPages={pendingPage.totalPages}
                  onPageChange={pendingPage.setPage}
                  from={pendingPage.from}
                  to={pendingPage.to}
                  total={pendingPage.total}
                />
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetail(null);
            setDanfeHtml(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              NFC-e{' '}
              {detail && detail.numero
                ? `${detail.serie}/${detail.numero}`
                : detail?.chaveAcesso
                  ? detail.chaveAcesso.slice(-8)
                  : ''}
            </DialogTitle>
            <DialogDescription>
              Detalhes da nota fiscal. Use Reimprimir para abrir o DANFE na impressora.
            </DialogDescription>
          </DialogHeader>

          {detailLoading && !detail ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando nota…
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <div className="mt-0.5">{statusBadge(detail.status)}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ambiente</p>
                  <p className="font-medium">{detail.ambiente || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Número / Série</p>
                  <p className="font-medium">
                    {detail.numero ? `${detail.serie}/${detail.numero}` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Protocolo</p>
                  <p className="font-medium font-mono text-xs">{detail.protocolo || '—'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Chave de acesso</p>
                  <p className="font-mono text-xs break-all">{detail.chaveAcesso || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Emissão</p>
                  <p className="font-medium">{formatDate(detail.dataEmissao)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Autorização</p>
                  <p className="font-medium">{formatDate(detail.dataAutorizacao)}</p>
                </div>
                {(detail.codigoStatus || detail.motivoStatus) && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Retorno SEFAZ</p>
                    <p className="text-sm">
                      {detail.codigoStatus ? `${detail.codigoStatus} — ` : ''}
                      {detail.motivoStatus || '—'}
                    </p>
                  </div>
                )}
              </div>

              {detailLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Atualizando detalhes…
                </div>
              )}

              {danfeHtml ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Prévia do DANFE</p>
                  <iframe
                    title="Prévia DANFE NFC-e"
                    srcDoc={danfeHtml}
                    className="w-full h-[420px] rounded-md border border-gray-200 dark:border-gray-700 bg-white"
                    sandbox="allow-same-origin"
                  />
                </div>
              ) : detail.hasDanfe === false || detail.status !== 'AUTHORIZED' ? (
                <p className="text-sm text-muted-foreground">
                  Prévia do DANFE disponível apenas para NFC-e autorizada com cupom gerado.
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {detail?.hasAuthorizedXml && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                disabled={downloadingXml}
                onClick={() => void downloadXml(detail.id, detail.chaveAcesso)}
              >
                {downloadingXml ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Baixar XML
              </Button>
            )}
            {detail?.hasDanfe && detail.status === 'AUTHORIZED' && (
              <Button
                type="button"
                className="gap-2"
                disabled={reprinting}
                onClick={() => void printDanfe(detail.id)}
              >
                {reprinting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Printer className="w-4 h-4" />
                )}
                Reimprimir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
