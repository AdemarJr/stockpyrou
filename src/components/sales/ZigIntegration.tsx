import React, { useState, useEffect } from 'react';
import { RefreshCw, Store, Check, AlertCircle, Settings, Network, Calendar, ShoppingCart, Package, X, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useCompany } from '../../contexts/CompanyContext';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface ZigStore {
  id: string;
  name: string;
}

interface PendingSale {
  transactionId: string;
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

export function ZigIntegration({ onSyncComplete }: { onSyncComplete?: () => void }) {
  const { currentCompany } = useCompany();
  
  // All hooks must be called before any conditional return
  const [stores, setStores] = useState<ZigStore[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [redeId, setRedeId] = useState<string>('35c5259d-4d3a-4934-9dd2-78a057a3aa8f');
  const [loading, setLoading] = useState(false);
  const [fetchingStores, setFetchingStores] = useState(false);
  const [configLoaded, setConfigLoaded] = useState(false);
  
  // Date selection
  const [dateFilter, setDateFilter] = useState<'yesterday' | 'today' | 'last3' | 'last5' | 'custom'>('yesterday');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  
  // Preview state
  const [salesByDate, setSalesByDate] = useState<Record<string, PendingSale[]>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [selectedSales, setSelectedSales] = useState<string[]>([]);
  const [expandedDates, setExpandedDates] = useState<string[]>([]);

  const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d`;

  const getDateRange = () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let start: string, end: string;
    
    switch (dateFilter) {
      case 'yesterday':
        start = yesterday.toISOString().split('T')[0];
        end = yesterday.toISOString().split('T')[0];
        break;
      case 'today':
        start = today.toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
        break;
      case 'last3':
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        start = threeDaysAgo.toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
        break;
      case 'last5':
        const fiveDaysAgo = new Date(today);
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        start = fiveDaysAgo.toISOString().split('T')[0];
        end = today.toISOString().split('T')[0];
        break;
      case 'custom':
        start = customStartDate || yesterday.toISOString().split('T')[0];
        end = customEndDate || today.toISOString().split('T')[0];
        break;
      default:
        start = yesterday.toISOString().split('T')[0];
        end = yesterday.toISOString().split('T')[0];
    }
    
    return { start, end };
  };

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

      const res = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });
      
      const data = await res.json().catch(() => ({}));

      if (data.available === false && data.needsConfiguration) {
        toast.warning(data.warning || 'Integração ZIG não disponível. Configure um token válido.');
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
    } catch (error: any) {
      console.error('Error fetching stores:', error);
      toast.error(error.message);
    } finally {
      setFetchingStores(false);
    }
  };

  const loadConfig = async () => {
    if (!currentCompany?.id) return;
    
    try {
      const res = await fetch(`${SERVER_URL}/zig/config/${currentCompany.id}`, {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.config) {
          if (data.config.redeId) {
            setRedeId(data.config.redeId);
            fetchStores(data.config.redeId);
          }
          if (data.config.storeId) {
             setSelectedStore(data.config.storeId);
             setConfigLoaded(true);
          }
        }
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  };

  const handleSaveConfig = async () => {
    if (!currentCompany?.id) return;
    
    if (!selectedStore) {
      toast.error('Selecione uma loja antes de salvar.');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${SERVER_URL}/zig/config`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          companyId: currentCompany.id,
          storeId: selectedStore,
          redeId: redeId.trim()
        })
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Falha ao salvar' }));
        throw new Error(err.error || 'Failed to save config');
      }
      
      toast.success('Configuração salva com sucesso!');
      setConfigLoaded(true);
    } catch (error: any) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewSales = async () => {
    if (!currentCompany?.id) return;
    
    if (!selectedStore) {
      toast.error('Selecione uma loja primeiro');
      return;
    }

    const { start, end } = getDateRange();

    try {
      setLoadingPreview(true);
      setSalesByDate({});
      
      const res = await fetch(`${SERVER_URL}/zig/preview`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
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
        
        // Selecionar automaticamente vendas válidas
        const allValidSales = data.sales.filter((s: PendingSale) => !s.notFound).map((s: PendingSale) => s.transactionId);
        setSelectedSales(allValidSales);
        
        // Expandir todas as datas por padrão
        setExpandedDates(Object.keys(data.salesByDate));
        
        setShowPreview(true);
        toast.success(`${data.totalSales} vendas encontradas em ${Object.keys(data.salesByDate).length} dias!`);
      } else {
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
      
      const res = await fetch(`${SERVER_URL}/zig/confirm`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({
          companyId: currentCompany.id,
          transactionIds: selectedSales
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro no processamento' }));
        throw new Error(err.error || 'Erro na resposta do servidor');
      }

      const data = await res.json();
      
      toast.success(data.message || `${data.processed} vendas processadas com sucesso!`);
      setShowPreview(false);
      setSalesByDate({});
      setSelectedSales([]);
      
      if (onSyncComplete) onSyncComplete();
      
    } catch (error: any) {
      console.error('Confirm error:', error);
      toast.error(`Erro: ${error.message}`);
    } finally {
      setConfirming(false);
    }
  };

  const toggleSaleSelection = (transactionId: string) => {
    setSelectedSales(prev => 
      prev.includes(transactionId) 
        ? prev.filter(id => id !== transactionId)
        : [...prev, transactionId]
    );
  };

  const toggleDateSelection = (date: string) => {
    const dateSales = salesByDate[date] || [];
    const validDateSales = dateSales.filter(s => !s.notFound).map(s => s.transactionId);
    
    const allSelected = validDateSales.every(id => selectedSales.includes(id));
    
    if (allSelected) {
      setSelectedSales(prev => prev.filter(id => !validDateSales.includes(id)));
    } else {
      setSelectedSales(prev => [...new Set([...prev, ...validDateSales])]);
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

  const getTotalSales = () => {
    return Object.values(salesByDate).flat().length;
  };

  const getDateSummary = (date: string) => {
    const dateSales = salesByDate[date] || [];
    const validCount = dateSales.filter(s => !s.notFound).length;
    const notFoundCount = dateSales.filter(s => s.notFound).length;
    const totalValue = dateSales.reduce((sum, s) => sum + (s.totalValue || 0), 0);
    
    return { validCount, notFoundCount, totalValue };
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
            <h2 className="text-xl font-bold text-gray-900">Integração ZIG</h2>
            <p className="text-sm text-gray-500">Baixa automática por lote de vendas</p>
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
        <div className="p-5 bg-gray-50 rounded-xl border border-gray-100 space-y-5">
          <div className="flex items-center gap-2 text-pink-700 font-semibold text-sm mb-1">
            <span className="flex items-center justify-center w-5 h-5 bg-pink-100 rounded-full text-[10px]">1</span>
            Configuração da Rede
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">ID da Rede (Obrigatório)</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Network className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    value={redeId}
                    onChange={(e) => setRedeId(e.target.value)}
                    placeholder="Ex: 35c5259d-4d3a-4934-9dd2-78a057a3aa8f"
                    className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-gray-500 border-gray-300 shadow-sm focus:border-pink-500 focus:ring-pink-500 text-sm"
                  />
                </div>
                <button
                  onClick={() => fetchStores()}
                  disabled={fetchingStores || !redeId}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50 transition-all font-medium text-sm shadow-sm"
                >
                  {fetchingStores ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Listar
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Selecione a Loja</label>
              <div className="flex gap-2">
                <select
                  value={selectedStore}
                  onChange={(e) => {
                    setSelectedStore(e.target.value);
                    setConfigLoaded(false);
                  }}
                  disabled={stores.length === 0}
                  className="flex-1 rounded-lg border-gray-300 shadow-sm text-gray-500 focus:border-pink-500 focus:ring-pink-500 disabled:bg-gray-100 disabled:text-gray-400 text-sm"
                >
                  <option value="">{stores.length === 0 ? 'Busque as lojas primeiro' : 'Selecione uma loja...'}</option>
                  {stores.map(store => (
                    <option key={store.id} value={store.id}>{store.name}</option>
                  ))}</ select>
                <button
                  onClick={handleSaveConfig}
                  disabled={loading || !selectedStore}
                  className={`px-4 py-2 rounded-lg flex items-center gap-2 text-white font-medium transition-all shadow-sm text-sm ${
                    configLoaded 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-pink-600 hover:bg-pink-700'
                  } disabled:opacity-50`}
                >
                  {configLoaded ? <Check className="w-4 h-4" /> : <Settings className="w-4 h-4" />}
                  {configLoaded ? 'Salvo' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100 space-y-4">
          <div className="flex items-center gap-2 text-indigo-700 font-semibold text-sm mb-1">
            <span className="flex items-center justify-center w-5 h-5 bg-indigo-100 rounded-full text-[10px]">2</span>
            Selecione o Período das Vendas
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
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
              onClick={() => setDateFilter('last3')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilter === 'last3'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-indigo-300'
              }`}
            >
              3 dias
            </button>
            <button
              onClick={() => setDateFilter('last5')}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                dateFilter === 'last5'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-gray-700 border border-gray-200 hover:border-indigo-300'
              }`}
            >
              5 dias
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
            <>
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
              
              <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">
                  <strong>Limite da API ZIG:</strong> Máximo de 5 dias por consulta. Se selecionar um período maior, receberá um erro.
                </p>
              </div>
            </>
          )}

          <button
            onClick={handlePreviewSales}
            disabled={loadingPreview || !configLoaded}
            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-400 flex items-center justify-center gap-2.5 transition-all font-semibold shadow-md active:scale-95"
          >
            {loadingPreview ? <RefreshCw className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
            {loadingPreview ? 'Carregando...' : 'Buscar Vendas Pendentes'}
          </button>
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
                  {getTotalSales()} vendas em {Object.keys(salesByDate).length} dias • {selectedSales.length} selecionadas
                </p>
              </div>
              <button 
                onClick={() => setShowPreview(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                {Object.keys(salesByDate).sort((a, b) => b.localeCompare(a)).map((date) => {
                  const dateSales = salesByDate[date];
                  const { validCount, notFoundCount, totalValue } = getDateSummary(date);
                  const isExpanded = expandedDates.includes(date);
                  const dateSalesIds = dateSales.filter(s => !s.notFound).map(s => s.transactionId);
                  const allSelected = dateSalesIds.every(id => selectedSales.includes(id));
                  
                  return (
                    <div key={date} className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-4 flex items-center justify-between cursor-pointer hover:from-indigo-100 hover:to-blue-100 transition-all"
                           onClick={() => toggleExpandDate(date)}>
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={allSelected && dateSalesIds.length > 0}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleDateSelection(date);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                            disabled={validCount === 0}
                          />
                          
                          <div className="flex-1">
                            <h4 className="font-bold text-gray-900 text-sm capitalize">
                              📅 {formatDate(date)}
                            </h4>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-600">
                                {validCount} vendas válidas
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
                          {dateSales.map((sale) => (
                            <div 
                              key={sale.transactionId}
                              className={`border rounded-lg p-3 transition-all ${
                                sale.notFound 
                                  ? 'bg-amber-50 border-amber-200' 
                                  : selectedSales.includes(sale.transactionId)
                                    ? 'bg-indigo-50 border-indigo-300 shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {!sale.notFound && (
                                  <input
                                    type="checkbox"
                                    checked={selectedSales.includes(sale.transactionId)}
                                    onChange={() => toggleSaleSelection(sale.transactionId)}
                                    className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                  />
                                )}
                                
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <h5 className="font-bold text-gray-900 text-sm flex items-center gap-2 flex-wrap">
                                        <Package className="w-4 h-4 text-gray-400" />
                                        {sale.productName}
                                        {sale.matchType === 'name' && (
                                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Match por Nome</span>
                                        )}
                                        {sale.isAddition && (
                                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Adicional</span>
                                        )}
                                      </h5>
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        SKU: {sale.productSku} • {new Date(sale.transactionDate).toLocaleTimeString('pt-BR')}
                                      </p>
                                    </div>
                                    
                                    <div className="text-right ml-2">
                                      <div className="text-sm font-bold text-gray-900">
                                        {sale.quantity} {sale.systemProduct?.unit || 'un'}
                                      </div>
                                      {sale.totalValue > 0 && (
                                        <div className="text-xs text-gray-500">
                                          R$ {sale.totalValue.toFixed(2)}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {sale.notFound ? (
                                    <div className="bg-amber-100 border border-amber-200 rounded-lg p-2 flex items-center gap-2">
                                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                      <p className="text-xs text-amber-800">
                                        Produto não encontrado. Cadastre com SKU <strong>{sale.productSku}</strong>
                                      </p>
                                    </div>
                                  ) : sale.systemProduct && (
                                    <div className="bg-white rounded-lg p-2 space-y-1 border border-gray-100">
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-600">Sistema:</span>
                                        <span className="font-medium text-gray-900">{sale.systemProduct.name}</span>
                                      </div>
                                      <div className="flex items-center justify-between text-xs">
                                        <span className="text-gray-600">Estoque:</span>
                                        <span className={`font-bold ${sale.systemProduct.currentStock < sale.quantity ? 'text-red-600' : 'text-green-600'}`}>
                                          {sale.systemProduct.currentStock} {sale.systemProduct.unit}
                                        </span>
                                      </div>
                                      
                                      {sale.hasRecipe && sale.recipe && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                          <p className="text-xs font-semibold text-purple-700 mb-1">📋 Receita:</p>
                                          <div className="space-y-1">
                                            {sale.recipe.ingredients.map((ing, idx) => (
                                              <div key={`${sale.transactionId}-ing-${idx}`} className="flex items-center justify-between text-xs bg-purple-50 p-1.5 rounded">
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
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                disabled={confirming}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmSales}
                disabled={confirming || selectedSales.length === 0}
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
                    Processar Baixa em Lote ({selectedSales.length})
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
