import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, Store, AlertCircle, Calendar, ShoppingCart, Package, X, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useCompany } from '../../contexts/CompanyContext';
import { projectId, publicAnonKey } from '../../utils/supabase/env';
import { APP_NAME } from '../../config/branding';

interface PendingSale {
  /** Id único da linha (transação ZIG + SKU + productId); usado na confirmação. */
  transactionId: string;
  /** Id do pedido na ZIG (pode repetir em várias linhas do mesmo cupom). */
  zigTransactionId?: string;
  transactionDate: string;
  saleDate: string;
  productSku: string;
  productName: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  systemProduct: {
    id: string;
    name: string;
    currentStock: number;
    unit: string;
  } | null;
  hasRecipe: boolean;
  matchType: 'manual' | 'sku' | 'name' | 'none';
  recipe: {
    ingredients: Array<{
      productId: string;
      productName: string;
      quantity: number;
      unit: string;
      quantityNeeded: number;
    }>;
  } | null;
  notFound?: boolean;
  isAddition?: boolean;
}

type RecipeIngredientTotal = {
  productId: string;
  productName: string;
  unit: string;
  quantityNeeded: number;
};

interface PendingSaleGroup {
  groupKey: string;
  saleDate: string;
  productSku: string;
  productName: string;
  quantity: number;
  totalValue: number;
  systemProduct: PendingSale['systemProduct'];
  notFound: boolean;
  matchType: PendingSale['matchType'];
  transactionIds: string[];
  zigTransactionId?: string;
  hasRecipe: boolean;
  recipeIngredients: RecipeIngredientTotal[];
  hasAddition: boolean;
}

