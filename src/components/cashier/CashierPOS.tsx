import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Camera,
  X,
  Package,
  AlertTriangle,
  CheckCircle2,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import type { Product } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { getBackendUrl } from '../../lib/backendUrl';
import { ProductService } from '../../services/ProductService';
import { StockRepository } from '../../repositories/StockRepository';
import { toast } from 'sonner@2.0.3';
import { formatCurrency, formatQuantity } from '../../utils/calculations';
import { useFiscalReadiness } from '../../hooks/useFiscalReadiness';
import {
  SaleCheckoutFields,
  type SaleDocumentType,
  type SalePaymentMethod,
} from '../sales/SaleCheckoutFields';
import { MixedPaymentEditor } from '../sales/MixedPaymentEditor';
import {
  CustomerPicker,
  type SelectedCustomer,
} from '../customers/CustomerPicker';
import {
  buildPricedSaleItems,
  cartFinalTotal,
  lineNet,
  moneyPortion,
  newPaymentLineId,
  paymentsSum,
  roundMoney,
  type PaymentSplitLine,
} from '../../utils/salePricing';
import {
  cacheOpenRegister,
  checkOfflineStockAvailability,
  enqueueOfflineSale,
  isOfflineNonFiscalAllowed,
  loadCachedProducts,
  persistCatalogBaseline,
  resolveOfflineCatalog,
} from '../../offline/offlineSaleQueue';

interface CashierPOSProps {
  register: { id: string; companyId?: string; [key: string]: unknown };
  onSaleComplete: (saleData: any) => void | Promise<void>;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  /** Desconto em R$ na linha. */
  discount: number;
  product: Product;
}

