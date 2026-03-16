import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Camera,
  X,
  DollarSign,
  CreditCard,
  Smartphone,
  Banknote,
  ArrowRight,
  Package,
  AlertTriangle,
  CheckCircle2,
  Zap
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import type { Product } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { ProductService } from '../../services/ProductService';
import { toast } from 'sonner@2.0.3';

interface CashierPOSProps {
  register: any;
  onSaleComplete: (saleData: any) => void;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
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

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'money' | 'pix' | 'credit' | 'debit'>('money');
  const [cashReceived, setCashReceived] = useState('');

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

  const loadProducts = async () => {
    try {
      if (!currentCompany) return;
      
      const allProducts = await ProductService.getAllProducts(currentCompany.id);
      setProducts(allProducts);
    } catch (error) {
      console.error('Error loading products:', error);
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
          product,
        },
      ]);
    }
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

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const calculateChange = () => {
    if (paymentMethod !== 'money' || !cashReceived) return 0;
    return parseFloat(cashReceived) - calculateTotal();
  };

  const handleFinalizeSale = async () => {
    if (cart.length === 0) {
      toast.error('Carrinho vazio');
      return;
    }

    if (paymentMethod === 'money') {
      const change = calculateChange();
      if (change < 0) {
        toast.error('Valor recebido insuficiente');
        return;
      }
    }

    setIsProcessing(true);

    try {
      console.log('🛒 Starting sale finalization');
      console.log('📦 Cart items:', cart);
      console.log('💰 Payment method:', paymentMethod);
      console.log('💵 Total:', calculateTotal());

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Custom-Token': user?.accessToken || '',
        'Content-Type': 'application/json',
      };
      
      if (currentCompany?.id) {
        headers['X-Company-Id'] = currentCompany.id;
      }

      const salePayload = {
        registerId: register.id,
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        total: calculateTotal(),
        paymentMethod,
        paymentDetails: paymentMethod === 'money' ? {
          cashReceived: parseFloat(cashReceived),
          change: calculateChange(),
        } : {},
      };
      
      console.log('📤 Sending sale to server:', salePayload);
      
      const saleResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/cashier/sale`,
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

      // Update stock for each item
      console.log('📦 Starting stock update for', cart.length, 'items');
      for (const item of cart) {
        try {
          const newStock = item.product.currentStock - item.quantity;
          console.log(`📉 Updating stock for ${item.name}: ${item.product.currentStock} → ${newStock}`);
          
          await ProductService.updateProduct(item.id, {
            currentStock: newStock
          });
          
          console.log(`✅ Stock updated for ${item.name}`);
        } catch (error) {
          console.error('❌ Error updating stock for:', item.name, error);
        }
      }

      // Success!
      console.log('🎉 Sale finalized successfully!');
      toast.success('Venda finalizada com sucesso!')
      
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
        timestamp: saleData.sale.timestamp,
      };
      
      console.log('📄 Completed sale data for receipt:', completedSaleData);
      
      // Reset cart and payment form
      clearCart();
      setShowPayment(false);
      setCashReceived('');
      setPaymentMethod('money');
      
      // Reload products
      console.log('🔄 Reloading products...');
      loadProducts();
      
      // Notify parent to refresh register data and show receipt
      onSaleComplete(completedSaleData);

    } catch (error) {
      console.error('💥 Error finalizing sale:', error);
      toast.error('Erro ao finalizar venda');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
  const getTotal = () => calculateTotal();
  const getChange = () => calculateChange();
  const handleCompleteSale = () => handleFinalizeSale();

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1">
            <h2 className="text-base md:text-lg font-black text-gray-900 dark:text-white">PDV - Ponto de Venda</h2>
            <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400">Caixa: {register.id.slice(0, 8)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">Saldo Atual</p>
            <p className="text-lg md:text-xl font-black text-green-600 dark:text-green-400">
              R$ {register.currentBalance.toFixed(2)}
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
          <div className="bg-white dark:bg-gray-800 rounded-t-3xl md:rounded-2xl w-full md:max-w-2xl max-h-[90vh] overflow-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 md:p-6 flex items-center justify-between">
              <h3 className="text-lg md:text-xl font-black text-gray-900 dark:text-white">Finalizar Venda</h3>
              <button
                onClick={() => setShowPayment(false)}
                disabled={isProcessing}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-6">
              {/* Total */}
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white text-center">
                <p className="text-sm opacity-90 font-bold mb-1">Total da Venda</p>
                <p className="text-4xl md:text-5xl font-black">R$ {getTotal().toFixed(2)}</p>
                <p className="text-sm opacity-75 mt-2">{cart.length} {cart.length === 1 ? 'item' : 'itens'}</p>
              </div>

              {/* Payment Methods */}
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-3">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'money', label: 'Dinheiro', icon: Banknote, color: 'green' },
                    { value: 'pix', label: 'PIX', icon: Smartphone, color: 'blue' },
                    { value: 'credit', label: 'Crédito', icon: CreditCard, color: 'purple' },
                    { value: 'debit', label: 'Débito', icon: CreditCard, color: 'orange' },
                  ].map((method) => {
                    const Icon = method.icon;
                    const isSelected = paymentMethod === method.value;
                    return (
                      <button
                        key={method.value}
                        onClick={() => setPaymentMethod(method.value as any)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          isSelected
                            ? `border-${method.color}-500 bg-${method.color}-50 dark:bg-${method.color}-900/20`
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mx-auto mb-2 ${isSelected ? `text-${method.color}-600` : 'text-gray-400'}`} />
                        <p className={`text-sm font-bold ${isSelected ? `text-${method.color}-600` : 'text-gray-600 dark:text-gray-400'}`}>
                          {method.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

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
                        onClick={() => setCashReceived(amount.toString())}
                        className="px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-300 transition-colors"
                      >
                        R$ {amount}
                      </button>
                    ))}
                    <button
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
                          R$ {Math.abs(getChange()).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  onClick={() => setShowPayment(false)}
                  disabled={isProcessing}
                  className="flex-1 px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCompleteSale}
                  disabled={isProcessing || (paymentMethod === 'money' && getChange() < 0)}
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
                      Confirmar Venda
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - 2 Column Layout on Desktop */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left: Product Search & List */}
        <div className="flex-1 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Search Bar */}
          <div className="p-3 md:p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar produto..."
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

          {/* Products Grid */}
          <div className="flex-1 overflow-auto p-3 md:p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 md:gap-3">
              {getFilteredProducts().map((product) => (
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
                      <p className="text-sm font-bold text-gray-900 dark:text-white">{product.currentStock}</p>
                    </div>
                    <p className="text-lg md:text-xl font-black text-green-600 dark:text-green-400">
                      R$ {product.sellingPrice.toFixed(2)}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {getFilteredProducts().length === 0 && (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-bold">
                  {searchTerm ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Cart */}
        <div className="w-full lg:w-96 xl:w-[28rem] flex flex-col bg-white dark:bg-gray-800">
          {/* Cart Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
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
          <div className="flex-1 overflow-auto p-4 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-12">
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
                        R$ {item.price.toFixed(2)} cada
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
                        style={{
                          backgroundColor: 'white !important' as any,
                          color: '#111827 !important' as any,
                          border: '2px solid #e5e7eb !important' as any,
                          borderRadius: '0.5rem !important' as any,
                          padding: '0.25rem !important' as any,
                          fontSize: '0.875rem !important' as any,
                          fontWeight: '700 !important' as any,
                        }}
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

                    <p className="text-lg font-black text-gray-900 dark:text-white">
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Footer */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-700 dark:text-gray-300">Total</span>
                <span className="text-3xl font-black text-blue-600 dark:text-blue-400">
                  R$ {getTotal().toFixed(2)}
                </span>
              </div>

              <button
                onClick={() => setShowPayment(true)}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Zap className="w-5 h-5" />
                Finalizar Venda
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}