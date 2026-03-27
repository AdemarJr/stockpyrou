import React, { useState, useEffect, useRef } from 'react';
import { Plus, Package, Calendar, FileText, AlertCircle, Trash2, Edit2, Camera, X, RefreshCw, AlertTriangle, Upload } from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner@2.0.3';
import type { Product, Supplier, StockEntry } from '../../types';
import { cn } from '../ui/utils';
import { nativeFieldInvalidClass } from '../../lib/formFieldValidation';
import { formatCurrency, formatDateTime, calculateWeightedAverageCost } from '../../utils/calculations';
import { StockEntryImport } from './StockEntryImport';

interface StockEntryFormProps {
  products: Product[];
  suppliers: Supplier[];
  onSubmit: (entry: Omit<StockEntry, 'id' | 'entryDate' | 'userId'>, newAvgCost: number) => void;
  initialData?: StockEntry;
  isEditing?: boolean;
  onCancelEdit?: () => void;
}

export function StockEntryForm({ 
  products, 
  suppliers, 
  onSubmit, 
  initialData, 
  isEditing = false,
  onCancelEdit 
}: StockEntryFormProps) {
  const [formData, setFormData] = useState({
    productId: initialData?.productId || '',
    supplierId: initialData?.supplierId || '',
    quantity: initialData?.quantity || 0,
    unitPrice: initialData?.unitPrice || 0,
    batchNumber: initialData?.batchNumber || '',
    expirationDate: initialData?.expirationDate ? initialData.expirationDate.toISOString().split('T')[0] : '',
    notes: initialData?.notes || '',
  });
  
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(() => {
    if (initialData?.productId) {
      return products.find(p => p.id === initialData.productId) || null;
    }
    return null;
  });

  type StockFieldKey = 'productId' | 'supplierId' | 'quantity' | 'unitPrice' | 'expirationDate';
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<StockFieldKey, boolean>>>({});

  const stopScanner = async () => {
    if (html5QrCodeRef.current) {
      if (html5QrCodeRef.current.isScanning) {
        try {
          await html5QrCodeRef.current.stop();
        } catch (e) {
          console.warn("Erro ao parar scanner:", e);
        }
      }
      try {
        html5QrCodeRef.current.clear();
      } catch (e) {}
    }
    setIsScanning(false);
    setIsLoadingCamera(false);
  };

  useEffect(() => {
    let mounted = true;
    let timer: any;

    async function startScanner() {
      if (isScanning && mounted) {
        setIsLoadingCamera(true);
        setCameraError(null);
        
        timer = setTimeout(async () => {
          const container = document.getElementById("barcode-reader-entry");
          if (!container) return;

          try {
            // Force permission
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
              stream.getTracks().forEach(track => track.stop());
            } catch (e) {}

            const html5QrCode = new Html5Qrcode("barcode-reader-entry");
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
                stopScanner();
              },
              () => {}
            ).catch(() => {
               return html5QrCode.start(
                 { facingMode: "user" },
                 config,
                 (text) => { handleBarcodeDetected(text); stopScanner(); },
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
      handleChange('productId', product.id);
      toast.success(`Produto detectado: ${product.name}`);
    } else {
      toast.error(`Produto com código ${barcode} não cadastrado.`);
    }
  };

  const handleImportItems = (rows: any[]) => {
    // For each valid row, submit an entry
    rows.forEach((row) => {
      if (row.matchedProduct) {
        const totalPrice = row.quantity * row.unitPrice;
        const newAvgCost = calculateWeightedAverageCost(
          row.matchedProduct.currentStock,
          row.matchedProduct.averageCost,
          row.quantity,
          row.unitPrice
        );

        const entry: Omit<StockEntry, 'id' | 'entryDate' | 'userId'> = {
          productId: row.matchedProduct.id,
          supplierId: formData.supplierId, // Use the selected supplier from form
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          totalPrice,
          batchNumber: row.batchNumber || undefined,
          expirationDate: row.expirationDate ? new Date(row.expirationDate) : undefined,
          notes: `Importado via CSV - Linha ${row.line}`,
        };

        onSubmit(entry, newAvgCost);
      }
    });

    toast.success(`${rows.length} itens importados com sucesso!`);
  };
  
  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (fieldErrors[field as StockFieldKey]) {
      setFieldErrors(prev => {
        const next = { ...prev };
        delete next[field as StockFieldKey];
        return next;
      });
    }

    if (field === 'productId') {
      const product = products.find(p => p.id === value);
      setSelectedProduct(product || null);
      if (product && !isEditing) {
        const updates: any = {
          unitPrice: product.averageCost
        };
        if (product.supplierId) updates.supplierId = product.supplierId;
        if (product.isPerishable && product.shelfLife) {
          const date = new Date();
          date.setDate(date.getDate() + product.shelfLife);
          updates.expirationDate = date.toISOString().split('T')[0];
        }
        setFormData(prev => ({ ...prev, ...updates }));
      }
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const err: Partial<Record<StockFieldKey, boolean>> = {};
    if (!formData.productId) err.productId = true;
    if (!formData.supplierId) err.supplierId = true;
    if (!formData.quantity || formData.quantity <= 0) err.quantity = true;
    if (!formData.unitPrice || formData.unitPrice <= 0) err.unitPrice = true;
    const rowProduct = products.find((p) => p.id === formData.productId);
    if (rowProduct?.isPerishable && !formData.expirationDate?.trim()) {
      err.expirationDate = true;
    }
    setFieldErrors(err);
    if (Object.keys(err).length > 0) return;

    if (!selectedProduct) return;
    
    const totalPrice = formData.quantity * formData.unitPrice;
    
    // Calculate new weighted average cost
    // NOTE: In edit mode, this calculation is for display only, the service handles the complex revert logic
    const newAvgCost = calculateWeightedAverageCost(
      selectedProduct.currentStock,
      selectedProduct.averageCost,
      formData.quantity,
      formData.unitPrice
    );
    
    const entry: Omit<StockEntry, 'id' | 'entryDate' | 'userId'> = {
      productId: formData.productId,
      supplierId: formData.supplierId,
      quantity: formData.quantity,
      unitPrice: formData.unitPrice,
      totalPrice,
      batchNumber: formData.batchNumber,
      expirationDate: formData.expirationDate ? new Date(formData.expirationDate) : undefined,
      notes: formData.notes || undefined,
    };
    
    onSubmit(entry, newAvgCost);
    
    if (!isEditing) {
      // Reset form only if creating new
      setFormData({
        productId: '',
        supplierId: '',
        quantity: 0,
        unitPrice: 0,
        batchNumber: '',
        expirationDate: '',
        notes: '',
      });
      setSelectedProduct(null);
    }
  };
  
  const totalPrice = formData.quantity * formData.unitPrice;
  const newAvgCost = selectedProduct
    ? calculateWeightedAverageCost(
        selectedProduct.currentStock,
        selectedProduct.averageCost,
        formData.quantity,
        formData.unitPrice
      )
    : 0;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      {!isEditing && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Recebimento de Estoque</h2>
              <p className="text-gray-600 mt-1">
                Registre a entrada de novos produtos no estoque
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setImportDialogOpen(true)}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-md bg-green-600 text-white hover:bg-green-700"
              >
                <Upload className="w-5 h-5" /> Importar NF-e
              </button>
              <button
                type="button"
                onClick={() => {
                  if (isScanning) {
                    stopScanner();
                  } else {
                    setCameraError(null);
                    setIsScanning(true);
                  }
                }}
                className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-md ${
                  isScanning ? 'bg-red-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isScanning ? (
                  <><X className="w-5 h-5" /> Cancelar Scanner</>
                ) : (
                  <><Camera className="w-5 h-5" /> Escanear Código</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isScanning && (
        <div className="bg-white p-4 rounded-2xl border-2 border-blue-500 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 text-blue-900 font-bold">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
              Scanner de Recebimento
            </h3>
            {isLoadingCamera && (
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Inicializando...
              </span>
            )}
          </div>
          
          <div 
            className="w-full relative bg-black rounded-xl overflow-hidden shadow-inner border-b-4 border-blue-600"
            style={{ minHeight: '300px' }}
          >
            <div id="barcode-reader-entry" className="w-full h-full"></div>
            
            {/* Scanning HUD */}
            <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
               <div className="w-48 h-48 border-2 border-white/30 rounded-3xl flex items-center justify-center relative overflow-hidden">
                  <div className="w-full h-0.5 bg-red-500 absolute top-1/2 left-0 -translate-y-1/2 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
                  <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-lg"></div>
                  <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-lg"></div>
                  <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-lg"></div>
                  <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-lg"></div>
               </div>
            </div>
          </div>
        </div>
      )}

      {cameraError === 'permission-denied' && (
        <div className="bg-red-50 border-2 border-red-200 p-4 rounded-xl text-red-800 animate-in shake duration-500">
          <div className="flex gap-2 items-center mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h4 className="font-bold">Câmera Bloqueada</h4>
          </div>
          <p className="text-xs leading-relaxed">
            Libere o acesso à câmera nas configurações do navegador para escanear produtos.
          </p>
        </div>
      )}
      
      {/* Entry Form */}
      <div className={`bg-white rounded-lg ${!isEditing ? 'border border-gray-200 p-6' : ''}`}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product and Supplier */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">
                Produto <span className="text-destructive">*</span>
              </label>
              <select
                disabled={isEditing} // Block product change in edit mode for safety
                value={formData.productId}
                onChange={(e) => handleChange('productId', e.target.value)}
                aria-invalid={fieldErrors.productId}
                className={cn(
                  'w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  nativeFieldInvalidClass(!!fieldErrors.productId && !isEditing),
                  !fieldErrors.productId && 'border border-gray-300',
                  isEditing && 'bg-gray-100 cursor-not-allowed'
                )}
              >
                <option value="">Selecione um produto</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.measurementUnit})
                  </option>
                ))}
              </select>
              {isEditing && <p className="text-xs text-gray-500 mt-1">O produto não pode ser alterado na edição.</p>}
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2">
                Fornecedor <span className="text-destructive">*</span>
              </label>
              <select
                value={formData.supplierId}
                onChange={(e) => handleChange('supplierId', e.target.value)}
                aria-invalid={fieldErrors.supplierId}
                className={cn(
                  'w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  nativeFieldInvalidClass(!!fieldErrors.supplierId),
                  !fieldErrors.supplierId && 'border border-gray-300'
                )}
              >
                <option value="">Selecione um fornecedor</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Quantity and Price */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">
                Quantidade <span className="text-destructive">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={formData.quantity || ''}
                onChange={(e) => handleChange('quantity', parseFloat(e.target.value) || 0)}
                aria-invalid={fieldErrors.quantity}
                className={cn(
                  'w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  nativeFieldInvalidClass(!!fieldErrors.quantity),
                  !fieldErrors.quantity && 'border border-gray-300'
                )}
                placeholder="0.00"
              />
              {selectedProduct && (
                <p className="text-gray-500 mt-1">
                  Unidade: {selectedProduct.measurementUnit}
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2">
                Preço Unitário <span className="text-destructive">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                  R$
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.unitPrice || ''}
                  onChange={(e) => handleChange('unitPrice', parseFloat(e.target.value) || 0)}
                  aria-invalid={fieldErrors.unitPrice}
                  className={cn(
                    'w-full pl-12 pr-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                    nativeFieldInvalidClass(!!fieldErrors.unitPrice),
                    !fieldErrors.unitPrice && 'border border-gray-300'
                  )}
                  placeholder="0.00"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2">
                Valor Total
              </label>
              <div className="px-4 py-2 bg-gray-100 rounded-lg text-gray-700">
                {formatCurrency(totalPrice)}
              </div>
            </div>
          </div>
          
          {/* Batch and Expiration */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-700 mb-2">
                Número do Lote (Opcional)
              </label>
              <input
                type="text"
                value={formData.batchNumber}
                onChange={(e) => handleChange('batchNumber', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: LOTE-20241128-001"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2">
                Data de Validade{' '}
                {selectedProduct?.isPerishable && <span className="text-destructive">*</span>}
              </label>
              <input
                type="date"
                value={formData.expirationDate}
                onChange={(e) => handleChange('expirationDate', e.target.value)}
                aria-invalid={fieldErrors.expirationDate}
                className={cn(
                  'w-full px-4 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                  nativeFieldInvalidClass(!!fieldErrors.expirationDate),
                  !fieldErrors.expirationDate && 'border border-gray-300'
                )}
                min={!isEditing ? new Date().toISOString().split('T')[0] : undefined}
              />
            </div>
          </div>
          
          {/* Notes */}
          <div>
            <label className="block text-gray-700 mb-2">
              Observações
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="Informações adicionais sobre a entrada..."
            />
          </div>
          
          {/* Buttons */}
          <div className="flex gap-4">
            {isEditing && onCancelEdit && (
              <button
                type="button"
                onClick={onCancelEdit}
                className="flex-1 bg-gray-100 text-gray-700 px-4 py-3 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancelar
              </button>
            )}
            
            <button
              type="submit"
              className={`flex-1 ${isEditing ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-3 rounded-lg flex items-center justify-center gap-2`}
            >
              {isEditing ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {isEditing ? 'Salvar Alterações' : 'Registrar Entrada'}
            </button>
          </div>
        </form>
      </div>

      {/* Import Dialog */}
      <StockEntryImport
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        products={products}
        suppliers={suppliers}
        selectedSupplier={formData.supplierId}
        onImport={handleImportItems}
      />
    </div>
  );
}