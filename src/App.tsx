import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Toaster } from 'sonner@2.0.3';
import { supabase } from './utils/supabase/client';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CompanyProvider, useCompany } from './contexts/CompanyContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { safeStorage } from './utils/safeStorage';
import { safeDate } from './utils/safeDate';

// Components
import { Dashboard } from './components/Dashboard';
import { ProductList } from './components/products/ProductList';
import { ProductForm } from './components/products/ProductForm';
import { QuickProductForm } from './components/products/QuickProductForm';
import { ProductViewModal } from './components/products/ProductViewModal';
import { BulkImport } from './components/products/BulkImport';
import { ConfirmModal } from './components/products/ConfirmModal';
import { StockEntryForm } from './components/inventory/StockEntry';
import { StockEntryList } from './components/inventory/StockEntryList';
import { StockBalance } from './components/inventory/StockBalance';
import { POS } from './components/sales/POS';
import { CashRegister } from './components/cashier/CashRegister';
import { SupplierManagement } from './components/suppliers/SupplierManagement';
import { Reports } from './components/reports/Reports';
import { UserManagement } from './components/users/UserManagement';
import { CompanySelection } from './components/auth/CompanySelection';
import { Login } from './components/auth/Login';
import { AdminLogin } from './components/auth/AdminLogin';
import { LandingPage } from './components/landing/LandingPage';
import { AdminSaaS } from './components/admin/AdminSaaS';
import { QuickSearch } from './components/QuickSearch';
import { PWAUpdateNotifier } from './components/PWAUpdateNotifier';
import { CostDashboard } from './components/costs/CostDashboard';
import { IntegrationsPage } from './components/integrations/IntegrationsPage';
import { ErrorBoundary } from './components/ErrorBoundary';

// Icons
import { 
  LayoutDashboard, 
  Package, 
  TrendingUp, 
  Barcode,
  ShoppingCart, 
  FileText, 
  Users, 
  Truck,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  Building,
  DollarSign,
  Plug
} from 'lucide-react';

// Services and Types
import type { Product, Supplier, StockEntry, StockMovement, PriceHistory } from './types';
import { ProductService } from './services/ProductService';
import { StockService } from './services/StockService';
import { ProductRepository } from './repositories/ProductRepository';
import { SupplierRepository } from './repositories/SupplierRepository';
import { PriceHistoryRepository } from './repositories/PriceHistoryRepository';
import { toast } from 'sonner@2.0.3';
import { useIsMobile } from './components/ui/use-mobile';
import logoImg from './public/logo.svg';
import { APP_NAME, APP_ORIGIN, APP_SITE_URL } from './config/branding';

type Page = 'dashboard' | 'products' | 'stock-entry' | 'stock-balance' | 'pos' | 'cashier' | 'reports' | 'suppliers' | 'integrations' | 'users' | 'admin' | 'costs';

