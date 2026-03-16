import React, { useState, useEffect } from 'react';
import { X, Package, DollarSign, TrendingUp, AlertCircle, Calendar, Barcode, ShoppingCart, History, Award } from 'lucide-react';
import type { Product, PriceHistory, Supplier } from '../../types';
import { formatCurrency, getStockStatus } from '../../utils/calculations';
import { PriceHistoryRepository } from '../../repositories/PriceHistoryRepository';
import { SupplierRepository } from '../../repositories/SupplierRepository';
import { useCompany } from '../../contexts/CompanyContext';

interface ProductViewModalProps {
  product: Product;
  onClose: () => void;
}

type Tab = 'overview' | 'intelligence';

export function ProductViewModal({ product, onClose }: ProductViewModalProps) {
  const { currentCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [bestPrice, setBestPrice] = useState<PriceHistory | null>(null);
  const [suppliers, setSuppliers] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(false);
  const [mainSupplierName, setMainSupplierName] = useState<string>('');

  useEffect(() => {
    if (product.supplierId) {
      SupplierRepository.findById(product.supplierId).then(supplier => {
        if (supplier) setMainSupplierName(supplier.name);
      });
    } else {
      setMainSupplierName('');
    }
  }, [product.supplierId]);

  useEffect(() => {
    if (activeTab === 'intelligence') {
      loadIntelligenceData();
    }
  }, [activeTab, product.id]);

  const loadIntelligenceData = async () => {
    if (!currentCompany) return;
    
    setLoading(true);
    try {
      const [history, best, suppliersList] = await Promise.all([
        PriceHistoryRepository.findByProduct(product.id),
        PriceHistoryRepository.getBestPriceForProduct(product.id),
        SupplierRepository.findAll(currentCompany.id)
      ]);

      const supplierMap = new Map(suppliersList.map(s => [s.id, s.name]));
      setSuppliers(supplierMap);
      setPriceHistory(history);
      setBestPrice(best);
    } catch (error) {
      console.error('Error loading intelligence data:', error);
    } finally {
      setLoading(false);
    }
  };

  const status = getStockStatus(product.currentStock, product.minStock, product.safetyStock);
  const totalValue = product.currentStock * product.averageCost;
  
  const getStatusColor = () => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'low': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'adequate': return 'text-green-600 bg-green-50 border-green-200';
      case 'high': return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };
  
  const getStatusLabel = () => {
    switch (status) {
      case 'critical': return 'Estoque Crítico';
      case 'low': return 'Estoque Baixo';
      case 'adequate': return 'Estoque Adequado';
      case 'high': return 'Estoque Alto';
    }
  };
  
  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      alimento: 'Alimento',
      bebida: 'Bebida',
      descartavel: 'Descartável',
      limpeza: 'Limpeza',
      outro: 'Outro',
    };
    return labels[category] || category;
  };
  
  const getUnitLabel = (unit: string) => {
    const labels: Record<string, string> = {
      kg: 'Quilograma',
      g: 'Grama',
      l: 'Litro',
      ml: 'Mililitro',
      un: 'Unidade',
      cx: 'Caixa',
      pct: 'Pacote',
      saco: 'Saco',
      porcao: 'Porção',
    };
    return labels[unit] || unit;
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3>Detalhes do Produto</h3>
              <p className="text-gray-600 mt-1">{product.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 px-6 flex-shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('intelligence')}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'intelligence'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Award className="w-4 h-4" />
            Inteligência de Compra
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6 flex-grow overflow-y-auto">
          {activeTab === 'overview' ? (
            <>
              {/* Status Badge */}
              <div className={`flex items-center gap-3 p-4 rounded-lg border ${getStatusColor()}`}>
                <AlertCircle className="w-6 h-6" />
                <div>
                  <p className="font-medium">{getStatusLabel()}</p>
                  <p className="mt-1">
                    Estoque atual: {product.currentStock} {product.measurementUnit}
                  </p>
                </div>
              </div>
              
              {/* Basic Information */}
              <div className="space-y-4">
                <h4>Informações Básicas</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-600">Categoria</p>
                    <p className="mt-1">{getCategoryLabel(product.category)}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-600">Fornecedor Principal</p>
                    <p className="mt-1 font-medium">{mainSupplierName || 'Não definido'}</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-600">Unidade de Medida</p>
                    <p className="mt-1">{getUnitLabel(product.measurementUnit)} ({product.measurementUnit})</p>
                  </div>
                  {product.barcode && (
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-gray-600 flex items-center gap-2">
                        <Barcode className="w-4 h-4" />
                        Código de Barras
                      </p>
                      <p className="mt-1 font-mono">{product.barcode}</p>
                    </div>
                  )}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-gray-600">Tipo de Produto</p>
                    <p className="mt-1">
                      {product.isPerishable ? (
                        <div>
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                            Perecível
                          </span>
                          {product.shelfLife && (
                            <p className="text-sm text-gray-500 mt-1">Validade: ~{product.shelfLife} dias</p>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded">
                          Não Perecível
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Stock Information */}
              <div className="space-y-4">
                <h4>Controle de Estoque</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-blue-600 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Estoque Atual
                    </p>
                    <p className="mt-2">
                      {product.currentStock} {product.measurementUnit}
                    </p>
                  </div>
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-orange-600 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Estoque Mínimo
                    </p>
                    <p className="mt-2">
                      {product.minStock} {product.measurementUnit}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-600 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Estoque de Segurança
                    </p>
                    <p className="mt-2">
                      {product.safetyStock} {product.measurementUnit}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Financial Information */}
              <div className="space-y-4">
                <h4>Informações Financeiras</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-gray-600 flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      Custo Médio Ponderado
                    </p>
                    <p className="mt-2 font-medium">
                      {formatCurrency(product.averageCost)} / {product.measurementUnit}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-blue-600 flex items-center gap-2 font-bold">
                      <DollarSign className="w-4 h-4" />
                      Preço de Venda
                    </p>
                    <p className="mt-2 text-xl font-bold text-blue-800">
                      {formatCurrency(product.sellingPrice || 0)}
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-green-600 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Lucro Bruto (Unitário)
                    </p>
                    <p className="mt-2 text-lg font-bold text-green-700">
                      {product.sellingPrice ? formatCurrency(product.sellingPrice - product.averageCost) : 'R$ 0,00'}
                      {product.sellingPrice && product.sellingPrice > 0 && (
                        <span className="ml-2 text-sm font-normal">
                          ({(((product.sellingPrice - product.averageCost) / product.sellingPrice) * 100).toFixed(1)}%)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                    <p className="text-indigo-600 flex items-center gap-2">
                      <ShoppingCart className="w-4 h-4" />
                      Valor Potencial em Estoque
                    </p>
                    <p className="mt-2 font-bold text-indigo-800">
                      {formatCurrency(product.currentStock * (product.sellingPrice || 0))}
                    </p>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-6">
              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">Analisando histórico de preços...</p>
                </div>
              ) : (
                <>
                  {/* Smart Recommendation Card */}
                  {bestPrice ? (
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 rounded-xl p-6 shadow-sm">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-white rounded-full shadow-sm text-green-600">
                          <Award className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="text-green-900 font-semibold text-lg">Recomendação de Compra</h4>
                          <p className="text-green-800 mt-1">
                            O melhor preço registrado nos últimos 6 meses foi de <span className="font-bold">{formatCurrency(bestPrice.price)}</span>.
                          </p>
                          <div className="mt-3 flex gap-2 items-center text-sm text-green-700 bg-white/60 px-3 py-1.5 rounded-lg inline-flex">
                            <ShoppingCart className="w-4 h-4" />
                            Comprar de: <strong>{suppliers.get(bestPrice.supplierId) || 'Fornecedor Desconhecido'}</strong>
                          </div>
                          <p className="text-xs text-green-600 mt-2">
                            Registrado em: {new Date(bestPrice.date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-gray-500">
                      <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Histórico insuficiente para gerar recomendações.</p>
                      <p className="text-sm mt-1">Realize mais entradas de estoque para ativar a inteligência de compras.</p>
                    </div>
                  )}

                  {/* Price History Table */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4>Histórico de Preços</h4>
                      <span className="text-sm text-gray-500">Últimas movimentações</span>
                    </div>
                    
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-gray-600 border-b">
                          <tr>
                            <th className="px-4 py-3 text-left">Data</th>
                            <th className="px-4 py-3 text-left">Fornecedor</th>
                            <th className="px-4 py-3 text-right">Preço Unit.</th>
                            <th className="px-4 py-3 text-right">Variação</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {priceHistory.map((item, index) => {
                            const variation = item.price - product.averageCost;
                            const variationPercent = (variation / product.averageCost) * 100;
                            const isCheaper = variation < 0;
                            
                            return (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-600">
                                  {new Date(item.date).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {suppliers.get(item.supplierId) || 'Fornecedor Desconhecido'}
                                </td>
                                <td className="px-4 py-3 text-right font-mono">
                                  {formatCurrency(item.price)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {product.averageCost > 0 ? (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                                      isCheaper 
                                        ? 'bg-green-100 text-green-700' 
                                        : variation > 0 
                                          ? 'bg-red-100 text-red-700' 
                                          : 'bg-gray-100 text-gray-700'
                                    }`}>
                                      {variation > 0 ? '+' : ''}{variationPercent.toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          
                          {priceHistory.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                Nenhum registro de preço encontrado
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}