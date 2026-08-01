import React, { useState, useEffect, useRef } from 'react';
import { Search, ShoppingCart, Trash2, Plus, ArrowRight, Zap, RefreshCw, X, ChevronRight, Camera, AlertTriangle, Package, Plug } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import type { Product } from '../../types';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { StockRepository } from '../../repositories/StockRepository';
import { toast } from 'sonner@2.0.3';
import { SaleReceipt } from './SaleReceipt';
import { ZigSalesBaixa } from './ZigSalesBaixa';
import { useIsMobile } from '../ui/use-mobile';
import { readZigBaixaUiDisabled, ZIG_BAIXA_UI_EVENT } from '../../utils/zigBaixaUi';
import { getBackendUrl } from '../../lib/backendUrl';
import { useFiscalReadiness } from '../../hooks/useFiscalReadiness';
import {
  SaleCheckoutFields,
  type SaleDocumentType,
  type SalePaymentMethod,
} from './SaleCheckoutFields';
import {
  CustomerPicker,
  type SelectedCustomer,
} from '../customers/CustomerPicker';
import {
  cacheOpenRegister,
  enqueueOfflineSale,
  isOfflineNonFiscalAllowed,
  loadCachedProducts,
  loadCachedRegister,
} from '../../offline/offlineSaleQueue';

interface POSProps {
  products: Product[];
  recipes: any[]; // Recipes removed, keeping for compatibility
  onSaleComplete?: () => void | Promise<void>;
  /** Abre a tela Integrações (ZIG e futuras conexões). */
  onOpenIntegrations?: () => void;
}

interface CartItem {
  id: string;
  type: 'product';
  name: string;
  price: number;
  quantity: number;
}

type ManualPaymentMethod = SalePaymentMethod;