function MainApp() {
  const { user, logout } = useAuth();
  const { currentCompany, selectCompany } = useCompany();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();

  // PWA Support
  useEffect(() => {
    // Inject PWA meta tags
    const metaTags = [
      { name: 'theme-color', content: '#2563eb' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: APP_NAME },
      { name: 'application-name', content: APP_NAME },
      { name: 'msapplication-TileColor', content: '#2563eb' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover' }
    ];

    metaTags.forEach(tag => {
      let meta = document.querySelector(`meta[name="${tag.name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', tag.name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', tag.content);
    });

    const ogTags: { property: string; content: string }[] = [
      { property: 'og:site_name', content: APP_NAME },
      { property: 'og:url', content: APP_SITE_URL },
      { property: 'og:type', content: 'website' },
    ];
    ogTags.forEach((tag) => {
      let meta = document.querySelector(`meta[property="${tag.property}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('property', tag.property);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', tag.content);
    });

    document.title = APP_NAME;

    // Favicon: /public/favicon.svg (também declarado no index.html para primeira pintura)
    const faviconHref = '/favicon.svg';
    let favicon = document.querySelector('link[rel="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.setAttribute('rel', 'icon');
      document.head.appendChild(favicon);
    }
    favicon.setAttribute('type', 'image/svg+xml');
    favicon.setAttribute('href', faviconHref);

    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement('link');
      appleIcon.setAttribute('rel', 'apple-touch-icon');
      document.head.appendChild(appleIcon);
    }
    appleIcon.setAttribute('href', faviconHref);

    // Add manifest link
    let link = document.querySelector('link[rel="manifest"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'manifest');
      link.setAttribute('href', '/manifest.json');
      document.head.appendChild(link);
    }

    // Register Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker registered successfully:', registration.scope);
            
            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[PWA] New content available, please refresh.');
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.error('[PWA] Service Worker registration failed:', error);
          });
      });
    }

    // PWA Install Prompt
    let deferredPrompt: any = null;
    
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PWA] Install prompt available');
      e.preventDefault();
      deferredPrompt = e;
      
      // Show install button or notification
      // You can create a custom install button here
    });

    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      deferredPrompt = null;
    });
  }, []);

  const [currentPage, setCurrentPage] = useState<Page>(() => {
    // Inicializa a partir da URL ou safeStorage
    const urlParams = new URLSearchParams(window.location.search);
    const pageFromUrl = urlParams.get('page') as Page;
    const pageFromStorage = safeStorage.getItem('pyroustock_current_page') as Page;
    
    // Prioridade: URL > safeStorage > default
    return pageFromUrl || pageFromStorage || 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showQuickProductForm, setShowQuickProductForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  
  // Persist page in URL and safeStorage
  useEffect(() => {
    // Update URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('page', currentPage);
    window.history.replaceState({}, '', url.toString());
    
    // Save to safeStorage
    safeStorage.setItem('pyroustock_current_page', currentPage);
  }, [currentPage]);
  
  // Close sidebar on mobile
  useEffect(() => {
    if (isMobile) {
      setSidebarOpen(false);
    } else {
      setSidebarOpen(true);
    }
  }, [isMobile]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [confirmEdit, setConfirmEdit] = useState<Product | null>(null);
  const [editingStockEntry, setEditingStockEntry] = useState<StockEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  
  // Quick Search Keyboard Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CMD+K or CTRL+K to open quick search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowQuickSearch(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  
  // Data State
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [recipes] = useState<any[]>([]); // Recipes removed, keeping empty array for compatibility
  
  // Categories
  const categories = [
    { id: 'alimento', name: 'Alimento' },
    { id: 'bebida', name: 'Bebida' },
    { id: 'descartavel', name: 'Descartável' },
    { id: 'limpeza', name: 'Limpeza' },
    { id: 'outro', name: 'Outro' },
  ];
  
  const companyId = currentCompany?.id;
  const realtimeTimerRef = useRef<number | null>(null);
  const visibilityRefreshTimerRef = useRef<number | null>(null);

  // silent: não cobre a tela com loading (evita desmontar formulários ao sincronizar dados após venda, etc.)
  const refreshData = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!companyId) {
      console.log('[refreshData] Skipping - no company selected');
      setLoading(false);
      return;
    }

    try {
      if (!silent) setLoading(true);
      const results = await Promise.allSettled([
        ProductService.getAllProducts(companyId),
        SupplierRepository.findAll(companyId),
        StockService.getAllEntries(companyId),
        StockService.getAllMovements(companyId),
        PriceHistoryRepository.findAll(companyId),
      ]);

      const pick = <T,>(i: number, empty: T): T => {
        const r = results[i];
        if (r.status === 'fulfilled') return r.value as T;
        console.error('[refreshData] Falha ao carregar índice', i, r.reason);
        return empty;
      };

      setProducts(pick(0, [] as Product[]));
      setSuppliers(pick(1, [] as Supplier[]));
      setStockEntries(pick(2, [] as StockEntry[]));
      setMovements(pick(3, [] as StockMovement[]));
      setPriceHistory(pick(4, [] as PriceHistory[]));

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        if (silent) {
          console.warn('[refreshData] Falhas parciais (refresh silencioso, sem toast):', failed.length);
        } else {
          toast.error(
            'Alguns dados não carregaram. Verifique a conexão e tente atualizar a página.'
          );
        }
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      if (!silent) {
        toast.error(`Erro ao carregar dados: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Só recarrega índice quando troca a empresa (id), não quando o objeto `user`/token é renovado
  useEffect(() => {
    if (!currentCompany?.id) return;
    void refreshData();
  }, [currentCompany?.id, refreshData]);

  // Realtime sync: se outro usuário/aba alterar dados da mesma empresa,
  // atualiza o índice (silencioso) para manter tudo consistente em todos os navegadores.
  useEffect(() => {
    if (!companyId) return;

    const scheduleRefresh = () => {
      if (realtimeTimerRef.current) {
        window.clearTimeout(realtimeTimerRef.current);
      }
      // debounce curto para agrupar múltiplos eventos (ex: venda cria movimento + update produto)
      realtimeTimerRef.current = window.setTimeout(() => {
        void refreshData({ silent: true });
      }, 400);
    };

    const channel = supabase
      .channel(`company-sync:${companyId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `company_id=eq.${companyId}` },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_entries', filter: `company_id=eq.${companyId}` },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stock_movements', filter: `company_id=eq.${companyId}` },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'price_history', filter: `company_id=eq.${companyId}` },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'suppliers', filter: `company_id=eq.${companyId}` },
        scheduleRefresh
      )
      .subscribe((status) => {
        console.log('[realtime] company sync status:', status);
      });

    return () => {
      try {
        if (realtimeTimerRef.current) {
          window.clearTimeout(realtimeTimerRef.current);
          realtimeTimerRef.current = null;
        }
      } catch {
        // ignore
      }
      supabase.removeChannel(channel);
    };
  }, [companyId, refreshData]);

  // Fallback leve: ao voltar para a aba, um refresh silencioso (sem polling em background).
  // Cobre quando Realtime não está habilitado no projeto ou rede oscila.
  useEffect(() => {
    if (!companyId) return;

    const DEBOUNCE_MS = 2000;

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (visibilityRefreshTimerRef.current) {
        window.clearTimeout(visibilityRefreshTimerRef.current);
      }
      visibilityRefreshTimerRef.current = window.setTimeout(() => {
        visibilityRefreshTimerRef.current = null;
        void refreshData({ silent: true });
      }, DEBOUNCE_MS);
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (visibilityRefreshTimerRef.current) {
        window.clearTimeout(visibilityRefreshTimerRef.current);
        visibilityRefreshTimerRef.current = null;
      }
    };
  }, [companyId, refreshData]);

  // If no company selected, show selection screen
  if (!currentCompany) {
    return <CompanySelection />;
  }
  
  // Handlers
  const handleSaveProduct = async (productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) => {
    try {
      const loadingToast = toast.loading(editingProduct ? 'Salvando alterações...' : 'Criando produto...');
      
      if (editingProduct) {
        const updated = await ProductService.updateProduct(editingProduct.id, productData);
        setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
        toast.success('Produto atualizado com sucesso!', { id: loadingToast });
      } else {
        const newProduct = await ProductService.createProduct(productData, currentCompany.id);
        setProducts(prev => [...prev, newProduct]);
        toast.success('Produto criado com sucesso!', { id: loadingToast });
      }
      setShowProductForm(false);
      setShowQuickProductForm(false);
      setEditingProduct(null);
      setConfirmEdit(null);
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error(`Erro ao salvar produto: ${error.message}`);
    }
  };
  
  const handleDuplicateProduct = async (product: Product) => {
    try {
      const loadingToast = toast.loading('Duplicando produto...');
      
      // Create a copy of the product data, excluding id and timestamps
      const duplicatedData = {
        name: `${product.name} (Cópia)`,
        category: product.category,
        isPerishable: product.isPerishable,
        measurementUnit: product.measurementUnit,
        minStock: product.minStock,
        safetyStock: product.safetyStock,
        currentStock: 0, // Start with zero stock
        averageCost: product.averageCost,
        sellingPrice: product.sellingPrice,
        barcode: undefined, // Don't duplicate barcode as it should be unique
        supplierId: product.supplierId,
        shelfLife: product.shelfLife,
      };
      
      const newProduct = await ProductService.createProduct(duplicatedData, currentCompany.id);
      setProducts(prev => [...prev, newProduct]);
      toast.success('Produto duplicado com sucesso! Edite conforme necessário.', { id: loadingToast });
      
      // Open the duplicated product for editing
      setEditingProduct(newProduct);
      setShowProductForm(true);
    } catch (error: any) {
      console.error('Error duplicating product:', error);
      toast.error(`Erro ao duplicar produto: ${error.message}`);
    }
  };
  
  const handleBulkImport = async (products: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[]) => {
    try {
      console.log('📦 handleBulkImport called with', products.length, 'products');
      console.log('🏢 Current company:', currentCompany.id, currentCompany.name);
      
      const loadingToast = toast.loading(`Importando ${products.length} produtos...`);
      
      const createdProducts = [];
      for (const productData of products) {
        console.log('➕ Creating product:', productData.name);
        const newProduct = await ProductService.createProduct(productData, currentCompany.id);
        console.log('✅ Product created:', newProduct.id, newProduct.name);
        createdProducts.push(newProduct);
      }
      
      setProducts(prev => [...prev, ...createdProducts]);
      setShowBulkImport(false);
      toast.success(`${createdProducts.length} produtos importados com sucesso!`, { id: loadingToast });
      console.log('🎉 Bulk import completed successfully');
    } catch (error: any) {
      console.error('💥 Error bulk importing products:', error);
      toast.error(`Erro ao importar produtos: ${error.message}`);
      throw error;
    }
  };
  
  const handleImportProductsFromFile = async (importRows: any[]) => {
    try {
      console.log('📄 handleImportProductsFromFile called with', importRows.length, 'rows');
      console.log('🏢 Current company:', currentCompany.id, currentCompany.name);
      
      const loadingToast = toast.loading(`Processando ${importRows.length} produtos...`);
      
      const createdProducts = [];
      const updatedProducts = [];
      
      for (const row of importRows) {
        console.log('📦 Processing product:', row.name);
        
        const productData = {
          name: row.name,
          category: row.category,
          isPerishable: false,
          measurementUnit: row.measurementUnit || 'UN',
          minStock: row.minStock || 5,
          safetyStock: row.safetyStock || 10,
          currentStock: 0, // Starts with 0, must receive stock later
          averageCost: row.costPrice || 0,
          sellingPrice: row.unitPrice || 0,
          barcode: row.barcode || undefined,
          supplierId: undefined,
          shelfLife: undefined,
        };
        
        // Check if we should update an existing product
        if (row.status === 'exists' && row.shouldUpdate && row.existingProduct) {
          console.log('🔄 Updating existing product:', row.existingProduct.id);
          const updated = await ProductService.updateProduct(row.existingProduct.id, productData);
          updatedProducts.push(updated);
        } else if (row.status === 'new') {
          console.log('➕ Creating new product:', row.name);
          const newProduct = await ProductService.createProduct(productData, currentCompany.id);
          createdProducts.push(newProduct);
        }
      }
      
      // Update state
      setProducts(prev => {
        // Remove updated products from list
        let updated = prev.filter(p => !updatedProducts.find(u => u.id === p.id));
        // Add updated products back
        updated = [...updated, ...updatedProducts];
        // Add new products
        return [...updated, ...createdProducts];
      });
      
      const totalImported = createdProducts.length + updatedProducts.length;
      toast.success(
        `${totalImported} produtos processados! ${createdProducts.length} novos, ${updatedProducts.length} atualizados.`,
        { id: loadingToast }
      );
      console.log('🎉 Import from file completed successfully');
    } catch (error: any) {
      console.error('💥 Error importing products from file:', error);
      toast.error(`Erro ao importar produtos: ${error.message}`);
      throw error;
    }
  };
  
  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    
    try {
      const loadingToast = toast.loading('Deletando produto...');
      await ProductService.deleteProduct(deletingProduct.id);
      setProducts(prev => prev.filter(p => p.id !== deletingProduct.id));
      toast.success('Produto deletado com sucesso!', { id: loadingToast });
      setDeletingProduct(null);
    } catch (error: any) {
      console.error('Error deleting product:', error);
      toast.error(`Erro ao deletar produto: ${error.message}`);
    }
  };
  
  const handleStockEntry = async (
    entry: Omit<StockEntry, 'id' | 'entryDate' | 'userId'>,
    newAvgCost: number
  ) => {
    try {
      const loadingToast = toast.loading(editingStockEntry ? 'Atualizando entrada...' : 'Processando entrada de estoque...');
      
      if (editingStockEntry) {
        // Edit Mode
        const { entry: updatedEntry, movement } = await StockService.updateStockEntry(
          editingStockEntry.id,
          entry,
          user?.id || 'unknown'
        );
        
        setStockEntries(prev => prev.map(e => e.id === updatedEntry.id ? updatedEntry : e));
        setMovements(prev => [movement, ...prev]);
        setEditingStockEntry(null);
        toast.success('Entrada atualizada com sucesso!', { id: loadingToast });
      } else {
        // Create Mode
        const entryWithCompany = {
          ...entry,
          companyId: currentCompany.id
        };
  
        const result = await StockService.processStockEntry(entryWithCompany);
        
        setStockEntries(prev => [result.entry, ...prev]);
        setMovements(prev => [result.movement, ...prev]);
        toast.success('Entrada registrada com sucesso!', { id: loadingToast });
      }
      
      // Update local product state (needed for both create and update)
      const updatedProduct = await ProductRepository.findById(entry.productId);
      if (updatedProduct) {
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
      }
      
    } catch (error: any) {
      console.error('Error processing stock entry:', error);
      toast.error(`Erro ao processar entrada: ${error.message}`);
    }
  };

  const handleDeleteStockEntry = async (entryId: string) => {
    if (!confirm('Tem certeza que deseja cancelar esta entrada? Isso reverterá o estoque do produto.')) {
      return;
    }

    const reason = prompt('Por favor, informe o motivo do cancelamento:');
    if (!reason) {
      toast.error('O motivo é obrigatório para cancelar uma entrada.');
      return;
    }

    try {
      const loadingToast = toast.loading('Cancelando entrada de estoque...');
      
      // Get entry to know which product to update
      const entry = stockEntries.find(e => e.id === entryId);
      if (!entry) throw new Error('Entrada não encontrada');

      const movement = await StockService.deleteStockEntry(entryId, user?.id || 'unknown', reason);
      
      // Update UI state
      setStockEntries(prev => prev.filter(e => e.id !== entryId));
      setMovements(prev => [movement, ...prev]); // Add reversal movement
      
      // Update product stock in UI
      const updatedProduct = await ProductRepository.findById(entry.productId);
      if (updatedProduct) {
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
      }

      toast.success('Entrada cancelada com sucesso!', { id: loadingToast });
    } catch (error: any) {
      console.error('Error canceling stock entry:', error);
      toast.error(`Erro ao cancelar entrada: ${error.message}`);
    }
  };
  
  const handleSaveSupplier = async (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>) => {
    try {
      const loadingToast = toast.loading('Cadastrando fornecedor...');
      const newSupplier = await SupplierRepository.create(supplierData, currentCompany.id);
      setSuppliers(prev => [...prev, newSupplier]);
      toast.success('Fornecedor cadastrado com sucesso!', { id: loadingToast });
    } catch (error: any) {
      console.error('Error saving supplier:', error);
      toast.error(`Erro ao salvar fornecedor: ${error.message}`);
      throw error;
    }
  };

  const handleUpdateSupplier = async (id: string, supplierData: Partial<Supplier>) => {
    try {
      const loadingToast = toast.loading('Atualizando fornecedor...');
      const updated = await SupplierRepository.update(id, supplierData);
      setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
      toast.success('Fornecedor atualizado com sucesso!', { id: loadingToast });
    } catch (error: any) {
      console.error('Error updating supplier:', error);
      toast.error(`Erro ao atualizar fornecedor: ${error.message}`);
      throw error;
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    try {
      const loadingToast = toast.loading('Excluindo fornecedor...');
      await SupplierRepository.delete(id);
      setSuppliers(prev => prev.filter(s => s.id !== id));
      toast.success('Fornecedor excluído com sucesso!', { id: loadingToast });
    } catch (error: any) {
      console.error('Error deleting supplier:', error);
      toast.error(`Erro ao excluir fornecedor: ${error.message}`);
      throw error;
    }
  };
  
  const getNavigation = () => {
    if (!user) return [];
    const nav: Array<{ id: Page; name: string; icon: any }> = [];
    if (user.permissions.canViewDashboard) nav.push({ id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard });
    if (user.permissions.canManageProducts) nav.push({ id: 'products', name: 'Produtos', icon: Package });
    if (user.permissions.canManageStock) {
      nav.push({ id: 'stock-entry', name: 'Recebimento', icon: TrendingUp });
      nav.push({ id: 'stock-balance', name: 'Balanço', icon: Barcode });
      nav.push({ id: 'pos', name: 'Venda / Baixa', icon: ShoppingCart });
      nav.push({ id: 'cashier', name: 'PDV', icon: DollarSign });
      nav.push({ id: 'suppliers', name: 'Fornecedores', icon: Truck });
      nav.push({ id: 'integrations', name: 'Integrações', icon: Plug });
    }
    if (user.permissions.canViewReports) {
      nav.push({ id: 'reports', name: 'Relatórios', icon: FileText });
      nav.push({ id: 'costs', name: 'Custos', icon: DollarSign });
    }
    if (user.permissions.canManageUsers) nav.push({ id: 'users', name: 'Usuários', icon: Users });
    return nav;
  };

  const navigation = getNavigation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
         <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Carregando dados da {currentCompany.name}...</p>
         </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col md:flex-row">
      {/* Sidebar for Desktop */}
      <aside className={`bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${sidebarOpen ? 'w-64' : 'w-0 md:w-20'} hidden md:flex flex-col overflow-hidden`}>
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          {sidebarOpen ? (
            <>
              <div className="flex items-center gap-2">
                <img src={logoImg} alt={`${APP_NAME} logo`} className="w-8 h-8 rounded-lg object-contain" />
                <h1 className="text-blue-600 dark:text-blue-400 font-bold text-xl">{APP_NAME}</h1>
              </div>
              <div className="mt-2 flex items-center gap-2 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-600" onClick={() => selectCompany('')}>
                <Building className="w-3 h-3" />
                <span className="truncate text-xs">{currentCompany.name}</span>
              </div>
            </>
          ) : (
            <img src={logoImg} alt="Logo" className="w-8 h-8 rounded-lg object-contain mx-auto" />
          )}
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${currentPage === item.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span>{item.name}</span>}
            </button>
          ))}
        </nav>
        
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          {sidebarOpen ? (
            <>
              <button onClick={toggleTheme} className="w-full flex items-center gap-4 px-4 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                <span>{theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}</span>
              </button>
              <button onClick={logout} className="w-full flex items-center gap-4 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                <LogOut className="w-5 h-5" />
                <span>Sair</span>
              </button>
            </>
          ) : (
            <>
              <button onClick={toggleTheme} className="w-full flex items-center justify-center p-2 text-gray-700 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100 rounded-lg transition-colors" title={theme === 'light' ? 'Modo Escuro' : 'Modo Claro'}>
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              <button onClick={logout} className="w-full flex items-center justify-center p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Sair">
                <LogOut className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between sticky top-0 z-40 md:hidden">
        <div className="flex items-center gap-2">
           <img src={logoImg} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
           <h1 className="text-blue-600 dark:text-blue-400 font-bold text-lg">{APP_NAME}</h1>
        </div>
        
        <div className="flex items-center gap-2">
           <button onClick={toggleTheme} className="p-2 text-gray-400 dark:text-gray-300 hover:text-gray-600 dark:hover:text-gray-100">
             {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
           </button>
           <div className="text-right">
             <p className="text-xs font-bold text-gray-900 dark:text-gray-100 leading-none">{user.fullName.split(' ')[0]}</p>
             <p className="text-[10px] text-gray-500 dark:text-gray-400">{currentCompany.name}</p>
           </div>
           <button onClick={logout} className="p-2 text-gray-400 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400">
             <LogOut className="w-5 h-5" />
           </button>
        </div>
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        {/* Desktop Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 hidden md:flex items-center justify-between sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            {sidebarOpen ? <X className="w-6 h-6 text-gray-600 dark:text-gray-300" /> : <Menu className="w-6 h-6 text-gray-600 dark:text-gray-300" />}
          </button>
          
          <div className="flex items-center gap-4">
             <div className="text-right">
               <p className="text-gray-900 dark:text-gray-100 font-medium">{user.fullName}</p>
               <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
             </div>
          </div>
        </header>
        
        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {currentPage === 'dashboard' && <Dashboard products={products} movements={movements} recipes={[]} />}
          {currentPage === 'products' && user.permissions.canManageProducts && (
            <>
              <ProductList
                products={products}
                onEdit={(p) => setConfirmEdit(p)}
                onDelete={(p) => setDeletingProduct(p)}
                onView={(p) => setViewingProduct(p)}
                onAdd={() => { setEditingProduct(null); setShowQuickProductForm(true); }}
                onDuplicate={handleDuplicateProduct}
                onBulkImport={() => setShowBulkImport(true)}
                onImportFromFile={handleImportProductsFromFile}
                categories={categories}
                canDelete={user.permissions.canDeleteProducts}
              />
              {showProductForm && (
                <ProductForm
                  product={editingProduct}
                  onSave={handleSaveProduct}
                  onCancel={() => { setShowProductForm(false); setEditingProduct(null); }}
                  existingProducts={products}
                  onProductFound={(p) => setEditingProduct(p)}
                />
              )}
              {showQuickProductForm && (
                <QuickProductForm
                  onSave={handleSaveProduct}
                  onCancel={() => setShowQuickProductForm(false)}
                  onSwitchToFull={() => { setShowQuickProductForm(false); setShowProductForm(true); }}
                />
              )}
              {showBulkImport && (
                <BulkImport
                  onImport={handleBulkImport}
                  onClose={() => setShowBulkImport(false)}
                />
              )}
            </>
          )}
          {currentPage === 'stock-entry' && user.permissions.canManageStock && (
            <ErrorBoundary title="Erro na tela de Recebimentos">
              <div className="space-y-8">
              {/* Show create form only if NOT editing, or inside modal? 
                  Better UX: Show create form at top, list below.
                  When editing, scrolling to top or show modal? 
                  Current impl supports reusing form. Let's wrap form in a container to handle "editing mode" display.
              */}
              
              {editingStockEntry ? (
                 <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-bold text-yellow-800">Editando Recebimento</h3>
                    </div>
                    <StockEntryForm 
                      products={products} 
                      suppliers={suppliers} 
                      onSubmit={handleStockEntry} 
                      initialData={editingStockEntry}
                      isEditing={true}
                      onCancelEdit={() => setEditingStockEntry(null)}
                    />
                 </div>
              ) : (
                <StockEntryForm 
                  products={products} 
                  suppliers={suppliers} 
                  onSubmit={handleStockEntry} 
                />
              )}

              <StockEntryList 
                entries={stockEntries}
                products={products}
                suppliers={suppliers}
                onEdit={(entry) => {
                  setEditingStockEntry(entry);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onDelete={handleDeleteStockEntry}
              />
              </div>
            </ErrorBoundary>
          )}
          {currentPage === 'stock-balance' && user.permissions.canManageStock && (
            <StockBalance products={products} onBalanceComplete={() => void refreshData({ silent: true })} />
          )}
          {currentPage === 'suppliers' && user.permissions.canManageStock && (
            <SupplierManagement suppliers={suppliers} onSave={handleSaveSupplier} onUpdate={handleUpdateSupplier} onDelete={handleDeleteSupplier} />
          )}
          {currentPage === 'pos' && (
             <POS
               products={products}
               recipes={[]}
               onSaleComplete={() => void refreshData({ silent: true })}
               onOpenIntegrations={() => setCurrentPage('integrations')}
             />
          )}
          {currentPage === 'integrations' && user.permissions.canManageStock && (
            <IntegrationsPage onSyncComplete={() => void refreshData({ silent: true })} />
          )}
          {currentPage === 'cashier' && (
             <CashRegister />
          )}
          {currentPage === 'reports' && user.permissions.canViewReports && (
             <Reports products={products} movements={movements} recipes={[]} suppliers={suppliers} priceHistory={priceHistory} />
          )}
          {currentPage === 'costs' && user.permissions.canViewReports && (
             <CostDashboard />
          )}
          {currentPage === 'users' && user.permissions.canManageUsers && <UserManagement />}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex md:hidden z-40 h-16 safe-area-bottom">
         {navigation.slice(0, 6).map((item) => {
           const Icon = item.icon;
           return (
             <button
               key={item.id}
               onClick={() => setCurrentPage(item.id)}
               className={`flex-1 flex flex-col items-center justify-center gap-1 ${currentPage === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
             >
               <Icon className="w-5 h-5" />
               <span className="text-[10px] font-medium">{item.name.split(' ')[0]}</span>
             </button>
           );
         })}
         {navigation.length > 6 && (
            <button
              onClick={() => {
                // Find index of current if it's beyond 6
                const currentIndex = navigation.findIndex(n => n.id === currentPage);
                if (currentIndex >= 6) {
                   // Cycle or just show a menu? For simplicity let's just make a toggle to show others
                }
              }}
              className="flex-1 flex flex-col items-center justify-center gap-1 text-gray-500 dark:text-gray-400"
            >
              <Menu className="w-5 h-5" />
              <span className="text-[10px] font-medium">Mais</span>
            </button>
         )}
      </nav>
      
      {/* Modals */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 md:hidden z-40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}
      
      {viewingProduct && <ProductViewModal product={viewingProduct} onClose={() => setViewingProduct(null)} />}
      
      {confirmEdit && (
        <ConfirmModal
          title="Confirmar Edição"
          message={`Tem certeza que deseja editar "${confirmEdit.name}"?`}
          confirmText="Editar"
          cancelText="Cancelar"
          type="info"
          onConfirm={() => { setEditingProduct(confirmEdit); setShowProductForm(true); setCurrentPage('products'); setConfirmEdit(null); }}
          onCancel={() => setConfirmEdit(null)}
        />
      )}
      
      {deletingProduct && (
        <ConfirmModal
          title="Confirmar Exclusão"
          message={`Tem certeza que deseja deletar "${deletingProduct.name}"?`}
          confirmText="Deletar"
          cancelText="Cancelar"
          type="danger"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingProduct(null)}
        />
      )}
      
      {/* Quick Search */}
      <QuickSearch
        isOpen={showQuickSearch}
        onClose={() => setShowQuickSearch(false)}
        products={products}
        onNavigate={(page: string, product?: Product) => {
          setCurrentPage(page as Page);
          if (product) {
            setViewingProduct(product);
          }
        }}
      />
    </div>
  );
}

function AppContent() {
  const { user, loading, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // Debug: log estado de autenticação
  useEffect(() => {
    console.log('🔍 [AppContent] Auth State:', {
      loading,
      hasUser: !!user,
      userRole: user?.role,
      userEmail: user?.email
    });
  }, [loading, user]);

  if (loading) {
    console.log('⏳ [AppContent] Loading auth state...');
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }
  
  if (!user) {
    console.log('❌ [AppContent] No user, showing landing/login');
    if (showAdminLogin) {
      return <AdminLogin onBack={() => setShowAdminLogin(false)} />;
    }
    if (showLogin) {
      return <Login onBackToLanding={() => setShowLogin(false)} />;
    }
    return (
      <LandingPage 
        onLoginClick={() => setShowLogin(true)} 
        onAdminClick={() => setShowAdminLogin(true)}
      />
    );
  }

  // Super Admin view
  if (user.role === 'superadmin') {
    console.log('👑 [AppContent] Super Admin view');
    return <AdminSaaS onLogout={logout} />;
  }
  
  console.log('✅ [AppContent] Regular user, showing MainApp');
  return <MainApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <ThemeProvider>
          <AppContent />
          <Toaster position="top-right" richColors closeButton duration={4000} />
          <PWAUpdateNotifier />
        </ThemeProvider>
      </CompanyProvider>
    </AuthProvider>
  );
}