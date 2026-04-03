import React, { useState, useEffect, useCallback } from 'react';
import { FileText, TrendingUp, TrendingDown, ShoppingCart, AlertTriangle, Package, DollarSign, History, User, ClipboardCheck, RefreshCw, Download, FileSpreadsheet, FileJson, Receipt, CreditCard, PackagePlus } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Product, StockMovement, Recipe, Supplier, PriceHistory } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { ProductService } from '../../services/ProductService';
import { useIsMobile } from '../ui/use-mobile';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { ReportCard } from './ReportCard';
import { ReportTable } from './ReportTable';
import { ReportTabs, type TabType } from './ReportTabs';
import { ReportExport } from './ReportExport';
import { EntriesTab } from './EntriesTab';
import { OutputsTab } from './OutputsTab';
import { 
  formatCurrency, 
  formatPercentage, 
  formatDate, 
  getStockStatus,
  calculateSuggestedOrder,
  calculateAverageConsumption,
  detectPriceVariation,
  forecastDemand,
} from '../../utils/calculations';

interface ReportsProps {
  products: Product[];
  movements: StockMovement[];
  recipes: Recipe[];
  suppliers: Supplier[];
  priceHistory: PriceHistory[];
}

type AllTabTypes = TabType | 'outputs';

export function Reports({ products, movements, recipes, suppliers, priceHistory }: ReportsProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [activeTab, setActiveTab] = useState<AllTabTypes>('entries');
  const [fixing, setFixing] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [salesData, setSalesData] = useState<any[]>([]);
  const [closuresData, setClosuresData] = useState<any[]>([]);
  const [entriesData, setEntriesData] = useState<any[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [isLoadingClosures, setIsLoadingClosures] = useState(false);
  const [isLoadingEntries, setIsLoadingEntries] = useState(false);
  
  // Filters and Pagination
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1); // Último mês por padrão
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [draftStartDate, setDraftStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [draftEndDate, setDraftEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const paginate = (data: any[]) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return data.slice(startIndex, startIndex + itemsPerPage);
  };

  const applyReportDateFilter = useCallback(() => {
    if (draftStartDate && draftEndDate && draftStartDate > draftEndDate) {
      toast.error('A data inicial deve ser anterior ou igual à data final.');
      return;
    }
    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setCurrentPage(1);
  }, [draftStartDate, draftEndDate]);

  // Fetch sales data
  const fetchSales = async () => {
    if (!user?.accessToken || !currentCompany?.id) return;
    
    setIsLoadingSales(true);
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Custom-Token': user.accessToken,
        'X-Company-Id': currentCompany.id,
      };

      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/reports/sales?${params}`,
        { headers }
      );

      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }

      setSalesData(data.sales || []);
    } catch (error) {
      console.error('Error fetching sales:', error);
      toast.error('Erro ao buscar vendas');
    } finally {
      setIsLoadingSales(false);
    }
  };

  // Fetch closures data
  const fetchClosures = async () => {
    if (!user?.accessToken || !currentCompany?.id) return;
    
    setIsLoadingClosures(true);
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Custom-Token': user.accessToken,
        'X-Company-Id': currentCompany.id,
      };

      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/reports/closures?${params}`,
        { headers }
      );

      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }

      setClosuresData(data.closures || []);
    } catch (error) {
      console.error('Error fetching closures:', error);
      toast.error('Erro ao buscar fechamentos');
    } finally {
      setIsLoadingClosures(false);
    }
  };

  // Fetch entries data (NEW)
  const fetchEntries = async () => {
    if (!user?.accessToken || !currentCompany?.id) return;
    
    setIsLoadingEntries(true);
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Custom-Token': user.accessToken,
        'X-Company-Id': currentCompany.id,
      };

      const params = new URLSearchParams();
      params.append('startDate', startDate);
      params.append('endDate', endDate);
      if (selectedSupplier !== 'all') params.append('supplierId', selectedSupplier);
      if (selectedProduct !== 'all') params.append('productId', selectedProduct);

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/reports/entries?${params}`,
        { headers }
      );

      const data = await response.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }

      setEntriesData(data.entries || []);
    } catch (error) {
      console.error('Error fetching entries:', error);
      toast.error('Erro ao buscar entradas');
    } finally {
      setIsLoadingEntries(false);
    }
  };

  // Load data when tab changes or dates change
  useEffect(() => {
    if (activeTab === 'entries') {
      fetchEntries();
    } else if (activeTab === 'sales') {
      fetchSales();
    } else if (activeTab === 'closures') {
      fetchClosures();
    }
  }, [activeTab, startDate, endDate, selectedSupplier, selectedProduct]);

  // Filter Data based on dates and search
  const filteredMovements = movements.filter(m => {
    const mDate = new Date(m.date).toISOString().split('T')[0];
    const matchesDate = mDate >= startDate && mDate <= endDate;
    const product = products.find(p => p.id === m.productId);
    const matchesSearch = !searchQuery || 
      product?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.reason?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || product?.category === selectedCategory;
    const matchesProduct = selectedProduct === 'all' || m.productId === selectedProduct;
    return matchesDate && matchesSearch && matchesCategory && matchesProduct;
  });

  const filteredPriceHistory = priceHistory.filter(ph => {
    const phDate = new Date(ph.date).toISOString().split('T')[0];
    const matchesDate = phDate >= startDate && phDate <= endDate;
    const product = products.find(p => p.id === ph.productId);
    const matchesSearch = !searchQuery || 
      product?.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSupplier = selectedSupplier === 'all' || ph.supplierId === selectedSupplier;
    const matchesProduct = selectedProduct === 'all' || ph.productId === selectedProduct;
    return matchesDate && matchesSearch && matchesSupplier && matchesProduct;
  });

  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    const matchesProduct = selectedProduct === 'all' || p.id === selectedProduct;
    return matchesSearch && matchesCategory && matchesProduct;
  });

  const filteredRecipes = recipes.filter(r => 
    !searchQuery || r.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get unique categories for filters
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  const handleExportExcel = () => {
    try {
      setIsExporting(true);
      let dataToExport: any[] = [];
      let filename = `relatorio_${activeTab}_${new Date().getTime()}`;

      // Add filter info as first row
      const filterInfo = {
        'Relatório': activeTab,
        'Início': startDate,
        'Fim': endDate,
        'Filtro': searchQuery || 'Todos'
      };

      switch (activeTab) {
        case 'entries':
          dataToExport = entriesData.map(e => ({
            'Data': formatDate(e.entryDate),
            'Fornecedor': e.supplierName,
            'Produto': e.productName,
            'Quantidade': e.quantity,
            'Unidade': e.measurementUnit,
            'Preço Unit.': e.unitPrice.toFixed(2),
            'Total': e.totalPrice.toFixed(2),
            'Lote': e.batchNumber || '',
            'Validade': e.expirationDate ? formatDate(e.expirationDate) : ''
          }));
          break;
        case 'cost':
          dataToExport = costData.map(r => ({
            'Tipo': r.type,
            'Item': r.name,
            'Margem (%)': r.margin.toFixed(2),
            'Custo (R$)': r.cost.toFixed(2),
            'Preço (R$)': r.price.toFixed(2),
            'Lucro (R$)': r.profit.toFixed(2)
          }));
          break;
        case 'orders':
          dataToExport = suggestedOrders.map(o => ({
            'Produto': o.product.name,
            'Estoque Atual': o.product.currentStock,
            'Qtd Sugerida': o.suggestedQty.toFixed(2),
            'Consumo Médio': o.avgConsumption.toFixed(2),
            'Fornecedor': o.bestSupplier?.name || 'N/A',
            'Custo Est.': o.estimatedCost.toFixed(2),
            'Status': o.status
          }));
          break;
        case 'waste':
          dataToExport = wasteMovements.map(m => ({
            'Data': formatDate(m.date),
            'Produto': products.find(p => p.id === m.productId)?.name || 'N/A',
            'Quantidade': m.quantity,
            'Custo': m.cost?.toFixed(2) || '0.00',
            'Motivo': m.wasteReason || 'Outro',
            'Notas': m.notes || ''
          }));
          break;
        case 'history':
          dataToExport = auditMovements.map(m => ({
            'Data': formatDate(m.date),
            'Tipo': m.type.toUpperCase(),
            'Produto': products.find(p => p.id === m.productId)?.name || 'N/A',
            'Quantidade': m.quantity,
            'Motivo': m.reason || '',
            'Usuário': m.userId || 'Sistema'
          }));
          break;
        case 'forecast':
          dataToExport = forecastData.map(d => ({
            'Produto': d.product.name,
            'Estoque Atual': d.currentStock,
            'Demanda Prevista (7d)': d.forecast.quantity,
            'Confiança (%)': d.forecast.confidence,
            'Risco de Ruptura': d.willRunOut ? 'SIM' : 'Não'
          }));
          break;
        case 'audit':
          dataToExport = auditData.map(d => ({
            'Produto': d.product.name,
            'Estoque Calculado': d.calculatedStock,
            'Estoque Atual': d.currentStock,
            'Diferença': d.diff.toFixed(2),
            'Status': d.isDiscrepancy ? 'Divergente' : 'OK',
            'Movimentações': d.movementsCount
          }));
          break;
        case 'sales':
          dataToExport = salesData.map(s => ({
            'Data': new Date(s.saleDate).toLocaleString('pt-BR'),
            'Caixa': s.registerId,
            'Cliente': s.customerName || 'N/A',
            'Total': s.total.toFixed(2),
            'Desconto': s.discount.toFixed(2),
            'Pagamento': s.paymentMethod === 'money' ? 'Dinheiro' : s.paymentMethod === 'pix' ? 'PIX' : s.paymentMethod === 'credit' ? 'Crédito' : 'Débito',
            'Operador': s.cashierName,
            'Itens': s.items?.length || 0
          }));
          break;
        case 'closures':
          dataToExport = closuresData.map(c => ({
            'Caixa ID': c.id,
            'Operador': c.cashierName,
            'Abertura': new Date(c.openedAt).toLocaleString('pt-BR'),
            'Fechamento': new Date(c.closedAt).toLocaleString('pt-BR'),
            'Saldo Inicial': c.initialBalance.toFixed(2),
            'Saldo Final': c.finalBalance.toFixed(2),
            'Total Vendas': c.totalSales.toFixed(2),
            'Sangrias': c.totalWithdrawals.toFixed(2),
            'Reforços': c.totalDeposits.toFixed(2),
            'Qtd Vendas': c.salesCount
          }));
          break;
        case 'outputs':
          const outputMovements = filteredMovements.filter(m => 
            m.type === 'saida' || m.type === 'venda' || m.type === 'desperdicio'
          );
          dataToExport = outputMovements.map(m => {
            const product = products.find(p => p.id === m.productId);
            return {
              'Data': formatDate(m.date),
              'Tipo': m.type === 'saida' ? 'Saída' : m.type === 'venda' ? 'Venda' : 'Desperdício',
              'Produto': product?.name || 'N/A',
              'Quantidade': `${m.quantity} ${product?.measurementUnit || 'un'}`,
              'Motivo': m.reason || '-',
              'Usuário': m.userId || 'Sistema',
            };
          });
          break;
        default:
          toast.error('Exportação não disponível para esta aba ainda.');
          return;
      }

      // Create workbook with two sheets or metadata row
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
      
      // Meta sheet
      const metaSheet = XLSX.utils.json_to_sheet([filterInfo]);
      XLSX.utils.book_append_sheet(workbook, metaSheet, "Info_Filtros");

      XLSX.writeFile(workbook, `${filename}.xlsx`);
      toast.success('Relatório Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar Excel:', error);
      toast.error('Falha ao exportar relatório Excel.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportPDF = () => {
    try {
      setIsExporting(true);
      const doc = new jsPDF();
      const filename = `relatorio_${activeTab}_${new Date().getTime()}.pdf`;
      
      doc.setFontSize(18);
      doc.text(`Relatório de ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`, 14, 22);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Período: ${formatDate(startDate)} até ${formatDate(endDate)}`, 14, 30);
      doc.text(`Filtro: ${searchQuery || 'Nenhum'}`, 14, 35);
      doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 40);

      let head: string[][] = [];
      let body: string[][] = [];

      switch (activeTab) {
        case 'entries':
          head = [['Data', 'Fornecedor', 'Produto', 'Qtd', 'Preço Un.', 'Total']];
          body = entriesData.map(e => [
            formatDate(e.entryDate),
            e.supplierName,
            e.productName,
            `${e.quantity} ${e.measurementUnit}`,
            formatCurrency(e.unitPrice),
            formatCurrency(e.totalPrice)
          ]);
          break;
        case 'cost':
          head = [['Tipo', 'Item', 'Margem (%)', 'Custo (R$)', 'Preço (R$)', 'Lucro (R$)']];
          body = costData.map(r => [r.type, r.name, r.margin.toFixed(2), formatCurrency(r.cost), formatCurrency(r.price), formatCurrency(r.profit)]);
          break;
        case 'orders':
          head = [['Produto', 'Estoque', 'Sugerido', 'Consumo/Dia', 'Fornecedor', 'Custo Est.']];
          body = suggestedOrders.map(o => [
            o.product.name, 
            `${o.product.currentStock} ${o.product.measurementUnit}`,
            o.suggestedQty.toFixed(2),
            o.avgConsumption.toFixed(2),
            o.bestSupplier?.name || 'N/A',
            formatCurrency(o.estimatedCost)
          ]);
          break;
        case 'waste':
          head = [['Data', 'Produto', 'Qtd', 'Custo', 'Motivo']];
          body = wasteMovements.map(m => [
            formatDate(m.date),
            products.find(p => p.id === m.productId)?.name || 'N/A',
            m.quantity.toString(),
            formatCurrency(m.cost || 0),
            m.wasteReason || 'Outro'
          ]);
          break;
        case 'history':
          head = [['Data', 'Tipo', 'Produto', 'Qtd', 'Motivo']];
          body = auditMovements.map(m => [
            formatDate(m.date),
            m.type.toUpperCase(),
            products.find(p => p.id === m.productId)?.name || 'N/A',
            m.quantity.toString(),
            m.reason || '-'
          ]);
          break;
        case 'forecast':
          head = [['Produto', 'Estoque', 'Demanda (7d)', 'Confiança', 'Risco']];
          body = forecastData.map(d => [
            d.product.name,
            d.currentStock.toString(),
            d.forecast.quantity.toString(),
            `${d.forecast.confidence}%`,
            d.willRunOut ? 'SIM' : 'Não'
          ]);
          break;
        case 'audit':
          head = [['Produto', 'Calc.', 'Atual', 'Dif.', 'Status']];
          body = auditData.map(d => [
            d.product.name,
            d.calculatedStock.toString(),
            d.currentStock.toString(),
            d.diff.toFixed(2),
            d.isDiscrepancy ? 'Divergente' : 'OK'
          ]);
          break;
        case 'sales':
          head = [['Data', 'Cliente', 'Total', 'Pgto', 'Operador']];
          body = salesData.map(s => [
            new Date(s.saleDate).toLocaleString('pt-BR'),
            s.customerName || 'N/A',
            formatCurrency(s.total),
            s.paymentMethod === 'money' ? 'Dinheiro' : s.paymentMethod === 'pix' ? 'PIX' : s.paymentMethod === 'credit' ? 'Créd.' : 'Déb.',
            s.cashierName
          ]);
          break;
        case 'closures':
          head = [['Operador', 'Abertura', 'Fechamento', 'S.Inicial', 'S.Final', 'Vendas']];
          body = closuresData.map(c => [
            c.cashierName,
            new Date(c.openedAt).toLocaleString('pt-BR'),
            new Date(c.closedAt).toLocaleString('pt-BR'),
            formatCurrency(c.initialBalance),
            formatCurrency(c.finalBalance),
            formatCurrency(c.totalSales)
          ]);
          break;
        case 'outputs':
          head = [['Data', 'Tipo', 'Produto', 'Qtd', 'Motivo']];
          const outputMovementsPDF = filteredMovements.filter(m => 
            m.type === 'saida' || m.type === 'venda' || m.type === 'desperdicio'
          );
          body = outputMovementsPDF.map(m => {
            const product = products.find(p => p.id === m.productId);
            return [
              formatDate(m.date),
              m.type === 'saida' ? 'Saída' : m.type === 'venda' ? 'Venda' : 'Desp.',
              product?.name || 'N/A',
              `${m.quantity} ${product?.measurementUnit || 'un'}`,
              m.reason || '-'
            ];
          });
          break;
        default:
          toast.error('Exportação PDF não disponível para esta aba.');
          return;
      }

      (doc as any).autoTable({
        startY: 45,
        head: head,
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
      });

      doc.save(filename);
      toast.success('Relatório PDF exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Falha ao exportar relatório PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFixStock = async (product: Product, expectedStock: number) => {
    try {
      setFixing(product.id);
      const diff = expectedStock - product.currentStock;
      
      // We update the stock to match expected. 
      // ProductService.updateStock adds to current. So we pass the difference.
      // If expected 10, current 8. Diff = 2. New = 8 + 2 = 10.
      await ProductService.updateStock(product.id, diff);
      
      toast.success(`Estoque de ${product.name} corrigido para ${expectedStock} ${product.measurementUnit}`);
      
      // Reload to reflect changes
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      toast.error(`Erro ao corrigir estoque: ${error.message}`);
    } finally {
      setFixing(null);
    }
  };

  // Audit / Consistency Check
  const auditData = filteredProducts.map(product => {
    const productMovements = filteredMovements.filter(m => m.productId === product.id);
    
    const calculatedStock = productMovements.reduce((acc, m) => {
      if (m.type === 'entrada') return acc + m.quantity;
      if (m.type === 'ajuste') return acc + m.quantity; // Ajuste can be negative
      return acc - m.quantity; // saida, venda, desperdicio
    }, 0);
    
    // Fix floating point precision issues
    const roundedCalculated = Math.round(calculatedStock * 10000) / 10000;
    const roundedCurrent = Math.round(product.currentStock * 10000) / 10000;
    
    const diff = roundedCurrent - roundedCalculated;
    const isDiscrepancy = Math.abs(diff) > 0.001;
    
    return {
      product,
      calculatedStock: roundedCalculated,
      currentStock: roundedCurrent,
      diff,
      isDiscrepancy,
      movementsCount: productMovements.length
    };
  }).sort((a, b) => (b.isDiscrepancy ? 1 : 0) - (a.isDiscrepancy ? 1 : 0)); // Show discrepancies first

  // Cost Performance Report
  const recipeProfitData = filteredRecipes.map(recipe => ({
    type: 'Receita',
    name: recipe.name.length > 20 ? recipe.name.substring(0, 20) + '...' : recipe.name,
    margin: recipe.profitMargin,
    cost: recipe.totalCost,
    price: recipe.sellingPrice,
    profit: recipe.sellingPrice - recipe.totalCost,
  }));

  const productProfitData = filteredProducts
    .filter(p => (p.sellingPrice || 0) > 0)
    .map(product => {
      const margin = ((product.sellingPrice! - product.averageCost) / product.sellingPrice!) * 100;
      return {
        type: 'Produto',
        name: product.name.length > 20 ? product.name.substring(0, 20) + '...' : product.name,
        margin: margin,
        cost: product.averageCost,
        price: product.sellingPrice || 0,
        profit: (product.sellingPrice || 0) - product.averageCost,
      };
    });

  const costData = [...recipeProfitData, ...productProfitData].sort((a, b) => b.margin - a.margin);

  // Supplier Performance Analysis
  const supplierPerformance = suppliers.map(supplier => {
    const supplierPurchases = filteredPriceHistory.filter(ph => ph.supplierId === supplier.id);
    
    let totalSpent = 0;
    let totalSavings = 0;
    let productsSupplied = new Set<string>();

    supplierPurchases.forEach(purchase => {
      const product = products.find(p => p.id === purchase.productId);
      if (!product) return;

      productsSupplied.add(product.id);
      const cost = purchase.price * purchase.quantity;
      totalSpent += cost;

      // Calculate savings compared to average cost of the product
      const savingPerUnit = product.averageCost - purchase.price;
      totalSavings += savingPerUnit * purchase.quantity;
    });

    return {
      supplier,
      totalSpent,
      totalSavings,
      productCount: productsSupplied.size,
      purchaseCount: supplierPurchases.length,
      performanceScore: supplier.reliability * 0.6 + (supplier.rating * 20) * 0.4
    };
  }).filter(s => s.purchaseCount > 0 || !searchQuery)
    .sort((a, b) => b.totalSavings - a.totalSavings);
  
  // Price Variation Report
  const priceVariations = filteredProducts
    .map(product => {
      const productHistory = filteredPriceHistory.filter(ph => ph.productId === product.id);
      if (productHistory.length < 2) return null;
      
      const variation = detectPriceVariation(productHistory, product.averageCost, 5);
      if (!variation.hasVariation) return null;
      
      return {
        product,
        variation,
        history: productHistory,
      };
    })
    .filter(Boolean) as Array<{
      product: Product;
      variation: { hasVariation: boolean; percentage: number; trend: 'up' | 'down' | 'stable' };
      history: PriceHistory[];
    }>;
  
  // Suggested Orders Report
  const suggestedOrders = filteredProducts
    .map(product => {
      const productMovements = movements.filter(m => m.productId === product.id); // Base suggestion on ALL movements for better avg
      const avgConsumption = calculateAverageConsumption(productMovements, 30);
      const suggestedQty = calculateSuggestedOrder(
        product.currentStock,
        product.minStock,
        product.safetyStock,
        avgConsumption,
        7
      );
      
      const status = getStockStatus(product.currentStock, product.minStock, product.safetyStock);
      
      if (suggestedQty <= 0 && status !== 'critical' && status !== 'low') return null;
      
      // Find best supplier for this product
      const productHistory = filteredPriceHistory.filter(ph => ph.productId === product.id);
      const supplierPrices = productHistory.reduce((acc, ph) => {
        if (!acc[ph.supplierId]) {
          acc[ph.supplierId] = { total: 0, count: 0 };
        }
        acc[ph.supplierId].total += ph.price;
        acc[ph.supplierId].count += 1;
        return acc;
      }, {} as Record<string, { total: number; count: number }>);
      
      let bestSupplier = null;
      let bestPrice = Infinity;
      
      for (const [supplierId, data] of Object.entries(supplierPrices)) {
        const avgPrice = data.total / data.count;
        if (avgPrice < bestPrice) {
          bestPrice = avgPrice;
          bestSupplier = suppliers.find(s => s.id === supplierId);
        }
      }
      
      return {
        product,
        suggestedQty: Math.max(suggestedQty, product.safetyStock - product.currentStock),
        avgConsumption,
        status,
        bestSupplier,
        estimatedCost: bestPrice * Math.max(suggestedQty, product.safetyStock - product.currentStock),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const statusOrder = { critical: 0, low: 1, adequate: 2, high: 3 };
      return statusOrder[a!.status] - statusOrder[b!.status];
    }) as Array<{
      product: Product;
      suggestedQty: number;
      avgConsumption: number;
      status: 'critical' | 'low' | 'adequate' | 'high';
      bestSupplier: Supplier | undefined;
      estimatedCost: number;
    }>;
  
  // Waste Report
  const wasteMovements = filteredMovements.filter(m => m.type === 'desperdicio');
  
  const wasteByReason = wasteMovements.reduce((acc, m) => {
    const reason = m.wasteReason || 'outro';
    if (!acc[reason]) {
      acc[reason] = { total: 0, items: [] };
    }
    acc[reason].total += m.cost || 0;
    acc[reason].items.push(m);
    return acc;
  }, {} as Record<string, { total: number; items: StockMovement[] }>);
  
  const wasteChartData = Object.entries(wasteByReason).map(([reason, data]) => ({
    name: reason === 'vencimento' ? 'Vencimento' :
          reason === 'quebra' ? 'Quebra' :
          reason === 'mau_uso' ? 'Mau Uso' : 'Outro',
    value: data.total,
  }));
  
  const mostWastedProducts = wasteMovements.reduce((acc, m) => {
    if (!acc[m.productId]) {
      const product = products.find(p => p.id === m.productId);
      acc[m.productId] = {
        product: product!,
        totalCost: 0,
        totalQuantity: 0,
        count: 0,
      };
    }
    acc[m.productId].totalCost += m.cost || 0;
    acc[m.productId].totalQuantity += m.quantity;
    acc[m.productId].count += 1;
    return acc;
  }, {} as Record<string, { product: Product; totalCost: number; totalQuantity: number; count: number }>);
  
  const allWastedProducts = Object.values(mostWastedProducts)
    .sort((a, b) => b.totalCost - a.totalCost);
  
  // Demand Forecast
  const forecastData = filteredProducts.map(product => {
    const productMovements = filteredMovements.filter(m => m.productId === product.id);
    const forecast = forecastDemand(productMovements, 7);
    
    return {
      product,
      forecast,
      currentStock: product.currentStock,
      willRunOut: forecast.quantity > product.currentStock,
    };
  }).filter(d => d.forecast.quantity > 0)
    .sort((a, b) => b.forecast.quantity - a.forecast.quantity);
  
  const totalWaste = wasteMovements.reduce((sum, m) => sum + (m.cost || 0), 0);
  const totalLostRevenue = wasteMovements.reduce((sum, m) => {
    const product = products.find(p => p.id === m.productId);
    return sum + (m.quantity * (product?.sellingPrice || 0));
  }, 0);
  const totalStockValue = filteredProducts.reduce((sum, p) => sum + (p.currentStock * p.averageCost), 0);
  const wastePercentage = totalStockValue > 0 ? (totalWaste / totalStockValue) * 100 : 0;
  
  // History Report (Audit)
  const auditMovements = filteredMovements.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2>Relatórios e Análises</h2>
          <p className="text-gray-600 mt-1">
            Análises inteligentes para tomada de decisão
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">Excel</span>
          </button>
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">PDF</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Buscar Produto/Motivo</label>
          <div className="relative">
            <input
              type="text"
              placeholder="Digite para filtrar..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 border text-gray-500 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <Package className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">De</label>
            <input
              type="date"
              value={draftStartDate}
              onChange={(e) => setDraftStartDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyReportDateFilter();
                }
              }}
              className="w-full px-3 py-2 border text-gray-500 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Até</label>
            <input
              type="date"
              value={draftEndDate}
              onChange={(e) => setDraftEndDate(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyReportDateFilter();
                }
              }}
              className="w-full px-3 py-2 border text-gray-500 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="button"
            onClick={() => applyReportDateFilter()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium shrink-0"
          >
            Filtrar período
          </button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="bg-white rounded-lg border border-gray-200 p-1 flex gap-1 overflow-x-auto no-scrollbar md:grid md:grid-cols-3 lg:flex lg:overflow-visible">
        <button
          onClick={() => setActiveTab('entries')}
          className={`whitespace-nowrap flex-shrink-0 md:flex-1 px-3 md:px-4 py-2 rounded flex items-center justify-center gap-2 text-xs md:text-sm ${
            activeTab === 'entries' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <PackagePlus className="w-4 h-4 md:w-5 md:h-5" />
          Entradas
        </button>
        <button
          onClick={() => setActiveTab('outputs')}
          className={`whitespace-nowrap flex-shrink-0 md:flex-1 px-3 md:px-4 py-2 rounded flex items-center justify-center gap-2 text-xs md:text-sm ${
            activeTab === 'outputs' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Package className="w-4 h-4 md:w-5 md:h-5" />
          Saídas
        </button>
        <button
          onClick={() => setActiveTab('cost')}
          className={`whitespace-nowrap flex-shrink-0 md:flex-1 px-3 md:px-4 py-2 rounded flex items-center justify-center gap-2 text-xs md:text-sm ${
            activeTab === 'cost' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <DollarSign className="w-4 h-4 md:w-5 md:h-5" />
          Custo
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`whitespace-nowrap flex-shrink-0 md:flex-1 px-3 md:px-4 py-2 rounded flex items-center justify-center gap-2 text-xs md:text-sm ${
            activeTab === 'orders' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
          Pedidos
        </button>
        <button
          onClick={() => setActiveTab('waste')}
          className={`whitespace-nowrap flex-shrink-0 md:flex-1 px-3 md:px-4 py-2 rounded flex items-center justify-center gap-2 text-xs md:text-sm ${
            activeTab === 'waste' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4 md:w-5 md:h-5" />
          Desperdício
        </button>
        <button
          onClick={() => setActiveTab('forecast')}
          className={`whitespace-nowrap flex-shrink-0 md:flex-1 px-3 md:px-4 py-2 rounded flex items-center justify-center gap-2 text-xs md:text-sm ${
            activeTab === 'forecast' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <TrendingUp className="w-4 h-4 md:w-5 md:h-5" />
          Previsão
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`whitespace-nowrap flex-shrink-0 md:flex-1 px-3 md:px-4 py-2 rounded flex items-center justify-center gap-2 text-xs md:text-sm ${
            activeTab === 'history' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <History className="w-4 h-4 md:w-5 md:h-5" />
          Histórico
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`whitespace-nowrap flex-shrink-0 md:flex-1 px-3 md:px-4 py-2 rounded flex items-center justify-center gap-2 text-xs md:text-sm ${
            activeTab === 'audit' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <ClipboardCheck className="w-4 h-4 md:w-5 md:h-5" />
          Revisão
        </button>
        <button
          onClick={() => setActiveTab('sales')}
          className={`whitespace-nowrap flex-shrink-0 md:flex-1 px-3 md:px-4 py-2 rounded flex items-center justify-center gap-2 text-xs md:text-sm ${
            activeTab === 'sales' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Receipt className="w-4 h-4 md:w-5 md:h-5" />
          Vendas
        </button>
        <button
          onClick={() => setActiveTab('closures')}
          className={`whitespace-nowrap flex-shrink-0 md:flex-1 px-3 md:px-4 py-2 rounded flex items-center justify-center gap-2 text-xs md:text-sm ${
            activeTab === 'closures' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <CreditCard className="w-4 h-4 md:w-5 md:h-5" />
          Fechamentos
        </button>
      </div>
      
      {/* Entries Tab (NEW) */}
      {activeTab === 'entries' && (
        <EntriesTab
          data={entriesData}
          loading={isLoadingEntries}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Outputs Tab (NEW) */}
      {activeTab === 'outputs' && (
        <OutputsTab
          movements={filteredMovements}
          products={products}
          loading={false}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Cost Performance Tab */}
      {activeTab === 'cost' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600">Lucro Médio (Geral)</p>
              <p className="text-2xl font-bold mt-2">
                {formatCurrency(costData.reduce((sum, d) => sum + d.profit, 0) / (costData.length || 1))}
              </p>
              <p className="text-green-600 mt-1 flex items-center gap-1">
                <TrendingUp className="w-4 h-4" />
                Média de {formatPercentage(costData.reduce((sum, d) => sum + d.margin, 0) / (costData.length || 1))}
              </p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600">Economia com Fornecedores</p>
              <p className="text-2xl font-bold mt-2">
                {formatCurrency(supplierPerformance.reduce((sum, d) => sum + d.totalSavings, 0))}
              </p>
              <p className="text-blue-600 mt-1">Estimativa vs Média de Mercado</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600">Total Investido em Estoque</p>
              <p className="text-2xl font-bold mt-2">{formatCurrency(totalStockValue)}</p>
              <p className="text-gray-500 mt-1">{products.length} itens ativos</p>
            </div>
          </div>

          {/* Profit Margin Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold">Rentabilidade de Receitas e Produtos</h3>
                <p className="text-sm text-gray-500">Comparação de custo, preço e lucro (Top 10 mais rentáveis)</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[400px]">
                {costData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costData.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis 
                        dataKey="name" 
                        angle={-45}
                        textAnchor="end"
                        height={100}
                        interval={0}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis yAxisId="left" orientation="left" stroke="#10b981" />
                      <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" />
                      <Tooltip 
                        formatter={(value: any, name: string) => [
                          name === 'margin' ? formatPercentage(value) : formatCurrency(value),
                          name === 'margin' ? 'Margem' : 
                          name === 'profit' ? 'Lucro' : 
                          name === 'cost' ? 'Custo' : 'Preço'
                        ]} 
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="margin" name="Margem (%)" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar yAxisId="right" dataKey="profit" name="Lucro (R$)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    Nenhuma receita cadastrada
                  </div>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-600 font-semibold">Tipo</th>
                      <th className="px-3 py-2 text-left text-gray-600 font-semibold">Item</th>
                      <th className="px-3 py-2 text-right text-gray-600 font-semibold">Margem</th>
                      <th className="px-3 py-2 text-right text-gray-600 font-semibold">Custo</th>
                      <th className="px-3 py-2 text-right text-gray-600 font-semibold">Lucro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {paginate(costData).map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-[10px] uppercase font-bold text-gray-400">{item.type}</td>
                        <td className="px-3 py-2 font-medium">{item.name}</td>
                        <td className={`px-3 py-2 text-right ${item.margin > 30 ? 'text-green-600' : item.margin > 15 ? 'text-orange-600' : 'text-red-600'}`}>
                          {formatPercentage(item.margin)}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500">{formatCurrency(item.cost)}</td>
                        <td className="px-3 py-2 text-right font-bold text-blue-600">{formatCurrency(item.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {costData.length > itemsPerPage && (
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <div className="text-[10px] text-gray-500">
                      Página {currentPage} de {Math.ceil(costData.length / itemsPerPage)}
                    </div>
                    <div className="flex gap-1">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="px-2 py-1 border rounded text-[10px] hover:bg-gray-50 disabled:opacity-50"
                      >
                        Ant.
                      </button>
                      <button
                        disabled={currentPage * itemsPerPage >= costData.length}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="px-2 py-1 border rounded text-[10px] hover:bg-gray-50 disabled:opacity-50"
                      >
                        Próx.
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Supplier Performance Analysis */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="mb-4 font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-blue-600" />
              Desempenho por Fornecedor
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              Análise de quanto você ganha (economiza) comprando com cada fornecedor em relação à média de custos.
            </p>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-600 font-semibold">Fornecedor</th>
                    <th className="px-4 py-3 text-right text-gray-600 font-semibold">Produtos</th>
                    <th className="px-4 py-3 text-right text-gray-600 font-semibold">Total Comprado</th>
                    <th className="px-4 py-3 text-right text-gray-600 font-semibold text-blue-700">Ganho/Economia</th>
                    <th className="px-4 py-3 text-center text-gray-600 font-semibold">Confiabilidade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginate(supplierPerformance).map(({ supplier, totalSpent, totalSavings, productCount, performanceScore }) => (
                    <tr key={supplier.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-sm">{supplier.name}</div>
                        <div className="text-[10px] text-gray-500 uppercase">{supplier.contact}</div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 text-sm">
                        {productCount} itens
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600 text-sm">
                        {formatCurrency(totalSpent)}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold text-sm ${totalSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <div className="flex flex-col items-end">
                          <span>{formatCurrency(Math.abs(totalSavings))}</span>
                          <span className="text-[10px] uppercase">{totalSavings >= 0 ? 'Economizado' : 'Excedente'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-24 bg-gray-200 rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full ${
                                performanceScore > 80 ? 'bg-green-500' : 
                                performanceScore > 50 ? 'bg-orange-500' : 'bg-red-500'
                              }`} 
                              style={{ width: `${performanceScore}%` }}
                            />
                          </div>
                          <span className="text-[10px] mt-1 text-gray-500">{performanceScore.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {supplierPerformance.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-gray-400 italic">
                        Sem histórico de compras suficiente para análise de desempenho.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {supplierPerformance.length > itemsPerPage && (
              <div className="mt-4 flex items-center justify-between border-t pt-4">
                <div className="text-xs text-gray-500">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, supplierPerformance.length)} de {supplierPerformance.length} fornecedores
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={currentPage * itemsPerPage >= supplierPerformance.length}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-50"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Price Variations */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              Variações de Preço Detectadas
            </h3>
            
            {priceVariations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {priceVariations.map(({ product, variation }) => (
                  <div 
                    key={product.id}
                    className={`p-4 rounded-lg border ${
                      variation.trend === 'up' 
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-green-50 border-green-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{product.name}</p>
                        <p className="text-gray-600 mt-1 text-sm">
                          Custo atual: {formatCurrency(product.averageCost)}
                        </p>
                      </div>
                      <div className={`text-right ${
                        variation.trend === 'up' ? 'text-red-700' : 'text-green-700'
                      }`}>
                        <p className="flex items-center gap-1 justify-end font-bold text-lg">
                          {variation.trend === 'up' ? (
                            <TrendingUp className="w-5 h-5" />
                          ) : (
                            <TrendingDown className="w-5 h-5" />
                          )}
                          {formatPercentage(Math.abs(variation.percentage))}
                        </p>
                        <p className="text-xs font-medium uppercase">
                          {variation.trend === 'up' ? 'Aumento detectado' : 'Redução detectada'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma variação significativa detectada</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3>Pedidos Sugeridos</h3>
              <div className="text-gray-600">
                Total estimado: {formatCurrency(suggestedOrders.reduce((sum, o) => sum + o.estimatedCost, 0))}
              </div>
            </div>
            
            {suggestedOrders.length > 0 ? (
              <div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-gray-600 text-sm">Produto</th>
                        <th className="px-4 py-3 text-right text-gray-600 text-sm">Estoque Atual</th>
                        <th className="px-4 py-3 text-right text-gray-600 text-sm">Qtd. Sugerida</th>
                        <th className="px-4 py-3 text-right text-gray-600 text-sm">Consumo Médio/dia</th>
                        <th className="px-4 py-3 text-left text-gray-600 text-sm">Fornecedor Sugerido</th>
                        <th className="px-4 py-3 text-right text-gray-600 text-sm">Custo Estimado</th>
                        <th className="px-4 py-3 text-center text-gray-600 text-sm">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginate(suggestedOrders).map(({ product, suggestedQty, avgConsumption, status, bestSupplier, estimatedCost }) => (
                        <tr key={product.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-sm">{product.name}</p>
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {product.currentStock} {product.measurementUnit}
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {suggestedQty.toFixed(2)} {product.measurementUnit}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-600 text-sm">
                            {avgConsumption.toFixed(2)} {product.measurementUnit}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {bestSupplier?.name || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-right text-sm">
                            {formatCurrency(estimatedCost)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-1 rounded text-[10px] font-bold ${
                              status === 'critical' ? 'bg-red-100 text-red-700' :
                              status === 'low' ? 'bg-orange-100 text-orange-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {status === 'critical' ? 'URGENTE' :
                               status === 'low' ? 'BAIXO' : 'PREVENTIVO'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {suggestedOrders.length > itemsPerPage && (
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-500">
                      Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, suggestedOrders.length)} de {suggestedOrders.length} itens
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <button
                        disabled={currentPage * itemsPerPage >= suggestedOrders.length}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Todos os produtos com estoque adequado!</p>
                <p className="mt-2">Nenhum pedido sugerido no momento</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Waste Tab */}
      {activeTab === 'waste' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600">Desperdício Total (Custo)</p>
              <p className="mt-2 font-bold text-xl">{formatCurrency(totalWaste)}</p>
              <p className="text-red-600 mt-1 text-sm">{formatPercentage(wastePercentage)} do estoque</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600">Perda de Faturamento</p>
              <p className="mt-2 font-bold text-xl text-orange-600">{formatCurrency(totalLostRevenue)}</p>
              <p className="text-gray-500 mt-1 text-sm">Venda potencial perdida</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600">Incidentes</p>
              <p className="mt-2 font-bold text-xl">{wasteMovements.length}</p>
              <p className="text-gray-500 mt-1 text-sm">Registros no período</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <p className="text-gray-600">Produtos Afetados</p>
              <p className="mt-2 font-bold text-xl">{Object.keys(mostWastedProducts).length}</p>
              <p className="text-gray-500 mt-1 text-sm">SKUs diferentes</p>
            </div>
          </div>
          
          {/* Waste by Reason */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="mb-4">Desperdício por Motivo</h3>
            {wasteChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={wasteChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Bar dataKey="value" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                Nenhum desperdício registrado
              </div>
            )}
          </div>
          
          {/* Top Wasted Products */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="mb-4">Produtos Mais Desperdiçados</h3>
            {allWastedProducts.length > 0 ? (
              <div>
                <div className="space-y-3">
                  {paginate(allWastedProducts).map(({ product, totalCost, totalQuantity, count }) => (
                    <div key={product.id} className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-gray-600 mt-1 text-xs">
                          {totalQuantity.toFixed(2)} {product.measurementUnit} em {count} incidente{count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-red-700 font-bold text-sm">{formatCurrency(totalCost)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {allWastedProducts.length > itemsPerPage && (
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div className="text-xs text-gray-500">
                      Página {currentPage} de {Math.ceil(allWastedProducts.length / itemsPerPage)}
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <button
                        disabled={currentPage * itemsPerPage >= allWastedProducts.length}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">
                Nenhum desperdício registrado
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Forecast Tab */}
      {activeTab === 'forecast' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="mb-4">Previsão de Demanda (7 dias)</h3>
            <p className="text-gray-600 mb-6">
              Baseado no histórico de consumo dos últimos 30 dias
            </p>
            
            {forecastData.length > 0 ? (
              <div>
                <div className="space-y-3">
                  {paginate(forecastData).map(({ product, forecast, currentStock, willRunOut }) => (
                    <div 
                      key={product.id} 
                      className={`p-4 rounded-lg border ${
                        willRunOut ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-sm">{product.name}</p>
                          <p className="text-gray-600 mt-1 text-xs">
                            Estoque atual: {currentStock} {product.measurementUnit}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-xs">
                            Demanda prevista: {forecast.quantity} {product.measurementUnit}
                          </p>
                          <p className="text-gray-600 mt-1 text-[10px]">
                            Confiança: {forecast.confidence}%
                          </p>
                          {willRunOut && (
                            <p className="text-red-600 mt-1 flex items-center gap-1 justify-end text-[10px] font-bold">
                              <AlertTriangle className="w-3 h-3" />
                              Ruptura Provável
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {forecastData.length > itemsPerPage && (
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-500">
                      Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, forecastData.length)} de {forecastData.length} itens
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <button
                        disabled={currentPage * itemsPerPage >= forecastData.length}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Dados insuficientes para previsão</p>
                <p className="mt-2">Continue registrando movimentações de estoque</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="mb-4">Histórico de Movimentações</h3>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-600">Data</th>
                    <th className="px-4 py-3 text-left text-gray-600">Usuário</th>
                    <th className="px-4 py-3 text-left text-gray-600">Tipo</th>
                    <th className="px-4 py-3 text-left text-gray-600">Produto</th>
                    <th className="px-4 py-3 text-right text-gray-600">Quantidade</th>
                    <th className="px-4 py-3 text-left text-gray-600">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginate(auditMovements).map((movement) => {
                    const product = products.find(p => p.id === movement.productId);
                    return (
                      <tr key={movement.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-sm">
                          {formatDate(movement.date)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {movement.userId ? (
                            <span className="flex items-center gap-1 text-gray-700">
                               <User className="w-3 h-3" />
                               {movement.userId.substring(0, 8)}...
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">Sistema</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${
                            movement.type === 'entrada' ? 'bg-green-100 text-green-800' :
                            movement.type === 'venda' ? 'bg-blue-100 text-blue-800' :
                            movement.type === 'desperdicio' ? 'bg-red-100 text-red-800' :
                            'bg-orange-100 text-orange-800'
                          }`}>
                            {movement.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">
                          {product?.name || 'Produto Removido'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono">
                          {movement.quantity}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate" title={movement.reason}>
                          {movement.reason || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {auditMovements.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p>Nenhuma movimentação encontrada para o período/filtro selecionado.</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {auditMovements.length > itemsPerPage && (
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <div className="text-sm text-gray-500">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, auditMovements.length)} de {auditMovements.length} resultados
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={currentPage * itemsPerPage >= auditMovements.length}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Audit / Consistency Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-blue-600" />
                  Revisão de Consistência de Estoque
                </h3>
                <p className="text-gray-600 mt-1 text-sm">
                  Comparação do estoque atual (A) com o histórico de movimentações (B) no período.
                </p>
              </div>
              <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm">
                <strong>{auditData.filter(d => d.isDiscrepancy).length}</strong> inconsistências filtradas
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-gray-600">Produto</th>
                    <th className="px-4 py-3 text-right text-gray-600">Estoque (A)</th>
                    <th className="px-4 py-3 text-right text-gray-600">Calculado (B)</th>
                    <th className="px-4 py-3 text-right text-gray-600">Dif. (A-B)</th>
                    <th className="px-4 py-3 text-center text-gray-600">Status</th>
                    <th className="px-4 py-3 text-center text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginate(auditData).map((data) => (
                    <tr key={data.product.id} className={`hover:bg-gray-50 ${data.isDiscrepancy ? 'bg-red-50' : ''}`}>
                      <td className="px-4 py-3 font-medium text-sm">
                        {data.product.name}
                        <div className="text-xs text-gray-500 font-normal">
                          {data.movementsCount} movimentações no período
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {data.currentStock} {data.product.measurementUnit}
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {data.calculatedStock} {data.product.measurementUnit}
                      </td>
                      <td className={`px-4 py-3 text-right font-mono text-sm ${data.diff > 0 ? 'text-red-600' : data.diff < 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {data.diff > 0 ? '+' : ''}{data.diff.toFixed(4)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {data.isDiscrepancy ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-[10px] font-bold">
                            <AlertTriangle className="w-3 h-3" />
                            ERRO
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-[10px] font-bold">
                            OK
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {data.isDiscrepancy && (
                          <button
                            onClick={() => handleFixStock(data.product, data.calculatedStock)}
                            disabled={fixing === data.product.id}
                            className="text-[10px] bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-1 mx-auto"
                          >
                            {fixing === data.product.id ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <RefreshCw className="w-3 h-3" />
                            )}
                            Corrigir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {auditData.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                  <p>Nenhum dado encontrado para os filtros selecionados.</p>
                </div>
              )}
            </div>

            {/* Pagination */}
            {auditData.length > itemsPerPage && (
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <div className="text-sm text-gray-500">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, auditData.length)} de {auditData.length} itens
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={currentPage * itemsPerPage >= auditData.length}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-blue-600" />
                  Relatório de Vendas do Caixa
                </h3>
                <p className="text-gray-600 mt-1 text-sm">
                  Histórico completo de vendas realizadas pelo módulo de Caixa/PDV
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchSales}
                  disabled={isLoadingSales}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  title="Atualizar dados"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingSales ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm">
                  <strong>{salesData.length}</strong> vendas no período
                </div>
              </div>
            </div>

            {isLoadingSales ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-500">Carregando vendas...</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                    <p className="text-sm text-green-700 font-semibold">Total em Vendas</p>
                    <p className="text-2xl font-bold text-green-900 mt-1">
                      {formatCurrency(salesData.reduce((sum, s) => sum + s.total, 0))}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                    <p className="text-sm text-blue-700 font-semibold">Qtd. Vendas</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {salesData.length}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                    <p className="text-sm text-purple-700 font-semibold">Ticket Médio</p>
                    <p className="text-2xl font-bold text-purple-900 mt-1">
                      {formatCurrency(salesData.length > 0 ? salesData.reduce((sum, s) => sum + s.total, 0) / salesData.length : 0)}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
                    <p className="text-sm text-orange-700 font-semibold">Descontos</p>
                    <p className="text-2xl font-bold text-orange-900 mt-1">
                      {formatCurrency(salesData.reduce((sum, s) => sum + s.discount, 0))}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Data/Hora</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Cliente</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Itens</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Desconto</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Pagamento</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Operador</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginate(salesData).map((sale) => (
                        <tr key={sale.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm">
                            {new Date(sale.saleDate).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {sale.customerName || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {sale.items?.length || 0} itens
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
                            {formatCurrency(sale.total)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-orange-600">
                            {formatCurrency(sale.discount)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              sale.paymentMethod === 'money' ? 'bg-green-100 text-green-800' :
                              sale.paymentMethod === 'pix' ? 'bg-blue-100 text-blue-800' :
                              sale.paymentMethod === 'credit' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {sale.paymentMethod === 'money' ? 'Dinheiro' :
                               sale.paymentMethod === 'pix' ? 'PIX' :
                               sale.paymentMethod === 'credit' ? 'Crédito' : 'Débito'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {sale.cashierName}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {salesData.length === 0 && (
                    <div className="text-center py-12">
                      <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-bold text-gray-700 mb-2">
                        Nenhuma venda encontrada
                      </h3>
                      <p className="text-gray-500 mb-4">
                        Não há vendas registradas no período selecionado ({formatDate(startDate)} até {formatDate(endDate)})
                      </p>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto text-left">
                        <p className="text-sm text-blue-900 font-semibold mb-2">💡 Dica:</p>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>• Realize vendas no módulo <strong>Caixa/PDV</strong></li>
                          <li>• Ajuste o período de datas acima para expandir a busca</li>
                          <li>• Verifique se há um caixa aberto e faça uma venda de teste</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {salesData.length > itemsPerPage && (
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-500">
                      Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, salesData.length)} de {salesData.length} vendas
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <button
                        disabled={currentPage * itemsPerPage >= salesData.length}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Closures Tab */}
      {activeTab === 'closures' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  Relatório de Fechamentos de Caixa
                </h3>
                <p className="text-gray-600 mt-1 text-sm">
                  Histórico completo de fechamentos realizados
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchClosures}
                  disabled={isLoadingClosures}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  title="Atualizar dados"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingClosures ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
                <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm">
                  <strong>{closuresData.length}</strong> fechamentos no período
                </div>
              </div>
            </div>

            {isLoadingClosures ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
                <p className="text-gray-500">Carregando fechamentos...</p>
              </div>
            ) : (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                    <p className="text-sm text-green-700 font-semibold">Total em Vendas</p>
                    <p className="text-2xl font-bold text-green-900 mt-1">
                      {formatCurrency(closuresData.reduce((sum, c) => sum + c.totalSales, 0))}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
                    <p className="text-sm text-red-700 font-semibold">Sangrias</p>
                    <p className="text-2xl font-bold text-red-900 mt-1">
                      {formatCurrency(closuresData.reduce((sum, c) => sum + c.totalWithdrawals, 0))}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                    <p className="text-sm text-blue-700 font-semibold">Reforços</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {formatCurrency(closuresData.reduce((sum, c) => sum + c.totalDeposits, 0))}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                    <p className="text-sm text-purple-700 font-semibold">Qtd. Vendas Total</p>
                    <p className="text-2xl font-bold text-purple-900 mt-1">
                      {closuresData.reduce((sum, c) => sum + c.salesCount, 0)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Operador</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Abertura</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fechamento</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">S. Inicial</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">S. Final</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Vendas</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Qtd</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Sangrias</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Reforços</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paginate(closuresData).map((closure) => (
                        <tr key={closure.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-semibold">
                            {closure.cashierName}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {new Date(closure.openedAt).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {new Date(closure.closedAt).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-4 py-3 text-sm text-right">
                            {formatCurrency(closure.initialBalance)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right font-semibold">
                            {formatCurrency(closure.finalBalance)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">
                            {formatCurrency(closure.totalSales)}
                          </td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                              {closure.salesCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-red-600">
                            {formatCurrency(closure.totalWithdrawals)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-blue-600">
                            {formatCurrency(closure.totalDeposits)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {closuresData.length === 0 && (
                    <div className="text-center py-12">
                      <CreditCard className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                      <h3 className="text-lg font-bold text-gray-700 mb-2">
                        Nenhum fechamento encontrado
                      </h3>
                      <p className="text-gray-500 mb-4">
                        Não há fechamentos de caixa no período selecionado ({formatDate(startDate)} até {formatDate(endDate)})
                      </p>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto text-left">
                        <p className="text-sm text-blue-900 font-semibold mb-2">💡 Dica:</p>
                        <ul className="text-sm text-blue-800 space-y-1">
                          <li>• Abra um caixa no módulo <strong>Caixa/PDV</strong></li>
                          <li>• Realize vendas e depois feche o caixa</li>
                          <li>• Ajuste o período de datas acima para expandir a busca</li>
                          <li>• Os fechamentos aparecem na aba <strong>Histórico</strong> do Caixa</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pagination */}
                {closuresData.length > itemsPerPage && (
                  <div className="mt-6 flex items-center justify-between border-t pt-4">
                    <div className="text-sm text-gray-500">
                      Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, closuresData.length)} de {closuresData.length} fechamentos
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(prev => prev - 1)}
                        className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        Anterior
                      </button>
                      <button
                        disabled={currentPage * itemsPerPage >= closuresData.length}
                        onClick={() => setCurrentPage(prev => prev + 1)}
                        className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50"
                      >
                        Próximo
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