function defaultDueDateYmd(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function POS({ products, recipes, onSaleComplete, onOpenIntegrations }: POSProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [showCart, setShowCart] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<{
    items: any[];
    total: number;
    date: Date;
    paymentMethod?: ManualPaymentMethod;
    customerName?: string;
    saleId?: string | null;
    emitNfce?: boolean;
  } | null>(null);
  const [posTab, setPosTab] = useState<'manual' | 'zig'>('manual');
  /** Integrações → ZIG: quando true, não entra na aba ZIG / Baixa (localStorage). */
  const [zigBaixaAccessDisabled, setZigBaixaAccessDisabled] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod>('money');
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [dueDate, setDueDate] = useState(defaultDueDateYmd);
  const [cashReceived, setCashReceived] = useState('');
  const [documentType, setDocumentType] = useState<SaleDocumentType>('non_fiscal');
  const [productLimit, setProductLimit] = useState(48);
  const fiscal = useFiscalReadiness({ refreshKey: isConfirmOpen });
  const emitNfce = documentType === 'nfce';
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  );
  // Offline = venda avulsa sem cliente
  const customerRequired =
    !isOffline &&
    (paymentMethod === 'fiado' || paymentMethod === 'boleto' || emitNfce);

  useEffect(() => {
    if (!fiscal.ready && documentType === 'nfce') setDocumentType('non_fiscal');
  }, [fiscal.ready, documentType]);

  useEffect(() => {
    const applyOfflineCheckout = () => {
      setIsOffline(true);
      setDocumentType('non_fiscal');
      setSelectedCustomer(null);
      setPaymentMethod((m) =>
        m === 'fiado' || m === 'boleto' ? 'money' : m,
      );
    };
    const goOnline = () => setIsOffline(false);
    window.addEventListener('offline', applyOfflineCheckout);
    window.addEventListener('online', goOnline);
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      applyOfflineCheckout();
    }
    return () => {
      window.removeEventListener('offline', applyOfflineCheckout);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  useEffect(() => {
    setProductLimit(48);
  }, [searchTerm]);

  // Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      if (html5QrCodeRef.current.isScanning) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {}
      }
      try {
        html5QrCodeRef.current.clear();
      } catch (e) {}
    }
    setIsScanning(false);
    setIsLoadingCamera(false);
  };

  useEffect(() => {
    if (!currentCompany?.id) return;
    const sync = () => setZigBaixaAccessDisabled(readZigBaixaUiDisabled(currentCompany.id));
    sync();
    const onUi = (e: Event) => {
      const ce = e as CustomEvent<{ companyId?: string }>;
      if (ce.detail?.companyId === currentCompany.id) sync();
    };
    window.addEventListener(ZIG_BAIXA_UI_EVENT, onUi);
    return () => window.removeEventListener(ZIG_BAIXA_UI_EVENT, onUi);
  }, [currentCompany?.id]);

  useEffect(() => {
    if (zigBaixaAccessDisabled && posTab === 'zig') {
      setPosTab('manual');
    }
  }, [zigBaixaAccessDisabled, posTab]);

  const activePosTab: 'manual' | 'zig' =
    zigBaixaAccessDisabled && posTab === 'zig' ? 'manual' : posTab;

  useEffect(() => {
    let mounted = true;
    let timer: any;

    async function startScanner() {
      if (isScanning && mounted) {
        setIsLoadingCamera(true);
        setCameraError(null);
        
        timer = setTimeout(async () => {
          const container = document.getElementById("barcode-reader-pos");
          if (!container) return;

          try {
            // Force permission
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
              stream.getTracks().forEach(track => track.stop());
            } catch (e) {}

            const html5QrCode = new Html5Qrcode("barcode-reader-pos");
            html5QrCodeRef.current = html5QrCode;

            const config = { 
              fps: 10,
              qrbox: (viewWidth: number, viewHeight: number) => {
                const size = Math.min(viewWidth, viewHeight) * 0.7;
                return { width: size, height: size };
              }
            };

            await html5QrCode.start(
              { facingMode: "environment" }, 
              config,
              (decodedText) => {
                handleBarcodeDetected(decodedText);
                // No POS, não paramos o scanner para permitir escaneamento múltiplo
                // mas damos um feedback visual
              },
              () => {}
            ).catch(() => {
               return html5QrCode.start(
                 { facingMode: "user" },
                 config,
                 (text) => { handleBarcodeDetected(text); },
                 () => {}
               );
            });

            if (mounted) setIsLoadingCamera(false);
          } catch (err: any) {
            if (!mounted) return;
            console.error('Scanner error:', err);
            
            let userMessage = "Erro ao acessar câmera.";
            
            // Detect specific errors
            if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
              userMessage = "Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do navegador.";
            } else if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
              userMessage = "Nenhuma câmera encontrada no dispositivo.";
            } else if (err.name === 'NotReadableError') {
              userMessage = "Câmera já está em uso por outro aplicativo.";
            } else if (err.name === 'NotSupportedError' || err.message?.includes('HTTPS')) {
              userMessage = "Scanner de câmera requer conexão HTTPS segura. Use localhost ou HTTPS.";
            }
            
            setCameraError(userMessage);
            toast.error(userMessage, { duration: 5000 });
            setIsScanning(false);
            setIsLoadingCamera(false);
          }
        }, 500);
      }
    }

    startScanner();
    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
    };
  }, [isScanning]);

  const handleBarcodeDetected = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      const salePrice =
        typeof product.sellingPrice === 'number' && product.sellingPrice > 0
          ? product.sellingPrice
          : product.averageCost * 1.5;
      addToCart({
        id: product.id,
        type: 'product',
        name: product.name,
        price: salePrice,
        category: product.category
      });
      toast.success(`Adicionado: ${product.name}`, { duration: 1500 });
    } else {
      toast.error(`Código ${barcode} não cadastrado.`, { duration: 2000 });
    }
  };

  // Calcula o impacto no estoque (explode receitas em ingredientes)
  const calculateStockImpact = () => {
    const impactMap = new Map<string, { name: string; quantity: number; unit: string }>();

    cart.forEach(item => {
      if (item.type === 'product') {
        const product = products.find(p => p.id === item.id);
        if (product) {
          const bundleItems = Array.isArray((product as any).bundleItems) ? (product as any).bundleItems : [];
          if (bundleItems.length > 0) {
            bundleItems.forEach((b: any) => {
              const p2 = products.find(p => p.id === b.productId);
              if (!p2) return;
              const current = impactMap.get(b.productId) || {
                name: p2.name,
                quantity: 0,
                unit: p2.measurementUnit,
              };
              current.quantity += (Number(b.quantity) || 0) * item.quantity;
              impactMap.set(b.productId, current);
            });
          } else {
            const current = impactMap.get(item.id) || { 
              name: product.name, 
              quantity: 0, 
              unit: product.measurementUnit 
            };
            current.quantity += item.quantity;
            impactMap.set(item.id, current);
          }
        }
      } else if (item.type === 'recipe') {
        const recipe = recipes.find(r => r.id === item.id);
        if (recipe && recipe.ingredients) {
          recipe.ingredients.forEach(ing => {
            const product = products.find(p => p.id === ing.productId);
            if (product) {
              const current = impactMap.get(ing.productId) || { 
                name: product.name, 
                quantity: 0, 
                unit: product.measurementUnit 
              };
              current.quantity += (ing.quantity * item.quantity);
              impactMap.set(ing.productId, current);
            }
          });
        }
      }
    });

    return Array.from(impactMap.entries()).map(([id, data]) => ({
      id,
      ...data
    }));
  };

  // Filtragem unificada (Produtos + Receitas)
  const filteredItems = [
    ...recipes.filter(r => r.isActive).map(r => ({
      id: r.id,
      type: 'recipe' as const,
      name: r.name,
      price: r.sellingPrice,
      category: r.category,
      image: r.image
    })),
    ...products.filter(p => !p.isPerishable || p.currentStock > 0).map(p => ({
      id: p.id,
      type: 'product' as const,
      name: p.name,
      // Preço de venda vem do cadastro do produto.
      // Fallback: sugere custo + 50% apenas se não existir preço definido.
      price: (typeof p.sellingPrice === 'number' && p.sellingPrice > 0) ? p.sellingPrice : (p.averageCost * 1.5),
      category: p.category,
      image: p.image
    }))
  ].filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const visibleItems = filteredItems.slice(0, productLimit);
  const hasMoreItems = filteredItems.length > productLimit;

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id && i.type === item.type);
      if (existing) {
        return prev.map(i => i.id === item.id && i.type === item.type 
          ? { ...i, quantity: i.quantity + 1 } 
          : i
        );
      }
      return [...prev, {
        id: item.id,
        type: item.type,
        name: item.name,
        price: item.price,
        quantity: 1
      }];
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const updateQuantity = (index: number, delta: number) => {
    setCart(prev => prev.map((item, i) => {
      if (i === index) {
        const newQtd = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQtd };
      }
      return item;
    }));
  };

  const setQuantityDirect = (index: number, value: string) => {
    if (value === '') {
      setCart(prev => prev.map((item, i) => {
        if (i === index) {
          return { ...item, quantity: 1 };
        }
        return item;
      }));
      return;
    }

    const newQuantity = parseInt(value, 10);
    
    if (isNaN(newQuantity) || newQuantity < 1) {
      return;
    }

    setCart(prev => prev.map((item, i) => {
      if (i === index) {
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const totalAmount = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const isReceivable = paymentMethod === 'fiado' || paymentMethod === 'boleto';
  const cashChange =
    paymentMethod === 'money' && cashReceived
      ? parseFloat(cashReceived) - totalAmount
      : 0;

  const resetCheckoutForm = () => {
    setPaymentMethod('money');
    setSelectedCustomer(null);
    setDueDate(defaultDueDateYmd());
    setCashReceived('');
    setDocumentType('non_fiscal');
  };

  const handleCheckout = async () => {
    if (cart.length === 0 || !currentCompany) return;

    const offline = isOffline || (typeof navigator !== 'undefined' && !navigator.onLine);
    if (offline) {
      const gate = isOfflineNonFiscalAllowed({
        emitNfce: false,
        paymentMethod,
        mixedMode: false,
        hasReceivable: false,
      });
      if (!gate.ok) {
        toast.error(gate.reason);
        return;
      }
    }

    if (!offline && customerRequired && !selectedCustomer) {
      toast.error('Selecione ou cadastre o cliente (nome + CPF/CNPJ)');
      return;
    }
    if (isReceivable && !dueDate.trim()) {
      toast.error('Informe a data de vencimento');
      return;
    }
    if (paymentMethod === 'money' && cashReceived && cashChange < 0) {
      toast.error('Valor recebido insuficiente');
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading(
      offline ? 'Registrando venda offline…' : 'Processando venda e baixando estoque...',
    );

    try {
      const checkoutId = crypto.randomUUID();

      if (offline) {
        const cachedReg = await loadCachedRegister(currentCompany.id);
        const registerId = cachedReg?.id ? String(cachedReg.id) : null;
        if (!registerId) {
          throw new Error(
            'Sem caixa em cache. Com internet: abra o Caixa (ou faça uma venda online) e tente de novo offline.',
          );
        }

        const catalog = (await loadCachedProducts(currentCompany.id)) || products;
        for (const item of cart) {
          if (item.type !== 'product') continue;
          const product = catalog.find((p) => p.id === item.id);
          const stock = Number(product?.currentStock) || 0;
          if (stock < item.quantity) {
            throw new Error(`Estoque insuficiente (local) para «${item.name}»`);
          }
        }

        const paymentDetails: Record<string, unknown> = { emitNfce: false };
        if (paymentMethod === 'money') {
          paymentDetails.cashReceived = cashReceived
            ? parseFloat(cashReceived)
            : totalAmount;
          paymentDetails.change = cashReceived ? cashChange : 0;
        }

        const salePayload = {
          registerId,
          clientRequestId: checkoutId,
          items: cart.map((item) => ({
            productId: item.type === 'product' ? item.id : undefined,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
          })),
          total: totalAmount,
          paymentMethod,
          paymentDetails,
        };

        const stockItems = cart
          .filter((item) => item.type === 'product')
          .map((item) => {
            const product = catalog.find((p) => p.id === item.id);
            return {
              productId: item.id,
              quantity: item.quantity,
              name: item.name,
              bundleItems: product?.bundleItems,
            };
          });

        const queued = await enqueueOfflineSale({
          companyId: currentCompany.id,
          registerId,
          products: catalog,
          payload: salePayload,
          stockItems,
          receiptItems: cart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
        });

        toast.success('Venda offline registrada (cupom não fiscal). Sincroniza ao reconectar.', {
          id: toastId,
        });
        setLastSale({
          items: cart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            total: item.price * item.quantity,
          })),
          total: totalAmount,
          date: new Date(),
          paymentMethod,
          customerName: selectedCustomer?.name,
          saleId: queued.id,
          emitNfce: false,
        });
        setCart([]);
        setIsConfirmOpen(false);
        resetCheckoutForm();
        setShowReceipt(true);
        return;
      }
      /**
       * Regra de consistência financeira (custos/receita):
       * - Receita (dashboard) vem de `sales`
       * - CMV vem de `stock_movements` com `type='venda'`
       *
       * O POS manual historicamente só baixava estoque (movimento `saida`) e não gravava `sales`,
       * então o mês ficava com CMV/receita divergentes. Aqui garantimos que existe um caixa aberto
       * (saldo inicial 0 se necessário) e gravamos a venda em `sales`.
       */
      let saleId: string | null = null;
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${user?.accessToken || ''}`,
          'X-Custom-Token': user?.accessToken || '',
          'Content-Type': 'application/json',
          'X-Company-Id': currentCompany.id,
        };

        // 1) Get current register (or open one with 0 initial balance)
        const curRes = await fetch(
          getBackendUrl('/cashier/current'),
          { headers },
        );
        const curData = await curRes.json().catch(() => ({}));
        let registerId: string | null = curData?.register?.id ?? null;
        let registerForCache: Record<string, unknown> | null = curData?.register ?? null;

        if (!registerId) {
          const openRes = await fetch(
            getBackendUrl('/cashier/open'),
            {
              method: 'POST',
              headers,
              body: JSON.stringify({
                initialBalance: 0,
                cashierId: user?.id,
                cashierName: user?.fullName,
              }),
            },
          );
          const openData = await openRes.json().catch(() => ({}));
          registerId = openData?.register?.id ?? null;
          registerForCache = openData?.register ?? null;
        }

        // Garante cache para vendas offline posteriores (Venda Manual não passa pelo Caixa)
        if (registerForCache?.id) {
          void cacheOpenRegister(currentCompany.id, registerForCache);
        } else if (registerId) {
          void cacheOpenRegister(currentCompany.id, {
            id: registerId,
            status: 'open',
            companyId: currentCompany.id,
          });
        }

        if (registerId) {
          const paymentDetails: Record<string, unknown> = {
            emitNfce: !!emitNfce,
          };
          if (selectedCustomer) {
            paymentDetails.customerId = selectedCustomer.id;
            paymentDetails.customerName = selectedCustomer.name;
            paymentDetails.customerDocument = selectedCustomer.documentDigits;
            paymentDetails.customerDocumentType = selectedCustomer.documentType;
          }
          if (paymentMethod === 'money') {
            paymentDetails.cashReceived = cashReceived
              ? parseFloat(cashReceived)
              : totalAmount;
            paymentDetails.change = cashReceived ? cashChange : 0;
          }
          if (isReceivable) {
            paymentDetails.dueDate = dueDate.trim();
          }

          const salePayload = {
            registerId,
            clientRequestId: checkoutId,
            items: cart.map((item) => ({
              productId: item.type === 'product' ? item.id : undefined,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
            })),
            total: totalAmount,
            paymentMethod,
            paymentDetails,
          };

          const saleRes = await fetch(
            getBackendUrl('/cashier/sale'),
            {
              method: 'POST',
              headers,
              body: JSON.stringify(salePayload),
            },
          );
          const saleData = await saleRes.json().catch(() => ({}));
          if (!saleRes.ok || saleData.error) {
            throw new Error(saleData.error || `Falha ao registrar venda (HTTP ${saleRes.status})`);
          }
          saleId = saleData?.sale?.id ?? null;
          if (!saleId) {
            throw new Error('Venda não retornou ID do servidor');
          }
        } else {
          throw new Error('Não foi possível abrir ou localizar o caixa para registrar a venda');
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[POS] Falha ao registrar venda em sales:', e);
        toast.error(msg, { id: toastId });
        setIsProcessing(false);
        return;
      }

      const customerNote = selectedCustomer
        ? ` · Cliente: ${selectedCustomer.name} (${selectedCustomer.documentFormatted})`
        : '';

      // Processa cada item do carrinho sequencialmente
      for (const item of cart) {
        if (item.type === 'product') {
          const product = products.find((p) => p.id === item.id);
          const bundleItems = product && Array.isArray((product as any).bundleItems) ? (product as any).bundleItems : [];

          if (bundleItems.length > 0) {
            // Produto composto (combo/promo): baixa itens do estoque (não baixa o "pai")
            for (const b of bundleItems) {
              const qtyToDeduct = (Number(b.quantity) || 0) * item.quantity;
              if (!b.productId || qtyToDeduct <= 0) continue;

              const source = `sale:${saleId ?? checkoutId}:${b.productId}:combo`;
              const notes = `Venda Combo: ${item.quantity}x ${item.name}${saleId ? ` · Ref. venda ${saleId}` : ''}${customerNote}`;
              await StockRepository.deductStockOnce({
                companyId: currentCompany.id,
                productId: b.productId,
                quantity: qtyToDeduct,
                source,
                notes,
                movementType: 'venda',
              });
            }
          } else {
            // Venda direta de produto
            const source = `sale:${saleId ?? checkoutId}:${item.id}:direct`;
            const notes = `Venda Manual: ${item.quantity}x ${item.name}${saleId ? ` · Ref. venda ${saleId}` : ''}${customerNote}`;
            await StockRepository.deductStockOnce({
              companyId: currentCompany.id,
              productId: item.id,
              quantity: item.quantity,
              source,
              notes,
              movementType: 'venda',
            });
          }
        } else if (item.type === 'recipe') {
          // Venda de receita (baixa ingredientes)
          const recipe = recipes.find(r => r.id === item.id);
          if (recipe && recipe.ingredients) {
            for (const ingredient of recipe.ingredients) {
              const qtyToDeduct = ingredient.quantity * item.quantity;

              const source = `sale:${saleId ?? checkoutId}:${ingredient.productId}:recipe`;
              const notes = `Venda Receita: ${item.quantity}x ${recipe.name}${saleId ? ` · Ref. venda ${saleId}` : ''}${customerNote}`;
              await StockRepository.deductStockOnce({
                companyId: currentCompany.id,
                productId: ingredient.productId,
                quantity: qtyToDeduct,
                source,
                notes,
                movementType: 'venda',
              });
            }
          }
        }
      }

      toast.success(
        emitNfce
          ? 'Venda registrada — autorizando NFC-e...'
          : 'Venda registrada com sucesso!',
        { id: toastId },
      );
      setLastSale({
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.price,
          total: item.price * item.quantity
        })),
        total: totalAmount,
        date: new Date(),
        paymentMethod,
        customerName: selectedCustomer?.name,
        saleId,
        emitNfce: !!emitNfce,
      });
      setCart([]);
      setIsConfirmOpen(false);
      resetCheckoutForm();
      setShowReceipt(true);
      
      // Atualiza os dados se a função callback foi fornecida
      if (onSaleComplete) {
        await onSaleComplete();
      }

    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(`Erro ao processar venda: ${error.message}`, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50 pb-0">
      {/* Header da Página */}
      <div className="bg-white border-b px-4 md:px-6 py-3 md:py-4 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center shrink-0 z-30">
        <h1 className="text-lg md:text-2xl font-bold text-gray-800 shrink-0">Ponto de Venda</h1>
        <div className="flex flex-wrap items-center gap-2 justify-end">
          <div
            className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
            role="tablist"
            aria-label="Modo do ponto de venda"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activePosTab === 'manual'}
              onClick={() => setPosTab('manual')}
              className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors ${
                activePosTab === 'manual'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Venda manual
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activePosTab === 'zig'}
              aria-disabled={zigBaixaAccessDisabled}
              title={
                zigBaixaAccessDisabled
                  ? 'Desativado em Integrações → ZIG. Ative a integração para abrir esta aba.'
                  : undefined
              }
              onClick={() => {
                if (zigBaixaAccessDisabled) {
                  toast.info('ZIG / Baixa está desativado. Ative em Integrações → ZIG.');
                  return;
                }
                setPosTab('zig');
              }}
              className={`px-3 py-1.5 rounded-md text-xs md:text-sm font-medium transition-colors ${
                zigBaixaAccessDisabled
                  ? 'text-gray-400 cursor-not-allowed opacity-60'
                  : activePosTab === 'zig'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              ZIG / Baixa
            </button>
          </div>
          {onOpenIntegrations && (
            <button
              type="button"
              onClick={onOpenIntegrations}
              className="flex items-center gap-1.5 text-xs md:text-sm font-medium text-pink-600 hover:text-pink-700 whitespace-nowrap shrink-0"
            >
              <Plug className="w-4 h-4" aria-hidden />
              Integrações
            </button>
          )}
        </div>
      </div>

      {activePosTab === 'zig' ? (
        <div className="flex-1 overflow-y-auto min-h-0 p-4 md:p-6">
          <ZigSalesBaixa onSyncComplete={onSaleComplete} />
        </div>
      ) : (
      <>
      <div className="flex flex-1 min-h-0 overflow-hidden relative">
          {/* Coluna da Esquerda: Catálogo */}
          <div className={`flex-1 min-h-0 p-4 md:p-6 overflow-y-auto pb-28 md:pb-6 ${showCart && isMobile ? 'hidden' : 'block'}`}>
            <div className="mb-4 md:mb-6 sticky top-0 bg-gray-50 pb-2 z-10 space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Buscar produto ou receita..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm text-sm"
                  />
                </div>
                <button
                  onClick={() => {
                    if (isScanning) stopScanner();
                    else {
                      setCameraError(null);
                      setIsScanning(true);
                    }
                  }}
                  className={`p-3 rounded-xl transition-all shadow-md flex items-center justify-center ${
                    isScanning ? 'bg-red-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                  title="Escanear Código de Barras"
                >
                  {isScanning ? <X className="w-6 h-6" /> : <Camera className="w-6 h-6" />}
                </button>
              </div>

              {isScanning && (
                <div className="bg-white p-3 rounded-2xl border-2 border-blue-500 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-bold text-blue-900 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
                      Scanner de Venda Ativo
                    </h3>
                    {isLoadingCamera && <RefreshCw className="w-3 h-3 animate-spin text-blue-500" />}
                  </div>
                  <div className="relative bg-black rounded-lg overflow-hidden h-48">
                    <div id="barcode-reader-pos" className="w-full h-full"></div>
                    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                       <div className="w-32 h-32 border border-white/20 rounded-2xl flex items-center justify-center relative overflow-hidden">
                          <div className="w-full h-0.5 bg-red-500 absolute top-1/2 left-0 -translate-y-1/2 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-[scan_2s_ease-in-out_infinite]"></div>
                       </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-center text-gray-400 mt-2">Aponte para o código. O scanner permanece ativo para múltiplos itens.</p>
                </div>
              )}

              {cameraError && (
                <div className="bg-red-50 border border-red-200 p-3 rounded-xl text-red-800 text-xs">
                  <div className="flex gap-2 items-center">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span className="font-bold">{cameraError}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
              {visibleItems.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  onClick={() => addToCart(item)}
                  className="bg-white p-3 md:p-4 rounded-xl border border-gray-200 hover:border-blue-500 hover:shadow-md transition-all text-left flex flex-col h-full group active:scale-95"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[8px] md:text-[10px] px-1.5 py-0.5 rounded-full uppercase font-bold tracking-wider ${
                      item.type === 'recipe' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {item.type === 'recipe' ? 'Rec' : 'Prod'}
                    </span>
                    <span className="font-bold text-gray-900 text-xs md:text-sm">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                    </span>
                  </div>
                  
                  <h3 className="font-medium text-gray-800 text-xs md:text-sm line-clamp-2 mb-1 group-hover:text-blue-600 transition-colors">
                    {item.name}
                  </h3>
                  <p className="text-[10px] text-gray-400 mt-auto truncate">{item.category}</p>
                </button>
              ))}
            </div>

            {hasMoreItems && (
              <div className="flex justify-center py-4">
                <button
                  type="button"
                  onClick={() => setProductLimit((n) => n + 48)}
                  className="px-4 py-2 rounded-xl border border-gray-300 text-sm font-bold text-gray-700 hover:bg-gray-100"
                >
                  Carregar mais ({filteredItems.length - productLimit} restantes)
                </button>
              </div>
            )}
          </div>

          {/* Coluna da Direita: Carrinho */}
          <div className={`${isMobile ? (showCart ? 'fixed inset-0 bg-white z-50 flex flex-col' : 'hidden') : 'w-80 lg:w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl z-20 min-h-0'}`}>
            <div className="p-4 md:p-6 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white z-10">
              <h2 className="font-bold text-lg flex items-center gap-2">
                {isMobile && (
                   <button onClick={() => setShowCart(false)} className="p-1 -ml-1 hover:bg-gray-100 rounded-full mr-1">
                      <X className="w-5 h-5 text-gray-500" />
                   </button>
                )}
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                Carrinho
              </h2>
              <span className="bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-xs font-bold">
                {cart.length} itens
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((item, index) => (
                <div key={index} className="flex gap-3 bg-gray-50 p-3 rounded-xl group border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-800 text-xs md:text-sm truncate" title={item.name}>
                      {item.name}
                    </p>
                    <div className="text-[10px] md:text-xs text-gray-500 flex items-center gap-1 mt-1">
                      {item.type === 'recipe' ? <Zap className="w-3 h-3 text-purple-500" /> : <Package className="w-3 h-3 text-blue-500" />}
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => updateQuantity(index, -1)}
                      className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-100 font-bold"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => setQuantityDirect(index, e.target.value)}
                      min="1"
                      style={{
                        backgroundColor: 'white !important' as any,
                        color: '#111827 !important' as any,
                        border: '1px solid #e5e7eb !important' as any,
                        borderRadius: '0.5rem !important' as any,
                        padding: '0.25rem !important' as any,
                        fontSize: '0.75rem !important' as any,
                        fontWeight: '700 !important' as any,
                        width: '2.5rem !important' as any,
                        textAlign: 'center !important' as any,
                      }}
                      className="w-10 text-center text-xs font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <button 
                      onClick={() => updateQuantity(index, 1)}
                      className="w-7 h-7 flex items-center justify-center bg-white border border-gray-200 rounded-lg hover:bg-gray-100 font-bold"
                    >
                      +
                    </button>
                  </div>

                  <button 
                    onClick={() => removeFromCart(index)}
                    className="text-gray-400 hover:text-red-500 p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 text-center px-6">
                  <ShoppingCart className="w-12 h-12 mb-3 opacity-10" />
                  <p className="text-sm font-medium">Seu carrinho está vazio.</p>
                </div>
              )}
            </div>

            <div className="p-4 md:p-6 bg-gray-50 border-t border-gray-200 shrink-0">
              <div className="flex justify-between items-end mb-4">
                <span className="text-gray-500 text-sm font-medium">Total</span>
                <span className="text-xl md:text-2xl font-bold text-gray-900">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                </span>
              </div>

              <button
                onClick={() => {
                  fiscal.refresh();
                  setIsConfirmOpen(true);
                }}
                disabled={cart.length === 0 || isProcessing}
                className="w-full bg-blue-600 text-white py-3 md:py-4 rounded-xl font-bold text-base md:text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-blue-100 transition-all active:scale-95"
              >
                Continuar
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

      {/* Barra fixa mobile — Continuar acima do menu inferior */}
      {isMobile && !showCart && cart.length > 0 && !isConfirmOpen && (
        <div className="fixed bottom-16 inset-x-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md p-3 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] md:bottom-0 md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCart(true)}
              className="shrink-0 w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center relative"
              aria-label="Abrir carrinho"
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center">
                {cart.length}
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500 truncate">{cart.length} itens</p>
              <p className="text-lg font-black text-gray-900 tabular-nums">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                fiscal.refresh();
                setIsConfirmOpen(true);
              }}
              className="shrink-0 px-5 py-3.5 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2"
            >
              Continuar
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
              <h3 className="text-xl font-bold text-gray-900">Confirmar venda</h3>
              <button 
                onClick={() => !isProcessing && setIsConfirmOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-2 rounded-full hover:bg-gray-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 min-h-0 space-y-5">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 flex justify-between items-center">
                <span className="text-blue-800 font-medium">Total</span>
                <span className="font-bold text-blue-900 text-xl">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalAmount)}
                </span>
              </div>

              <SaleCheckoutFields
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                documentType={documentType}
                onDocumentTypeChange={setDocumentType}
                fiscalReady={fiscal.ready}
                fiscalConfigComplete={fiscal.configComplete}
                fiscalLoading={fiscal.loading}
                fiscalReason={fiscal.reasons[0]}
                fiscalReasons={fiscal.reasons}
                onOpenFiscalConfig={onOpenIntegrations}
              >
                <CustomerPicker
                  value={selectedCustomer}
                  onChange={setSelectedCustomer}
                  required={customerRequired}
                  allowWalkInWithoutCustomer={isOffline}
                  hint={
                    isOffline
                      ? 'Venda avulsa offline — sem cliente'
                      : customerRequired
                        ? 'Obrigatório para fiado, boleto e NFC-e (nome + CPF/CNPJ)'
                        : 'Opcional — pode vender sem cliente'
                  }
                />

                {paymentMethod === 'money' && (
                  <div className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">Valor recebido (opcional)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      placeholder={totalAmount.toFixed(2)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                    {cashReceived !== '' && (
                      <p className={`text-sm font-semibold ${cashChange < 0 ? 'text-red-600' : 'text-green-700'}`}>
                        {cashChange < 0 ? 'Faltam' : 'Troco'}:{' '}
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                          Math.abs(cashChange),
                        )}
                      </p>
                    )}
                  </div>
                )}

                {isReceivable && (
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-800">
                      {paymentMethod === 'boleto' ? 'Boleto — contas a receber' : 'A prazo — contas a receber'}
                    </p>
                    <label className="block text-xs font-bold text-gray-500 uppercase">Vencimento</label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500">
                      Gera título em Contas a receber (não entra no caixa agora).
                    </p>
                  </div>
                )}
              </SaleCheckoutFields>

              <div>
                <p className="text-gray-600 mb-2 text-sm font-medium">Itens a baixar do estoque</p>
                <div className="bg-gray-50 rounded-lg border border-gray-200 divide-y divide-gray-200 max-h-40 overflow-y-auto">
                  {calculateStockImpact().map((item) => (
                    <div key={item.id} className="p-3 flex justify-between items-center">
                      <span className="font-medium text-gray-800 text-sm">{item.name}</span>
                      <span className="text-sm font-bold text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100">
                        -{Number(item.quantity).toLocaleString('pt-BR', { maximumFractionDigits: 3 })} {item.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3 shrink-0">
              <button
                onClick={() => setIsConfirmOpen(false)}
                className="flex-1 px-4 py-3 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isProcessing}
              >
                Cancelar
              </button>
              <button
                onClick={handleCheckout}
                disabled={
                  isProcessing ||
                  (customerRequired && !selectedCustomer) ||
                  (isReceivable && !dueDate.trim()) ||
                  (paymentMethod === 'money' && cashReceived !== '' && cashChange < 0)
                }
                className="flex-1 px-4 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    Finalizar Venda
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Recibo */}
      {showReceipt && lastSale && (
        <SaleReceipt
          items={lastSale.items}
          total={lastSale.total}
          saleDate={lastSale.date}
          paymentMethod={lastSale.paymentMethod}
          customerName={lastSale.customerName}
          saleId={lastSale.saleId}
          emitNfce={lastSale.emitNfce}
          onClose={() => setShowReceipt(false)}
        />
      )}
      </>
      )}
    </div>
  );
}