export function CashierPOS({ register, onSaleComplete }: CashierPOSProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('money');
  const [cashReceived, setCashReceived] = useState('');
  const [mixedMode, setMixedMode] = useState(false);
  const [paymentLines, setPaymentLines] = useState<PaymentSplitLine[]>([
    { id: newPaymentLineId(), method: 'money', amount: 0 },
  ]);
  const [cartDiscountInput, setCartDiscountInput] = useState('');
  const [cartDiscountType, setCartDiscountType] = useState<'value' | 'percent'>('value');
  const [fiadoDueDate, setFiadoDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [selectedCustomer, setSelectedCustomer] = useState<SelectedCustomer | null>(null);
  const [documentType, setDocumentType] = useState<SaleDocumentType>('non_fiscal');
  const [productLimit, setProductLimit] = useState(48);
  const fiscal = useFiscalReadiness({ refreshKey: showPayment });
  const emitNfce = documentType === 'nfce';
  const emitNfe = documentType === 'nfe';
  const pricing = cartFinalTotal(
    cart,
    parseFloat(cartDiscountInput) || 0,
    cartDiscountType,
  );
  const mixedHasReceivable = paymentLines.some(
    (l) => l.method === 'fiado' || l.method === 'boleto',
  );
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== 'undefined' && !navigator.onLine,
  );
  // Offline = venda avulsa: nunca exige cliente (NFC-e/NF-e/fiado ficam bloqueados)
  const customerRequired =
    !isOffline &&
    (emitNfce ||
      emitNfe ||
      (mixedMode
        ? mixedHasReceivable
        : paymentMethod === 'fiado' || paymentMethod === 'boleto'));

  useEffect(() => {
    if (!fiscal.ready && (documentType === 'nfce' || documentType === 'nfe')) {
      setDocumentType('non_fiscal');
    }
  }, [fiscal.ready, documentType]);

  // Mantém caixa aberto em cache para Venda Manual / fila offline
  useEffect(() => {
    const companyId = currentCompany?.id || (register.companyId as string | undefined);
    if (companyId && register?.id) {
      void cacheOpenRegister(companyId, register as Record<string, unknown>);
    }
  }, [currentCompany?.id, register]);

  useEffect(() => {
    const applyOfflineCheckout = () => {
      setIsOffline(true);
      setDocumentType('non_fiscal');
      setMixedMode(false);
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
  }, [searchTerm, currentCompany?.id]);

  useEffect(() => {
    loadProducts();
  }, [currentCompany]);

  useEffect(() => {
    if (isScanning) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isScanning]);

  // Atalhos: F2 busca · F4/Ctrl+Enter checkout · Esc fecha modal · F9 limpa carrinho
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const typing =
        tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable;

      if (e.key === 'Escape') {
        if (showPayment && !isProcessing) {
          e.preventDefault();
          setShowPayment(false);
        } else if (isScanning) {
          e.preventDefault();
          setIsScanning(false);
        }
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === 'F4' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
        e.preventDefault();
        if (showPayment) {
          if (!isProcessing) void handleFinalizeSale();
        } else if (cart.length > 0) {
          openCheckout();
        }
        return;
      }

      if (e.key === 'F9' && !typing && !showPayment) {
        e.preventDefault();
        if (cart.length > 0 && confirm('Limpar o carrinho?')) clearCart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPayment, isProcessing, cart.length, isScanning]);

  const loadProducts = async () => {
    try {
      if (!currentCompany) return;

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const catalog = await resolveOfflineCatalog(currentCompany.id, []);
        if (catalog.length) {
          setProducts(catalog);
          toast.message('Produtos do cache local (offline)');
          return;
        }
        toast.error('Sem internet e sem catálogo em cache. Conecte-se para carregar produtos.');
        return;
      }

      const allProducts = await ProductService.getAllProducts(currentCompany.id);
      const catalog = await persistCatalogBaseline(currentCompany.id, allProducts);
      setProducts(catalog);
    } catch (error) {
      console.error('Error loading products:', error);
      try {
        if (currentCompany?.id) {
          const catalog = await resolveOfflineCatalog(currentCompany.id, products);
          if (catalog.length) {
            setProducts(catalog);
            toast.message('Usando catálogo em cache (falha de rede)');
            return;
          }
        }
      } catch {
        /* ignore */
      }
      toast.error('Erro ao carregar produtos');
    }
  };

  const startScanner = async () => {
    setIsLoadingCamera(true);
    setCameraError(null);
    
    setTimeout(async () => {
      const container = document.getElementById('cashier-barcode-reader');
      if (!container) return;

      try {
        const html5QrCode = new Html5Qrcode('cashier-barcode-reader');
        html5QrCodeRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: (viewWidth: number, viewHeight: number) => {
            const size = Math.min(viewWidth, viewHeight) * 0.7;
            return { width: size, height: size };
          },
        };

        await html5QrCode.start(
          { facingMode: 'environment' },
          config,
          (decodedText) => {
            handleBarcodeDetected(decodedText);
          }
        );

        setIsLoadingCamera(false);
      } catch (error: any) {
        console.error('Scanner error:', error);
        
        let errorMessage = 'Erro ao iniciar câmera';
        
        // Detect specific errors
        if (error.name === 'NotAllowedError' || error.message?.includes('Permission denied')) {
          errorMessage = 'Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do navegador.';
        } else if (error.name === 'NotFoundError' || error.message?.includes('not found')) {
          errorMessage = 'Nenhuma câmera encontrada no dispositivo.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Câmera já está em uso por outro aplicativo.';
        } else if (error.name === 'OverconstrainedError') {
          errorMessage = 'Câmera traseira não disponível. Tentando câmera frontal...';
          
          // Try front camera as fallback
          try {
            await html5QrCode.start(
              { facingMode: 'user' },
              config,
              (decodedText) => {
                handleBarcodeDetected(decodedText);
              }
            );
            setIsLoadingCamera(false);
            toast.success('Scanner iniciado com câmera frontal');
            return;
          } catch (fallbackError) {
            console.error('Front camera also failed:', fallbackError);
            errorMessage = 'Nenhuma câmera disponível funciona.';
          }
        } else if (error.name === 'NotSupportedError' || error.message?.includes('HTTPS')) {
          errorMessage = 'Scanner de câmera requer conexão HTTPS segura. Use localhost ou HTTPS.';
        }
        
        setCameraError(errorMessage);
        toast.error(errorMessage, { duration: 5000 });
        setIsLoadingCamera(false);
        setIsScanning(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (e) {
        console.error('Error stopping scanner:', e);
      }
    }
    setIsLoadingCamera(false);
  };

  const handleBarcodeDetected = (barcode: string) => {
    const product = products.find(
      (p) => p.barcode === barcode
    );

    if (product) {
      addToCart(product);
      toast.success(`${product.name} adicionado!`);
    } else {
      toast.error('Produto não encontrado');
    }
  };

  const addToCart = (product: Product) => {
    // Check stock
    if (product.currentStock <= 0) {
      toast.error('Produto sem estoque');
      return;
    }

    const existingItem = cart.find((item) => item.id === product.id);

    if (existingItem) {
      if (existingItem.quantity >= product.currentStock) {
        toast.error('Estoque insuficiente');
        return;
      }
      
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          id: product.id,
          name: product.name,
          price: product.sellingPrice || product.averageCost || 0,
          quantity: 1,
          discount: 0,
          product,
        },
      ]);
    }
  };

  const setItemDiscount = (itemId: string, value: string) => {
    const n = parseFloat(value);
    const disc = Number.isFinite(n) && n > 0 ? n : 0;
    setCart((prev) =>
      prev.map((i) => {
        if (i.id !== itemId) return i;
        const max = roundMoney(i.price * i.quantity);
        return { ...i, discount: Math.min(max, roundMoney(disc)) };
      }),
    );
  };

  const updateQuantity = (itemId: string, delta: number) => {
    const item = cart.find((i) => i.id === itemId);
    if (!item) return;

    const newQuantity = item.quantity + delta;

    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    if (newQuantity > item.product.currentStock) {
      toast.error('Estoque insuficiente');
      return;
    }

    setCart(
      cart.map((i) =>
        i.id === itemId ? { ...i, quantity: newQuantity } : i
      )
    );
  };

  const setQuantityDirect = (itemId: string, value: string) => {
    const item = cart.find((i) => i.id === itemId);
    if (!item) return;

    // Allow empty input
    if (value === '') {
      setCart(
        cart.map((i) =>
          i.id === itemId ? { ...i, quantity: 0 } : i
        )
      );
      return;
    }

    const newQuantity = parseInt(value, 10);

    // Validate input
    if (isNaN(newQuantity) || newQuantity < 0) {
      return;
    }

    if (newQuantity === 0) {
      removeFromCart(itemId);
      return;
    }

    if (newQuantity > item.product.currentStock) {
      toast.error('Estoque insuficiente');
      return;
    }

    setCart(
      cart.map((i) =>
        i.id === itemId ? { ...i, quantity: newQuantity } : i
      )
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((item) => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
  };

  const calculateTotal = () => pricing.total;

  const calculateChange = () => {
    const cash = parseFloat(cashReceived || '0') || 0;
    if (mixedMode) {
      const moneyAmt = moneyPortion(paymentLines);
      if (moneyAmt <= 0) return 0;
      return roundMoney(cash - moneyAmt);
    }
    if (paymentMethod !== 'money' || !cashReceived) return 0;
    return roundMoney(cash - pricing.total);
  };

  const handleFinalizeSale = async () => {
    if (cart.length === 0) {
      toast.error('Carrinho vazio');
      return;
    }

    const offline = isOffline || (typeof navigator !== 'undefined' && !navigator.onLine);
    if (offline) {
      const gate = isOfflineNonFiscalAllowed({
        emitNfce: false,
        paymentMethod,
        mixedMode,
        hasReceivable: false,
      });
      if (!gate.ok) {
        toast.error(gate.reason);
        return;
      }
    }

    const finalTotal = pricing.total;
    if (finalTotal <= 0) {
      toast.error('Total da venda inválido');
      return;
    }

    if (mixedMode) {
      const paid = paymentsSum(paymentLines);
      if (Math.abs(paid - finalTotal) > 0.009) {
        toast.error(`Pagamento misto deve somar ${formatCurrency(finalTotal)}`);
        return;
      }
      if (moneyPortion(paymentLines) > 0 && calculateChange() < 0) {
        toast.error('Valor recebido em dinheiro insuficiente');
        return;
      }
      if (
        paymentLines.some((l) => l.method === 'fiado' || l.method === 'boleto') &&
        !fiadoDueDate.trim()
      ) {
        toast.error('Informe a data de vencimento do fiado/boleto');
        return;
      }
    } else if (paymentMethod === 'money') {
      if (calculateChange() < 0) {
        toast.error('Valor recebido insuficiente');
        return;
      }
    }
    if (
      !mixedMode &&
      (paymentMethod === 'fiado' || paymentMethod === 'boleto') &&
      fiadoDueDate.trim() === ''
    ) {
      toast.error('Informe a data de vencimento');
      return;
    }
    // Offline: venda avulsa sem cliente. Online: só exige em fiado/boleto/NFC-e/NF-e.
    if (!offline && customerRequired && !selectedCustomer) {
      toast.error('Selecione ou cadastre o cliente (nome + CPF/CNPJ)');
      return;
    }
    if (!offline && emitNfe && selectedCustomer) {
      const hasAddr =
        !!selectedCustomer.logradouro?.trim() &&
        !!selectedCustomer.municipio?.trim() &&
        String(selectedCustomer.cep || '').replace(/\D/g, '').length === 8;
      if (!hasAddr) {
        toast.error(
          'NF-e exige cliente com endereço completo (logradouro, município e CEP). Atualize o cadastro.',
        );
        return;
      }
    }

    setIsProcessing(true);

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${user?.accessToken || ''}`,
        'X-Custom-Token': user?.accessToken || '',
        'Content-Type': 'application/json',
      };
      
      if (currentCompany?.id) {
        headers['X-Company-Id'] = currentCompany.id;
      }

      const customerPayload =
        !offline && selectedCustomer
          ? {
              customerId: selectedCustomer.id,
              customerName: selectedCustomer.name,
              customerDocument: selectedCustomer.documentDigits,
              customerDocumentType: selectedCustomer.documentType,
            }
          : {};

      const pricedItems = buildPricedSaleItems(cart, pricing.cartDiscount);
      const methodToSend: string = mixedMode ? 'mixed' : paymentMethod;
      const baseDetails: Record<string, unknown> = {
        emitNfce: !!emitNfce,
        emitNfe: !!emitNfe,
        subtotal: pricing.subtotal,
        cartDiscount: pricing.cartDiscount,
        cartDiscountType,
        cartDiscountInput: parseFloat(cartDiscountInput) || 0,
        ...customerPayload,
      };

      if (mixedMode) {
        baseDetails.payments = paymentLines.map((l) => ({
          method: l.method,
          amount: roundMoney(l.amount),
        }));
        if (moneyPortion(paymentLines) > 0) {
          baseDetails.cashReceived = parseFloat(cashReceived) || moneyPortion(paymentLines);
          baseDetails.change = calculateChange();
        }
        if (mixedHasReceivable) baseDetails.dueDate = fiadoDueDate.trim();
      } else if (paymentMethod === 'money') {
        baseDetails.cashReceived = parseFloat(cashReceived);
        baseDetails.change = calculateChange();
      } else if (paymentMethod === 'fiado' || paymentMethod === 'boleto') {
        baseDetails.dueDate = fiadoDueDate.trim();
      }

      const clientRequestId = crypto.randomUUID();
      const salePayload = {
        registerId: register.id,
        items: pricedItems,
        total: finalTotal,
        paymentMethod: methodToSend,
        paymentDetails: baseDetails,
        clientRequestId,
      };

      // Offline: enfileira cupom não fiscal e mostra recibo local
      if (offline) {
        if (!currentCompany?.id) {
          toast.error('Empresa não identificada');
          return;
        }

        const catalog = await resolveOfflineCatalog(currentCompany.id, products);
        if (catalog.length === 0) {
          toast.error(
            'Sem catálogo em cache. Abra o app online uma vez para gravar os produtos.',
          );
          return;
        }

        const stockItems = cart.map((item) => {
          const product = catalog.find((p) => p.id === item.id) || item.product;
          return {
            productId: item.id,
            quantity: item.quantity,
            name: item.name,
            bundleItems: product.bundleItems,
          };
        });

        const stockGate = checkOfflineStockAvailability(catalog, stockItems);
        if (!stockGate.ok) {
          toast.error(stockGate.reason);
          return;
        }

        const queued = await enqueueOfflineSale({
          companyId: currentCompany.id,
          registerId: register.id,
          products: catalog,
          payload: salePayload,
          stockItems,
          receiptItems: cart.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
        });

        const updated = await loadCachedProducts(currentCompany.id);
        if (updated) setProducts(updated);

        toast.success('Venda offline registrada (cupom não fiscal). Sincroniza ao reconectar.');
        clearCart();
        setShowPayment(false);
        setCashReceived('');
        setCartDiscountInput('');
        setMixedMode(false);
        setPaymentLines([{ id: newPaymentLineId(), method: 'money', amount: 0 }]);
        setSelectedCustomer(null);
        setDocumentType('non_fiscal');
        await onSaleComplete(queued.receipt);
        return;
      }
      
      console.log('📤 Sending sale to server:', salePayload);
      
      const saleResponse = await fetch(
        getBackendUrl('/cashier/sale'),
        {
          method: 'POST',
          headers,
          body: JSON.stringify(salePayload),
        }
      );

      const saleData = await saleResponse.json();
      console.log('📥 Server response:', saleData);

      if (saleData.error) {
        console.error('❌ Sale error from server:', saleData.error);
        toast.error(saleData.error);
        return;
      }

      console.log('✅ Sale registered successfully:', saleData.sale.id);

      /**
       * Baixa de estoque + auditoria: cada venda do Caixa gera linha em `stock_movements` (tipo `venda`).
       * Antes só atualizava `current_stock` — relatórios de saídas e comparativos com vendas ficavam divergentes.
       * Combos: baixa nos componentes (igual ao POS manual), não no produto pai.
       */
      const saleId = saleData.sale?.id ?? '';
      console.log('📦 Stock + movimentação para', cart.length, 'itens (venda', saleId, ')');
      const companyId = currentCompany?.id ?? (register.companyId as string | undefined);
      if (!companyId) {
        toast.error('Empresa não identificada — verifique o estoque manualmente.');
      }

      for (const item of cart) {
        const product = item.product;
        const bundleItems =
          Array.isArray(product.bundleItems) && product.bundleItems.length > 0
            ? product.bundleItems
            : [];

        if (!companyId) continue;

        try {
          if (bundleItems.length > 0) {
            for (const b of bundleItems) {
              const qtyToDeduct = (Number(b.quantity) || 0) * item.quantity;
              if (!b.productId || qtyToDeduct <= 0) continue;

              const source = `sale:${saleId}:${b.productId}:combo`;
              const notes = `Combo ${item.quantity}x ${item.name} · Ref. venda ${saleId}`;
              await StockRepository.deductStockOnce({
                companyId,
                productId: b.productId,
                quantity: qtyToDeduct,
                source,
                notes: `Venda PDV (Caixa) — ${notes}`,
                movementType: 'venda',
              });
            }
          } else {
            const source = `sale:${saleId}:${item.id}:direct`;
            await StockRepository.deductStockOnce({
              companyId,
              productId: item.id,
              quantity: item.quantity,
              source,
              notes: `Venda PDV (Caixa) · Venda ${item.quantity}x ${item.name} · Ref. venda ${saleId}`,
              movementType: 'venda',
            });
          }
          console.log(`✅ Estoque e movimento registrados: ${item.name}`);
        } catch (error) {
          console.error('❌ Erro ao baixar estoque / movimentação:', item.name, error);
          toast.error(
            `Venda registrada, mas falhou baixa de estoque em «${item.name}». Verifique o estoque e o histórico.`,
          );
        }
      }

      // Success!
      console.log('🎉 Sale finalized successfully!');
      toast.success(
        emitNfe
          ? 'Venda finalizada — autorizando NF-e...'
          : emitNfce
            ? 'Venda finalizada — autorizando NFC-e...'
            : 'Venda finalizada com sucesso!',
      );
      
      // Prepare completed sale data with full info
      const completedSaleData = {
        id: saleData.sale.id,
        items: cart.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price,
        })),
        total: saleData.sale.total,
        paymentMethod: saleData.sale.paymentMethod,
        paymentDetails: saleData.sale.paymentDetails,
        emitNfce: !!emitNfce,
        emitNfe: !!emitNfe,
        timestamp: saleData.sale.timestamp,
      };
      
      console.log('📄 Completed sale data for receipt:', completedSaleData);
      
      // Reset cart and payment form
      clearCart();
      setShowPayment(false);
      setCashReceived('');
      setPaymentMethod('money');
      setMixedMode(false);
      setPaymentLines([{ id: newPaymentLineId(), method: 'money', amount: 0 }]);
      setCartDiscountInput('');
      setCartDiscountType('value');
      setSelectedCustomer(null);
      setDocumentType('non_fiscal');
      
      // Reload products (lista local do caixa)
      console.log('🔄 Reloading products...');
      loadProducts();

      await onSaleComplete(completedSaleData);

    } catch (error) {
      console.error('💥 Error finalizing sale:', error);
      toast.error('Erro ao finalizar venda');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if ((Number(p.currentStock) || 0) <= 0) return false;
    const q = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.barcode?.toLowerCase().includes(q)
    );
  });

  const total = calculateTotal();

  // Wrapper functions for JSX
  const handleAddToCart = (product: Product) => addToCart(product);
  const handleRemoveFromCart = (itemId: string) => removeFromCart(itemId);
  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    const item = cart.find((i) => i.id === itemId);
    if (!item) return;
    const delta = newQuantity - item.quantity;
    updateQuantity(itemId, delta);
  };
  const handleSetQuantityDirect = (itemId: string, value: string) => setQuantityDirect(itemId, value);
  const handleClearCart = () => clearCart();
  const getFilteredProducts = () => filteredProducts;
  const visibleProducts = filteredProducts.slice(0, productLimit);
  const hasMoreProducts = filteredProducts.length > productLimit;
  const getTotal = () => calculateTotal();
  const getChange = () => calculateChange();
  const handleCompleteSale = () => handleFinalizeSale();
  const openCheckout = () => {
    fiscal.refresh();
    const t = cartFinalTotal(
      cart,
      parseFloat(cartDiscountInput) || 0,
      cartDiscountType,
    ).total;
    setPaymentLines([{ id: newPaymentLineId(), method: paymentMethod, amount: t }]);
    if (paymentMethod === 'money') setCashReceived(t.toFixed(2));
    setShowPayment(true);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 md:p-4 shrink-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <h2 className="text-base md:text-lg font-black text-gray-900 dark:text-white">PDV - Ponto de Venda</h2>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Caixa: {register.id.slice(0, 8)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">Saldo Atual</p>
            <p className="text-lg md:text-xl font-black text-green-600 dark:text-green-400 tabular-nums">
              {formatCurrency(register.currentBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Scanner Modal */}
      {isScanning && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col">
          <div className="bg-gray-900 p-4 flex items-center justify-between">
            <h3 className="text-white font-bold text-lg">Scanner de Código de Barras</h3>
            <button
              onClick={() => setIsScanning(false)}
              className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-4">
            {isLoadingCamera && (
              <div className="text-center mb-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mx-auto mb-2"></div>
                <p className="text-white">Inicializando câmera...</p>
              </div>
            )}
            
            <div id="cashier-barcode-reader" className="w-full max-w-md rounded-xl overflow-hidden shadow-2xl"></div>
            
            <p className="text-white text-sm mt-4 text-center max-w-md">
              Aponte a câmera para o código de barras do produto
            </p>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 md:p-6 flex items-center justify-between">
              <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white">Finalizar Venda</h3>
              <button
                onClick={() => setShowPayment(false)}
                disabled={isProcessing}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
              {/* Total */}
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white text-center">
                <p className="text-sm opacity-90 font-bold mb-1">Total da Venda</p>
                <p className="text-4xl md:text-5xl font-black tabular-nums">{formatCurrency(getTotal())}</p>
                {pricing.cartDiscount > 0 && (
                  <p className="text-sm opacity-90 mt-1">
                    Subtotal {formatCurrency(pricing.subtotal)} − desconto{' '}
                    {formatCurrency(pricing.cartDiscount)}
                  </p>
                )}
                <p className="text-sm opacity-75 mt-2">{cart.length} {cart.length === 1 ? 'item' : 'itens'}</p>
              </div>

              <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2">
                <span className="text-sm font-bold text-gray-700 dark:text-gray-300">Pagamento misto</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = !mixedMode;
                    setMixedMode(next);
                    if (next) {
                      setPaymentLines([
                        { id: newPaymentLineId(), method: 'money', amount: roundMoney(pricing.total / 2) },
                        {
                          id: newPaymentLineId(),
                          method: 'pix',
                          amount: roundMoney(pricing.total - pricing.total / 2),
                        },
                      ]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-bold ${
                    mixedMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                  }`}
                >
                  {mixedMode ? 'Ativo' : 'Dividir'}
                </button>
              </div>

              {/* Payment + document (documento no topo do SaleCheckoutFields) */}
              <SaleCheckoutFields
                paymentMethod={paymentMethod}
                onPaymentMethodChange={(m) => {
                  setPaymentMethod(m);
                  if (m === 'money') setCashReceived(pricing.total.toFixed(2));
                }}
                documentType={documentType}
                onDocumentTypeChange={setDocumentType}
                fiscalReady={fiscal.ready}
                fiscalConfigComplete={fiscal.configComplete}
                fiscalLoading={fiscal.loading}
                fiscalReason={fiscal.reasons[0]}
                fiscalReasons={fiscal.reasons}
                hidePaymentMethods={mixedMode}
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
                      ? emitNfe
                        ? 'Obrigatório para NF-e (CPF/CNPJ + endereço completo)'
                        : 'Obrigatório para fiado, boleto e NFC-e (nome + CPF/CNPJ)'
                      : 'Opcional — pode vender sem cliente'
                }
              />

              {mixedMode ? (
                <MixedPaymentEditor
                  total={pricing.total}
                  lines={paymentLines}
                  onChange={setPaymentLines}
                  cashReceived={cashReceived}
                  onCashReceivedChange={setCashReceived}
                />
              ) : (
                <>
              {/* Cash Input */}
              {paymentMethod === 'money' && (
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                    Valor Recebido
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-4 py-3 text-lg border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                  
                  {/* Quick Amounts */}
                  <div className="grid grid-cols-3 gap-2">
                    {[20, 50, 100, 200].map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setCashReceived(amount.toString())}
                        className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 transition-colors"
                      >
                        {formatCurrency(amount)}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCashReceived(getTotal().toFixed(2))}
                      className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg text-sm font-bold text-blue-700 dark:text-blue-400 transition-colors"
                    >
                      Exato
                    </button>
                  </div>

                  {/* Change Display */}
                  {parseFloat(cashReceived || '0') > 0 && (
                    <div className={`p-4 rounded-xl ${
                      getChange() < 0 
                        ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800'
                        : 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${getChange() < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                          {getChange() < 0 ? 'Faltam:' : 'Troco:'}
                        </span>
                        <span className={`text-2xl font-black ${getChange() < 0 ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'}`}>
                          {formatCurrency(Math.abs(getChange()))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(paymentMethod === 'fiado' || paymentMethod === 'boleto') && (
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                    {paymentMethod === 'boleto' ? 'Boleto (a receber)' : 'Fiado (a receber)'}
                  </label>
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-500 uppercase">Vencimento</label>
                    <input
                      type="date"
                      value={fiadoDueDate}
                      onChange={(e) => setFiadoDueDate(e.target.value)}
                      className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Gera título em <strong>Contas a receber</strong> vinculado ao cliente (não entra no caixa agora).
                    </p>
                  </div>
                </div>
              )}
                </>
              )}

              {mixedMode && mixedHasReceivable && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase">
                    Vencimento (fiado/boleto)
                  </label>
                  <input
                    type="date"
                    value={fiadoDueDate}
                    onChange={(e) => setFiadoDueDate(e.target.value)}
                    className="w-full px-4 py-3 text-base border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}
              </SaleCheckoutFields>
            </div>

              {/* Action Buttons — sempre visíveis */}
              <div className="shrink-0 flex flex-col sm:flex-row gap-3 p-4 md:p-6 pt-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                <button
                  onClick={() => setShowPayment(false)}
                  disabled={isProcessing}
                  className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCompleteSale}
                  disabled={
                    isProcessing ||
                    (customerRequired && !selectedCustomer) ||
                    (!mixedMode && paymentMethod === 'money' && getChange() < 0) ||
                    (mixedMode &&
                      (Math.abs(paymentsSum(paymentLines) - pricing.total) > 0.009 ||
                        (moneyPortion(paymentLines) > 0 && getChange() < 0))) ||
                    ((!mixedMode &&
                      (paymentMethod === 'fiado' || paymentMethod === 'boleto') &&
                      !fiadoDueDate.trim()) ||
                      (mixedMode && mixedHasReceivable && !fiadoDueDate.trim()))
                  }
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      Processando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Finalizar Venda
                    </>
                  )}
                </button>
              </div>
          </div>
        </div>
      )}

      {/* Main Content - 2 Column Layout on Desktop */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Product Search & List */}
        <div className="flex-1 min-h-0 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Search Bar */}
          <div className="p-3 md:p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && filteredProducts[0]) {
                      e.preventDefault();
                      handleAddToCart(filteredProducts[0]);
                      setSearchTerm('');
                    }
                  }}
                  placeholder="Buscar produto… (F2) · Enter adiciona o 1º"
                  className="w-full pl-10 pr-4 py-2.5 md:py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setIsScanning(true)}
                className="w-12 h-12 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Products Grid — só o painel rola; Continuar fica fixo abaixo */}
          <div className="flex-1 overflow-auto p-3 md:p-4 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
              {visibleProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleAddToCart(product)}
                  disabled={product.currentStock <= 0}
                  className={`p-3 md:p-4 rounded-xl border-2 text-left transition-all ${
                    product.currentStock <= 0
                      ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 opacity-50 cursor-not-allowed'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-gray-800 hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Package className={`w-5 h-5 flex-shrink-0 ${
                      product.currentStock <= 0 ? 'text-gray-400' : 'text-blue-600'
                    }`} />
                    {product.currentStock <= 0 && (
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                        SEM ESTOQUE
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm md:text-base text-gray-900 dark:text-white line-clamp-2 mb-1">
                    {product.name}
                  </h4>
                  <div className="flex items-end justify-between gap-1">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Estoque</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                        {formatQuantity(product.currentStock)}
                      </p>
                    </div>
                    <p className="text-lg md:text-xl font-black text-green-600 dark:text-green-400 tabular-nums">
                      {formatCurrency(product.sellingPrice || 0)}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {hasMoreProducts && (
              <div className="flex justify-center py-4">
                <button
                  type="button"
                  onClick={() => setProductLimit((n) => n + 48)}
                  className="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Carregar mais produtos ({filteredProducts.length - productLimit} restantes)
                </button>
              </div>
            )}

            {getFilteredProducts().length === 0 && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-bold">
                  {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
                </p>
                {searchTerm && (
                  <p className="text-xs text-gray-400 mt-1">Use a busca para achar entre milhares de itens</p>
                )}
              </div>
            )}
          </div>

          {/* Continuar fixo no painel de produtos — não exige rolar a lista */}
          {cart.length > 0 && !showPayment && (
            <div className="shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 md:p-4 lg:hidden">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-gray-500 font-medium truncate">
                    {cart.length} {cart.length === 1 ? 'item' : 'itens'} · Continuar sem rolar
                  </p>
                  <p className="text-xl font-black text-gray-900 dark:text-white tabular-nums">
                    {formatCurrency(getTotal())}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCheckout}
                  className="shrink-0 px-5 py-3.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg"
                >
                  Continuar
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Cart */}
        <div className="w-full lg:w-96 xl:w-[28rem] flex flex-col bg-white dark:bg-gray-800 min-h-0 max-h-[42vh] lg:max-h-none shrink-0 lg:shrink">
          {/* Cart Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-blue-600" />
                <h3 className="font-black text-gray-900 dark:text-white">Carrinho</h3>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={handleClearCart}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 font-bold"
                >
                  Limpar
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {cart.length} {cart.length === 1 ? 'item' : 'itens'}
            </p>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-auto p-4 space-y-2 min-h-0">
            {cart.length === 0 ? (
              <div className="text-center py-8 lg:py-12">
                <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-bold">Carrinho vazio</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Adicione produtos para começar
                </p>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                        {item.name}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatCurrency(item.price)} cada
                      </p>
                    </div>
                    <button
                      onClick={() => handleRemoveFromCart(item.id)}
                      className="w-7 h-7 flex items-center justify-center text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 rounded-lg transition-colors"
                      >
                        <Minus className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleSetQuantityDirect(item.id, e.target.value)}
                        min="1"
                        max={item.product.currentStock}
                        className="w-14 text-center font-bold text-gray-900 dark:text-white bg-white dark:bg-gray-600 border-2 border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.currentStock}
                        className="w-8 h-8 flex items-center justify-center bg-white dark:bg-gray-600 hover:bg-gray-100 dark:hover:bg-gray-500 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                      </button>
                    </div>

                    <p className="text-lg font-black text-gray-900 dark:text-white tabular-nums">
                      {formatCurrency(lineNet(item))}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-[11px] text-gray-500 shrink-0">Desc. R$</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.discount || ''}
                      onChange={(e) => setItemDiscount(item.id, e.target.value)}
                      placeholder="0"
                      className="w-24 px-2 py-1 text-xs rounded-lg border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600"
                    />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Footer — sticky no painel do carrinho */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3 shrink-0">
              <div className="flex items-center gap-2">
                <select
                  value={cartDiscountType}
                  onChange={(e) => setCartDiscountType(e.target.value as 'value' | 'percent')}
                  className="h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-xs font-bold px-2"
                >
                  <option value="value">Desc. R$</option>
                  <option value="percent">Desc. %</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cartDiscountInput}
                  onChange={(e) => setCartDiscountInput(e.target.value)}
                  placeholder="0"
                  className="flex-1 h-9 px-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div className="space-y-0.5 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatCurrency(pricing.subtotal)}</span>
                </div>
                {pricing.cartDiscount > 0 && (
                  <div className="flex justify-between text-amber-700 dark:text-amber-300">
                    <span>Desconto</span>
                    <span className="tabular-nums">− {formatCurrency(pricing.cartDiscount)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-lg font-bold text-gray-700 dark:text-gray-300">Total</span>
                  <span className="text-3xl font-black text-blue-600 dark:text-blue-400 tabular-nums">
                    {formatCurrency(getTotal())}
                  </span>
                </div>
              </div>

              <button
                onClick={openCheckout}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Continuar (F4)
                <ArrowRight className="w-5 h-5" />
              </button>
              <p className="text-[10px] text-center text-gray-400">
                F2 busca · Enter adiciona · F4 pagar · Esc fecha · F9 limpa
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}