export function ZigSalesBaixa({ onSyncComplete }: { onSyncComplete?: () => void }) {
  const { currentCompany } = useCompany();

  const [configLoaded, setConfigLoaded] = useState(false);
  
  // Date selection
  const [dateFilter, setDateFilter] = useState<'yesterday' | 'today' | 'custom'>('yesterday');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Preview state
  const [salesByDate, setSalesByDate] = useState<Record<string, PendingSale[]>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [expandedDates, setExpandedDates] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [showOnlyNotFound, setShowOnlyNotFound] = useState(false);
  const [previewRange, setPreviewRange] = useState<{ start: string; end: string } | null>(null);
  /** ID da sessão gravada no servidor no último preview — confirmação usa KV em vez de refazer GET na ZIG. */
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);

  const groupedSalesByDate = useMemo(() => {
    const result: Record<string, PendingSaleGroup[]> = {};

    for (const [date, dateSales] of Object.entries(salesByDate)) {
      const groupMap = new Map<
        string,
        {
          groupKey: string;
          saleDate: string;
          productSku: string;
          productName: string;
          quantity: number;
          totalValue: number;
          systemProduct: PendingSale['systemProduct'];
          notFound: boolean;
          matchType: PendingSale['matchType'];
          transactionIds: string[];
          ingredientTotals: Map<string, RecipeIngredientTotal>;
          hasRecipe: boolean;
          hasAddition: boolean;
          zigTransactionId?: string;
        }
      >();

      for (const sale of dateSales) {
        const sku = sale.productSku;
        if (!sku) continue;

        // Agrupa por produto (SKU) dentro do mesmo dia
        const groupKey = `${date}|${sku}`;

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, {
            groupKey,
            saleDate: date,
            productSku: sku,
            productName: sale.productName,
            quantity: 0,
            totalValue: 0,
            systemProduct: sale.systemProduct,
            notFound: !!sale.notFound,
            matchType: sale.matchType,
            transactionIds: [],
            ingredientTotals: new Map(),
            hasRecipe: !!sale.hasRecipe,
            hasAddition: !!sale.isAddition,
            zigTransactionId: sale.zigTransactionId,
          });
        }

        const g = groupMap.get(groupKey)!;
        if (!g.zigTransactionId && sale.zigTransactionId) {
          g.zigTransactionId = sale.zigTransactionId;
        }
        g.quantity += sale.quantity || 0;
        g.totalValue += sale.totalValue || 0;
        g.transactionIds.push(sale.transactionId);
        g.notFound = g.notFound || !!sale.notFound;
        g.hasRecipe = g.hasRecipe || !!sale.hasRecipe;
        g.hasAddition = g.hasAddition || !!sale.isAddition;

        // Se algum item do grupo tiver match com o produto do sistema, preserva
        if (!g.systemProduct && sale.systemProduct) {
          g.systemProduct = sale.systemProduct;
        }

        // Mantém o melhor tipo de match disponível
        if (g.matchType === 'none' && sale.matchType !== 'none') {
          g.matchType = sale.matchType;
        }

        // Receita precisa ser somada com base na quantidade total do lote
        if (sale.recipe?.ingredients?.length) {
          for (const ing of sale.recipe.ingredients) {
            const prev = g.ingredientTotals.get(ing.productId);
            const nextQty = (prev?.quantityNeeded || 0) + (ing.quantityNeeded || 0);
            g.ingredientTotals.set(ing.productId, {
              productId: ing.productId,
              productName: ing.productName,
              unit: ing.unit,
              quantityNeeded: nextQty,
            });
          }
        }
      }

      result[date] = Array.from(groupMap.values()).map(g => ({
        groupKey: g.groupKey,
        saleDate: g.saleDate,
        productSku: g.productSku,
        productName: g.productName,
        quantity: g.quantity,
        totalValue: g.totalValue,
        systemProduct: g.systemProduct,
        notFound: g.notFound,
        matchType: g.matchType,
        transactionIds: Array.from(new Set(g.transactionIds)),
        zigTransactionId: g.zigTransactionId,
        hasRecipe: g.hasRecipe,
        recipeIngredients: Array.from(g.ingredientTotals.values()),
        hasAddition: g.hasAddition,
      }));
    }

    return result;
  }, [salesByDate]);

  const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d`;

  const edgeAuthHeaders = {
    Authorization: `Bearer ${publicAnonKey}`,
    apikey: publicAnonKey,
  };

  /** YYYY-MM-DD no calendário de São Paulo (mesma base do servidor ZIG). */
  const ymdSaoPaulo = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);

  const yesterdayYmdSaoPaulo = () => {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const todayStr = fmt.format(new Date());
    const [y, mo, d] = todayStr.split('-').map((x) => parseInt(x, 10));
    const dt = new Date(Date.UTC(y, mo - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    const yy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  };

  const getDateRange = () => {
    const todaySp = ymdSaoPaulo(new Date());
    const yesterdaySp = yesterdayYmdSaoPaulo();

    let start: string;
    let end: string;

    switch (dateFilter) {
      case 'yesterday':
        start = yesterdaySp;
        end = yesterdaySp;
        break;
      case 'today':
        start = todaySp;
        end = todaySp;
        break;
      case 'custom':
        start = customStartDate || yesterdaySp;
        end = customEndDate || todaySp;
        break;
      default:
        start = yesterdaySp;
        end = yesterdaySp;
    }

    return { start, end };
  };

  const loadConfig = async () => {
    if (!currentCompany?.id) return;

    try {
      const res = await fetch(`${SERVER_URL}/zig/config/${currentCompany.id}`, {
        headers: { ...edgeAuthHeaders },
      });
      if (res.ok) {
        const data = await res.json();
        setConfigLoaded(!!data.config?.storeId);
      } else {
        setConfigLoaded(false);
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setConfigLoaded(false);
    }
  };

  const handlePreviewSales = async () => {
    if (!currentCompany?.id) return;
    
    const { start, end } = getDateRange();

    try {
      setLoadingPreview(true);
      setSalesByDate({});
      setPreviewSessionId(null);

      const res = await fetch(`${SERVER_URL}/zig/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...edgeAuthHeaders,
        },
        body: JSON.stringify({
          companyId: currentCompany.id,
          startDate: start,
          endDate: end
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro no processamento' }));
        throw new Error(err.error || 'Erro na resposta do servidor');
      }

      const data = await res.json();
      
      if (data.salesByDate && Object.keys(data.salesByDate).length > 0) {
        setSalesByDate(data.salesByDate);
        setPreviewRange({ start, end });
        setProductSearch('');
        setShowOnlyNotFound(false);
        setPreviewSessionId(
          typeof data.previewSessionId === 'string' && data.previewSessionId.length > 0
            ? data.previewSessionId
            : null,
        );

        // Selecionar todas as linhas pendentes (inclui não cadastradas: o servidor cria produto e dá baixa)
        const allLineIds = data.sales.map((s: PendingSale) => s.transactionId);
        setSelectedSales(allLineIds);
        
        // Expandir todas as datas por padrão
        setExpandedDates(Object.keys(data.salesByDate));
        
        setShowPreview(true);
        toast.success(`${data.totalSales} vendas encontradas em ${Object.keys(data.salesByDate).length} dias!`);
      } else {
        setPreviewSessionId(null);
        toast.info('Nenhuma venda nova encontrada neste período.');
      }
      
    } catch (error: any) {
      console.error('Preview error:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmSales = async () => {
    if (!currentCompany?.id) return;
    
    if (selectedSales.length === 0) {
      toast.error('Selecione pelo menos uma venda para processar.');
      return;
    }

    try {
      setConfirming(true);

      const flatSales = Object.values(salesByDate).flat() as PendingSale[];
      const lineItems = flatSales
        .filter((s) => selectedSales.includes(s.transactionId))
        .map((s) => ({
          transactionId: s.transactionId,
          productSku: s.productSku,
          productName: s.productName,
          quantity: s.quantity,
        }));

      if (lineItems.length === 0) {
        toast.error('Não há linhas do preview para baixar. Feche e busque as vendas novamente.');
        setConfirming(false);
        return;
      }

      const confirmBody = JSON.stringify({
        companyId: currentCompany.id,
        transactionIds: selectedSales,
        startDate: previewRange?.start,
        endDate: previewRange?.end,
        lineItems,
        ...(previewSessionId ? { previewSessionId } : {}),
        fromPreview: true,
      });

      const confirmHeaders = {
        'Content-Type': 'application/json',
        'X-Zig-Confirm-Source': 'preview',
        ...edgeAuthHeaders,
      };

      const res = await fetch(`${SERVER_URL}/zig/confirm`, {
        method: 'POST',
        headers: confirmHeaders,
        body: confirmBody,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro no processamento' }));
        let msg =
          (typeof err.error === 'string' && err.error) || 'Erro na resposta do servidor';
        if (/Falha ao buscar vendas ZIG/i.test(msg)) {
          msg =
            'A Edge Function no Supabase ainda está com build antigo: o POST /zig/confirm não pode chamar a API ZIG (só baixa local com snapshot). ' +
            'Faça o deploy da função `make-server-8a20b27d` a partir deste repositório (pasta `supabase/functions/make-server-8a20b27d`). ' +
            `Confira com GET …/zig/meta (deve mostrar callsZigApiOnConfirm: false). Detalhe: ${msg}`;
        }
        throw new Error(msg);
      }

      const data = await res.json();
      
      toast.success(data.message || `${data.processed} vendas processadas com sucesso!`);
      setShowPreview(false);
      setSalesByDate({});
      setSelectedSales([]);
      setPreviewRange(null);
      setPreviewSessionId(null);
      setProductSearch('');
      setShowOnlyNotFound(false);
      
      if (onSyncComplete) onSyncComplete();
      
    } catch (error: any) {
      console.error('Confirm error:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setConfirming(false);
    }
  };

  const toggleGroupSelection = (group: PendingSaleGroup) => {
    setSelectedSales(prev => {
      const allSelected = group.transactionIds.every(id => prev.includes(id));
      if (allSelected) {
        return prev.filter(id => !group.transactionIds.includes(id));
      }
      return [...new Set([...prev, ...group.transactionIds])];
    });
  };

  const toggleDateSelection = (date: string) => {
    const dateGroups = groupedSalesByDate[date] || [];
    const dateTransactionIds = dateGroups.flatMap(g => g.transactionIds);
    if (dateTransactionIds.length === 0) return;

    const allSelected = dateTransactionIds.every(id => selectedSales.includes(id));

    if (allSelected) {
      setSelectedSales(prev => prev.filter(id => !dateTransactionIds.includes(id)));
    } else {
      setSelectedSales(prev => [...new Set([...prev, ...dateTransactionIds])]);
    }
  };

  const toggleExpandDate = (date: string) => {
    setExpandedDates(prev => 
      prev.includes(date) 
        ? prev.filter(d => d !== date)
        : [...prev, date]
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: '2-digit', 
      month: 'long', 
      year: 'numeric' 
    });
  };

  const allGroups = Object.values(groupedSalesByDate).flat();
  const totalGroups = allGroups.length;
  const query = productSearch.trim().toLowerCase();

  const matchesGroupFilters = (group: PendingSaleGroup) => {
    if (showOnlyNotFound && !group.notFound) return false;
    if (!query) return true;
    return (
      group.productName.toLowerCase().includes(query) ||
      group.productSku.toLowerCase().includes(query) ||
      (group.systemProduct?.name || '').toLowerCase().includes(query)
    );
  };

  const filteredGroupsCount = allGroups.filter(matchesGroupFilters).length;
  const selectedGroupCount = allGroups.filter(g =>
    g.transactionIds.every(id => selectedSales.includes(id))
  ).length;

  const getFilteredGroupsByDate = (date: string) => {
    const dateGroups = groupedSalesByDate[date] || [];
    return dateGroups.filter(matchesGroupFilters);
  };

  useEffect(() => {
    if (currentCompany?.id) {
      loadConfig();
    }
  }, [currentCompany?.id]);

  // Safety check - render loading state if no company
  if (!currentCompany) {
    return (
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
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
            <h2 className="text-xl font-bold text-gray-900">Vendas ZIG — baixa no estoque</h2>
            <p className="text-sm text-gray-500">
              Buscar vendas na ZIG, conferir o preview e confirmar a baixa no {APP_NAME} (a confirmação não refaz o GET na ZIG).
            </p>
          </div>
        </div>
        
        {configLoaded && (
           <div className="flex items-center gap-2 bg-green-50 px-3 py-1.5 rounded-full border border-green-100">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-xs font-semibold text-green-700">Conectado</span>
           </div>
        )}
      </div>

      <div className="space-y-6">
        {!configLoaded && (
          <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm flex gap-2 items-start">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>
              Configure o token ZIG, rede e loja em <strong className="font-semibold">Integrações</strong> antes de buscar vendas
              aqui.
            </span>
          </div>
        )}

        <div className="p-5 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 space-y-4">
          <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm mb-1">
            <span className="flex items-center justify-center w-5 h-5 bg-indigo-100 rounded-full text-[10px]">1</span>
            Período das vendas (ZIG)
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <button
              onClick={() => setDateFilter('yesterday')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilter === 'yesterday'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-indigo-300'
              }`}
            >
              Ontem
            </button>
            <button
              onClick={() => setDateFilter('today')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilter === 'today'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-indigo-300'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setDateFilter('custom')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilter === 'custom'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-indigo-300'
              }`}
            >
              Custom
            </button>
          </div>

          {dateFilter === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-indigo-700 mb-1">Data Inicial</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full rounded-lg border-indigo-200 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-indigo-700 mb-1">Data Final</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full rounded-lg border-indigo-200 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          <button
            onClick={handlePreviewSales}
            disabled={loadingPreview || !configLoaded}
            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-400 flex items-center justify-center gap-2.5 transition-all font-semibold shadow-md active:scale-95"
          >
            {loadingPreview ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
            {loadingPreview ? 'Carregando...' : 'Buscar Vendas Pendentes'}
          </button>
          <p className="text-[11px] text-indigo-800/80 leading-snug">
            O manual da ZIG usa <code className="bg-white/80 px-1 rounded">dtinicio</code>,{' '}
            <code className="bg-white/80 px-1 rounded">dtfim</code> (YYYY-MM-DD) e <code className="bg-white/80 px-1 rounded">loja</code>.
            O servidor busca um dia civil por vez para respeitar o limite da API.
          </p>
        </div>
      </div>

      {/* Modal de Preview de Vendas por Data */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-pink-50">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-indigo-600" />
                  Vendas Pendentes - Agrupadas por Dia
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredGroupsCount} de {totalGroups} produtos • {selectedGroupCount} selecionados
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowPreview(false);
                  setShowOnlyNotFound(false);
                }}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Filtrar por produto, SKU ou nome no sistema..."
                  className="w-full flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-indigo-500 focus:ring-indigo-500"
                />
                <label className="flex items-center gap-2 shrink-0 cursor-pointer select-none text-sm text-gray-700 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={showOnlyNotFound}
                    onChange={(e) => setShowOnlyNotFound(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Somente não cadastrados</span>
                </label>
              </div>
              <div className="space-y-4">
                {Object.keys(groupedSalesByDate).sort((a, b) => b.localeCompare(a)).map((date) => {
                  const dateGroups = getFilteredGroupsByDate(date);
                  const validCount = dateGroups.filter(g => !g.notFound).length;
                  const notFoundCount = dateGroups.filter(g => g.notFound).length;
                  const totalValue = dateGroups.reduce((sum, g) => sum + (g.totalValue || 0), 0);
                  const isExpanded = expandedDates.includes(date);
                  const dateTransactionIds = dateGroups.flatMap(g => g.transactionIds);
                  const allSelected = dateTransactionIds.length > 0 && dateTransactionIds.every(id => selectedSales.includes(id));
                  const hasAny = dateTransactionIds.length > 0;
                  
                  return (
                    <div key={date} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 flex items-center justify-between cursor-pointer hover:from-indigo-100 hover:to-blue-100 transition-all"
                           onClick={() => toggleExpandDate(date)}>
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleDateSelection(date);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                            disabled={!hasAny}
                          />
                          
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 text-sm capitalize">
                              📅 {formatDate(date)}
                            </h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-600">
                                {validCount} produtos válidos
                              </span>
                              {notFoundCount > 0 && (
                                <span className="text-xs text-amber-600">
                                  {notFoundCount} não encontradas
                                </span>
                              )}
                              {totalValue > 0 && (
                                <span className="text-xs font-semibold text-indigo-700">
                                  R$ {totalValue.toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </div>
                      
                      {isExpanded && (
                        <div className="p-4 space-y-3 bg-gray-50">
                          {dateGroups.map((group) => {
                            const isSelected = group.transactionIds.every(id => selectedSales.includes(id));
                            return (
                            <div 
                              key={group.groupKey}
                              className={`border rounded-lg p-3 transition-all ${
                                group.notFound
                                  ? 'bg-amber-50 border-amber-200'
                                  : isSelected
                                    ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleGroupSelection(group)}
                                  className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                />
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <h5 className="font-bold text-gray-900 text-sm flex items-center gap-2 flex-wrap">
                                        <Package className="w-4 h-4 text-gray-400" />
                                        {group.productName}
                                        {group.matchType === 'name' && (
                                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Match por Nome</span>
                                        )}
                                        {group.hasAddition && (
                                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Adicional</span>
                                        )}
                                      </h5>
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        SKU: {group.productSku}
                                        {group.zigTransactionId ? (
                                          <span className="block text-gray-400 mt-0.5">
                                            Pedido ZIG: {group.zigTransactionId}
                                          </span>
                                        ) : null}
                                      </p>
                                    </div>
                                    
                                    <div className="text-right ml-2">
                                      <div className="text-sm font-bold text-gray-900">
                                        {group.quantity} {group.systemProduct?.unit || 'un'}
                                      </div>
                                      {group.totalValue > 0 && (
                                        <div className="text-xs text-gray-500">
                                          R$ {group.totalValue.toFixed(2)}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {group.notFound ? (
                                    <div className="bg-amber-100 border border-amber-200 rounded-lg p-2 flex items-center gap-2">
                                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                      <p className="text-xs text-amber-800">
                                        Produto não encontrado. Ao processar, o sistema cadastra automaticamente e dá baixa.
                                        SKU <strong>{group.productSku}</strong>
                                      </p>
                                    </div>
                                  ) : group.systemProduct && (
                                    <div className="bg-white rounded-lg p-2 space-y-1 border border-gray-100">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-600">Sistema:</span>
                                        <span className="font-medium text-gray-900">{group.systemProduct.name}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-600">Estoque:</span>
                                        <span className={`font-bold ${group.systemProduct.currentStock < group.quantity ? 'text-red-600' : 'text-green-600'}`}>
                                          {group.systemProduct.currentStock} {group.systemProduct.unit}
                                        </span>
                                      </div>
                                      
                                      {group.hasRecipe && group.recipeIngredients.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                          <p className="text-xs font-semibold text-purple-700 mb-1">📋 Receita:</p>
                                          <div className="space-y-1">
                                            {group.recipeIngredients.map((ing, idx) => (
                                              <div key={`${group.groupKey}-ing-${idx}`} className="flex items-center justify-between text-xs bg-purple-50 p-1.5 rounded">
                                                <span className="text-gray-700">{ing.productName}</span>
                                                <span className="font-medium text-purple-700">
                                                  -{ing.quantityNeeded} {ing.unit}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={() => {
                  setShowPreview(false);
                  setShowOnlyNotFound(false);
                }}
                className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                disabled={confirming}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSales}
                disabled={confirming || selectedGroupCount === 0}
                className="flex-1 px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {confirming ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Processar Baixa em Lote ({selectedGroupCount})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
