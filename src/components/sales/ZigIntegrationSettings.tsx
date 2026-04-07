import React, { useState, useEffect } from 'react';
import { RefreshCw, Store, Check, Settings, Network, Zap, KeyRound } from 'lucide-react';
import { Switch } from '../ui/switch';
import { Label } from '../ui/label';
import { toast } from 'sonner@2.0.3';
import { useCompany } from '../../contexts/CompanyContext';
import { projectId, publicAnonKey } from '../../utils/supabase/env';

interface ZigStore {
  id: string;
  name: string;
}

export function ZigIntegrationSettings({ onSyncComplete }: { onSyncComplete?: () => void }) {
  const { currentCompany } = useCompany();

  const [stores, setStores] = useState<ZigStore[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [redeId, setRedeId] = useState<string>('35c5259d-4d3a-4934-9dd2-78a057a3aa8f');
  const [zigToken, setZigToken] = useState('');
  const [hasTokenOnServer, setHasTokenOnServer] = useState(false);
  const [tokenMasked, setTokenMasked] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [fetchingStores, setFetchingStores] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [autoBaixaEnabled, setAutoBaixaEnabled] = useState(false);
  const [savingAutoBaixa, setSavingAutoBaixa] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);

  const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d`;

  const fetchStores = async (overrideRedeId?: string) => {
    if (!currentCompany) return;

    const redeToUse = (overrideRedeId ?? redeId)?.trim();

    if (!redeToUse) {
      toast.error('Informe o ID da Rede para listar as lojas.');
      return;
    }

    setFetchingStores(true);
    try {
      const url = new URL(`${SERVER_URL}/zig/stores`);
      url.searchParams.append('rede', redeToUse);
      url.searchParams.append('companyId', currentCompany.id);

      const headers: Record<string, string> = {
        Authorization: `Bearer ${publicAnonKey}`,
      };
      const t = zigToken.trim();
      if (t) headers['X-ZIG-TOKEN'] = t;

      const res = await fetch(url.toString(), { headers });

      const data = await res.json().catch(() => ({}));

      if (data.available === false && data.needsConfiguration) {
        toast.warning(data.warning || 'Token ZIG inválido ou não enviado.');
        setStores([]);
        return;
      }

      if (!res.ok) {
        const errorMessage = data.error || data.message || res.statusText || 'Erro ao carregar lojas';
        throw new Error(errorMessage);
      }

      const fetchedStores = data.stores || [];
      setStores(fetchedStores);

      if (fetchedStores.length === 0) {
        toast.info('Nenhuma loja encontrada para esta Rede.');
      } else {
        toast.success(`${fetchedStores.length} lojas carregadas.`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('Error fetching stores:', error);
      toast.error(message);
    } finally {
      setFetchingStores(false);
    }
  };

  const loadAutoBaixa = async () => {
    if (!currentCompany?.id) return;
    try {
      const res = await fetch(`${SERVER_URL}/zig/auto-baixa/${currentCompany.id}`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setAutoBaixaEnabled(!!data.enabled);
      }
    } catch (error) {
      console.error('Error loading auto-baixa config:', error);
    }
  };

  const loadConfig = async () => {
    if (!currentCompany?.id) return;

    try {
      const res = await fetch(`${SERVER_URL}/zig/config/${currentCompany.id}`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          if (data.config.redeId) {
            setRedeId(data.config.redeId);
            void fetchStores(data.config.redeId);
          }
          if (data.config.storeId) {
            setSelectedStore(data.config.storeId);
            setConfigLoaded(true);
          }
          setHasTokenOnServer(!!data.config.hasZigToken);
          setTokenMasked(data.config.zigTokenMasked);
        }
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
    void loadAutoBaixa();
  };

  const saveAutoBaixa = async (enabled: boolean) => {
    if (!currentCompany?.id) return;
    setSavingAutoBaixa(true);
    try {
      const res = await fetch(`${SERVER_URL}/zig/auto-baixa`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ companyId: currentCompany.id, enabled }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha ao salvar' }));
        throw new Error(err.error || 'Falha ao salvar');
      }
      setAutoBaixaEnabled(enabled);
      toast.success(
        enabled
          ? 'Baixa automática ativada. Configure o agendamento no servidor (cron) para rodar sem abrir o sistema.'
          : 'Baixa automática desativada.',
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || 'Erro ao salvar');
    } finally {
      setSavingAutoBaixa(false);
    }
  };

  const handleAutoRunNow = async () => {
    if (!currentCompany?.id) return;
    if (!configLoaded) {
      toast.error('Salve a configuração da loja ZIG antes.');
      return;
    }
    setAutoRunning(true);
    try {
      const res = await fetch(`${SERVER_URL}/zig/auto-run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ companyId: currentCompany.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao executar');
      }
      if (data.skipped && data.message) {
        toast.message(data.message);
      } else {
        toast.success(data.message || `Processado: ${data.processed ?? 0} grupo(s).`);
      }
      if (onSyncComplete) onSyncComplete();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || 'Erro na baixa automática');
    } finally {
      setAutoRunning(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!currentCompany?.id) return;

    if (!selectedStore) {
      toast.error('Selecione uma loja antes de salvar.');
      return;
    }

    const tok = zigToken.trim();
    if (!hasTokenOnServer && !tok) {
      toast.error('Informe o token de integração ZIG (fornecido pela ZIG para esta empresa).');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${SERVER_URL}/zig/config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          companyId: currentCompany.id,
          storeId: selectedStore,
          redeId: redeId.trim(),
          ...(tok ? { zigToken: tok } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha ao salvar' }));
        throw new Error(err.error || 'Failed to save config');
      }

      toast.success('Configuração salva com sucesso!');
      setConfigLoaded(true);
      setHasTokenOnServer(true);
      if (tok) setTokenMasked(`${tok.slice(0, 4)}…${tok.slice(-4)}`);
      setZigToken('');
      if (onSyncComplete) onSyncComplete();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Erro: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentCompany?.id) {
      void loadConfig();
    }
  }, [currentCompany?.id]);

  if (!currentCompany) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3" />
            <p className="text-gray-500">Carregando configurações...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-pink-100 p-2.5 rounded-xl">
            <Store className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">ZIG — credenciais e loja</h2>
            <p className="text-sm text-gray-500">
              Token e loja da API. Para buscar vendas e dar baixa, use <strong className="font-medium text-gray-700">Ponto de Venda</strong> → aba{' '}
              <strong className="font-medium text-gray-700">ZIG / Baixa</strong>.
            </p>
          </div>
        </div>

        {configLoaded && (
          <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-semibold text-green-700">Loja salva</span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="p-5 bg-gray-50 rounded-xl border border-gray-100 space-y-5">
          <div className="flex items-center gap-2 text-pink-700 font-semibold text-sm mb-1">
            <span className="flex items-center justify-center w-5 h-5 bg-pink-100 rounded-full text-[10px]">1</span>
            Token e rede
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              Token ZIG (por empresa)
            </label>
            <input
              type="password"
              autoComplete="off"
              value={zigToken}
              onChange={(e) => setZigToken(e.target.value)}
              placeholder={hasTokenOnServer ? 'Deixe em branco para manter o token salvo' : 'Cole o token fornecido pela ZIG'}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-sm"
            />
            {hasTokenOnServer && (
              <p className="text-xs text-gray-500 mt-1">
                Token salvo: <span className="font-mono">{tokenMasked ?? '****'}</span> — preencha acima somente para substituir.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">ID da Rede (obrigatório)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Network className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={redeId}
                    onChange={(e) => setRedeId(e.target.value)}
                    placeholder="UUID da rede na ZIG"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-gray-700 border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void fetchStores()}
                  disabled={fetchingStores || !redeId}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 transition-all font-medium text-sm shadow-sm"
                >
                  {fetchingStores ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Listar
                </button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Para listar lojas, informe o token acima (ou salve antes e usamos o token desta empresa).
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Loja vinculada</label>
              <div className="flex gap-2">
                <select
                  value={selectedStore}
                  onChange={(e) => {
                    setSelectedStore(e.target.value);
                    setConfigLoaded(false);
                  }}
                  disabled={stores.length === 0}
                  className="flex-1 rounded-lg border-gray-300 shadow-sm text-gray-700 focus:border-pink-500 focus:ring-pink-500 disabled:bg-gray-100 disabled:text-gray-400 text-sm"
                >
                  <option value="">{stores.length === 0 ? 'Busque as lojas primeiro' : 'Selecione uma loja...'}</option>
                  {stores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {store.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleSaveConfig()}
                  disabled={loading || !selectedStore}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-white font-medium transition-all shadow-sm text-sm ${
                    configLoaded ? 'bg-green-600 hover:bg-green-700' : 'bg-pink-600 hover:bg-pink-700'
                  } disabled:opacity-50`}
                >
                  {configLoaded ? <Check className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                  {configLoaded ? 'Salvo' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 bg-amber-50/90 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-900 space-y-4">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold text-sm mb-1">
            <Zap className="w-5 h-5 text-amber-600" />
            Baixa automática no dia seguinte
          </div>
          <p className="text-xs text-amber-900/85 dark:text-amber-200/90 leading-relaxed">
            No dia seguinte ao fechamento das vendas, o servidor pode dar baixa <strong>só para produtos já cadastrados</strong>{' '}
            (SKU, código de barras, nome ou mapeamento). Fuso <strong>America/São_Paulo</strong>.
          </p>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Switch
                id="zig-auto-baixa-settings"
                checked={autoBaixaEnabled}
                onCheckedChange={(v) => void saveAutoBaixa(v)}
                disabled={savingAutoBaixa || !configLoaded}
              />
              <Label htmlFor="zig-auto-baixa-settings" className="text-sm text-amber-950 dark:text-amber-100 cursor-pointer">
                Ativar baixa automática diária
              </Label>
            </div>
            <button
              type="button"
              onClick={() => void handleAutoRunNow()}
              disabled={autoRunning || !configLoaded}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {autoRunning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Executar agora (ontem)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
