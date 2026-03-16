import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Camera, XCircle } from 'lucide-react';
import type { Product, MeasurementUnit, Supplier } from '../../types';
import { SupplierRepository } from '../../repositories/SupplierRepository';
import { useCompany } from '../../contexts/CompanyContext';
import { Html5Qrcode } from 'html5-qrcode@2.3.8';
import { toast } from 'sonner@2.0.3';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';

interface ProductFormProps {
  product: Product | null;
  onSave: (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
  existingProducts?: Product[];
  onProductFound?: (product: Product) => void;
}

export function ProductForm({ product, onSave, onCancel, existingProducts, onProductFound }: ProductFormProps) {
  const { currentCompany } = useCompany();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    category: 'alimento' as 'alimento' | 'bebida' | 'descartavel' | 'limpeza' | 'outro',
    isPerishable: false,
    measurementUnit: 'kg' as MeasurementUnit,
    minStock: 0,
    safetyStock: 0,
    currentStock: 0,
    averageCost: 0,
    sellingPrice: 0,
    barcode: '',
    supplierId: '',
    shelfLife: 0,
  });

  useEffect(() => {
    if (currentCompany) {
      loadSuppliers();
    }
  }, [currentCompany]);
  
  const loadSuppliers = async () => {
    if (!currentCompany) return;
    try {
      const data = await SupplierRepository.findAll(currentCompany.id);
      setSuppliers(data);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };
  
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        category: product.category,
        isPerishable: product.isPerishable,
        measurementUnit: product.measurementUnit,
        minStock: product.minStock,
        safetyStock: product.safetyStock,
        currentStock: product.currentStock,
        averageCost: product.averageCost,
        sellingPrice: product.sellingPrice || 0,
        barcode: product.barcode || '',
        supplierId: product.supplierId || '',
        shelfLife: product.shelfLife || 0,
      });
    }
  }, [product]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };
  
  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  const qrCodeRef = useRef<HTMLDivElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const isScannerRunningRef = useRef(false);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (html5QrcodeRef.current && isScannerRunningRef.current) {
        html5QrcodeRef.current.stop()
          .then(() => {
            html5QrcodeRef.current = null;
            isScannerRunningRef.current = false;
          })
          .catch((err) => console.error('Error stopping scanner on unmount:', err));
      }
    };
  }, []);

  const startScan = async () => {
    setIsScanning(true);
    
    // Wait for DOM to update
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      const element = document.getElementById("barcode-reader");
      if (!element) {
        throw new Error('Scanner element not ready');
      }
      
      if (!html5QrcodeRef.current) {
        html5QrcodeRef.current = new Html5Qrcode("barcode-reader");
      }
      
      await html5QrcodeRef.current.start(
        { facingMode: "environment" },
        { 
          fps: 10, 
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.777778
        },
        (decodedText) => {
          // Check if product exists
          if (existingProducts && onProductFound) {
            const found = existingProducts.find(p => p.barcode === decodedText);
            if (found) {
              toast.info(`Produto já cadastrado: ${found.name}. Carregando...`);
              onProductFound(found);
              stopScan();
              return;
            }
          }

          handleChange('barcode', decodedText);
          toast.success(`Código de barras lido: ${decodedText}`);
          stopScan();
        },
        (errorMessage) => {
          // Ignore scan errors - they happen continuously while scanning
        }
      );
      
      isScannerRunningRef.current = true;
    } catch (err: any) {
      console.error('Error starting scanner:', err);
      
      // Clean up state on error
      isScannerRunningRef.current = false;
      setIsScanning(false);
      
      // Show user-friendly error message
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
        toast.error('Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do navegador.', { duration: 5000 });
      } else if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
        toast.error('Nenhuma câmera encontrada neste dispositivo.', { duration: 5000 });
      } else if (err.name === 'NotReadableError') {
        toast.error('Câmera está sendo usada por outro aplicativo.', { duration: 5000 });
      } else if (err.name === 'NotSupportedError' || err.message?.includes('HTTPS')) {
        toast.error('Scanner de câmera requer conexão HTTPS segura. Use localhost ou HTTPS.', { duration: 5000 });
      } else {
        toast.error('Não foi possível acessar a câmera. Verifique as permissões.', { duration: 5000 });
      }
    }
  };

  const stopScan = async () => {
    try {
      if (html5QrcodeRef.current && isScannerRunningRef.current) {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current = null;
        isScannerRunningRef.current = false;
      }
    } catch (err) {
      console.error('Error stopping scanner:', err);
      // Force cleanup even if stop fails
      html5QrcodeRef.current = null;
      isScannerRunningRef.current = false;
    } finally {
      setIsScanning(false);
    }
  };

  const handleBarcodeBlur = () => {
    if (formData.barcode && existingProducts && onProductFound) {
      const found = existingProducts.find(p => p.barcode === formData.barcode);
      if (found) {
        toast.info(`Produto encontrado: ${found.name}. Carregando...`);
        onProductFound(found);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-0 md:p-4 z-50">
      <div className="bg-white md:rounded-lg w-full md:max-w-2xl h-full md:h-auto md:max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h3 className="text-lg font-bold">{product ? 'Editar Produto' : 'Novo Produto'}</h3>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-6 flex-1">
          {/* Basic Info */}
          <div className="space-y-4">
            <h4>Informações Básicas</h4>
            
            <div>
              <label className="block text-gray-700 mb-2">
                Nome do Produto *
              </label>
              <Input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Ex: Carne Bovina (Picanha)"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-foreground mb-2">
                  Categoria *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full px-4 py-2 border border-input bg-input-background rounded-lg focus:ring-2 focus:ring-ring focus:border-ring dark:bg-input/30"
                >
                  <option value="alimento">Alimento</option>
                  <option value="bebida">Bebida</option>
                  <option value="descartavel">Descartável</option>
                  <option value="limpeza">Limpeza</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              
              <div>
                <label className="block text-foreground mb-2">
                  Unidade de Medida *
                </label>
                <select
                  required
                  value={formData.measurementUnit}
                  onChange={(e) => handleChange('measurementUnit', e.target.value as MeasurementUnit)}
                  className="w-full px-4 py-2 border border-input bg-input-background rounded-lg focus:ring-2 focus:ring-ring focus:border-ring dark:bg-input/30"
                >
                  <option value="kg">Quilograma (kg)</option>
                  <option value="g">Grama (g)</option>
                  <option value="l">Litro (L)</option>
                  <option value="ml">Mililitro (mL)</option>
                  <option value="un">Unidade (un)</option>
                  <option value="cx">Caixa (cx)</option>
                  <option value="pct">Pacote (pct)</option>
                  <option value="saco">Saco</option>
                  <option value="porcao">Porção</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="block text-foreground mb-2">
                Fornecedor Principal *
              </label>
              <select
                required
                value={formData.supplierId}
                onChange={(e) => handleChange('supplierId', e.target.value)}
                className="w-full px-4 py-2 border border-input bg-input-background rounded-lg focus:ring-2 focus:ring-ring focus:border-ring dark:bg-input/30"
              >
                <option value="">Selecione um fornecedor</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-foreground mb-2">
                Código de Barras (EAN-13)
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => handleChange('barcode', e.target.value)}
                  onBlur={handleBarcodeBlur}
                  className="flex-1"
                  placeholder="Ex: 7891234567890"
                />
                <Button
                  type="button"
                  onClick={startScan}
                  className="flex items-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Scanner
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Digite manualmente ou use o scanner de câmera</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="isPerishable"
                checked={formData.isPerishable}
                onCheckedChange={(checked) => handleChange('isPerishable', checked)}
                aria-describedby="perishable-help"
              />
              <label htmlFor="isPerishable" className="text-foreground cursor-pointer">
                Produto Perecível (requer controle de validade)
              </label>
            </div>

            {formData.isPerishable && (
              <div className="ml-6 space-y-2">
                <label htmlFor="shelfLife" className="block text-foreground">
                  Validade Estimada (dias)
                </label>
                <Input
                  id="shelfLife"
                  type="number"
                  min="0"
                  value={formData.shelfLife}
                  onChange={(e) => handleChange('shelfLife', parseInt(e.target.value) || 0)}
                  placeholder="Ex: 30"
                  aria-describedby="shelfLife-help"
                />
                <p id="shelfLife-help" className="text-xs text-muted-foreground">
                  Tempo médio de validade. Usado para sugerir data de vencimento nas entradas.
                </p>
              </div>
            )}
          </div>
          
          {/* Stock Control */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h4>Controle de Estoque</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">
                  Estoque Atual
                </label>
                <input
                  type="number"
                  disabled
                  value={formData.currentStock}
                  className="w-full px-4 py-2 border border-gray-200 bg-gray-100 text-gray-500 rounded-lg cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Gerenciado via Entradas/Saídas
                </p>
              </div>
              
              <div>
                <label className="block text-gray-700 mb-2">
                  Estoque Mínimo *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.minStock}
                  onChange={(e) => handleChange('minStock', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-gray-500 mt-1">Ponto de pedido</p>
              </div>
              
              {/*
              <div>
                <label className="block text-gray-700 mb-2">
                  Estoque de Segurança *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.safetyStock}
                  onChange={(e) => handleChange('safetyStock', parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-gray-500 mt-1">Estoque ideal</p>
              </div>
              */}
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 text-sm">
                <strong>Nota:</strong> O estoque atual é atualizado automaticamente através do menu de "Entradas" ou "Vendas". 
                Defina aqui apenas os níveis de alerta para reposição.
              </p>
            </div>
          </div>
          
          {/* Cost & Price */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h4>Financeiro</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">
                  Custo Médio Ponderado *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">
                    R$
                  </span>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.averageCost}
                    onChange={(e) => handleChange('averageCost', parseFloat(e.target.value) || 0)}
                    className="w-full pl-12 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Custo de aquisição por {formData.measurementUnit}
                </p>
              </div>

              <div>
                <label className="block text-gray-700 mb-2 font-bold text-blue-800">
                  Preço de Venda (Sugerido) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-blue-600 font-bold">
                    R$
                  </span>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.sellingPrice}
                    onChange={(e) => handleChange('sellingPrice', parseFloat(e.target.value) || 0)}
                    className="w-full pl-12 pr-4 py-2 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-bold text-blue-900"
                    placeholder="0.00"
                  />
                </div>
                <p className="text-blue-600 text-xs mt-1 font-medium">
                  Preço base para cálculo de lucro
                </p>
              </div>
            </div>

            {formData.sellingPrice > 0 && formData.averageCost > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <p className="text-green-800 text-sm font-bold">Estimativa de Lucro Bruto</p>
                  <p className="text-xs text-green-600">Por {formData.measurementUnit}</p>
                </div>
                <div className="text-right">
                  <p className="text-green-800 font-bold text-lg">
                    R$ {(formData.sellingPrice - formData.averageCost).toFixed(2)}
                  </p>
                  <p className="text-green-600 text-sm font-medium">
                    {(((formData.sellingPrice - formData.averageCost) / formData.sellingPrice) * 100).toFixed(1)}% de margem
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Actions */}
          <div className="flex gap-4 pt-6 border-t border-border sticky bottom-0 bg-white dark:bg-card pb-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2"
            >
              <Save className="w-5 h-5" />
              {product ? 'Salvar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </div>
      
      {/* Scanner Modal */}
      {isScanning && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-t-2xl p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Scanner de Código de Barras</h3>
                <button
                  onClick={stopScan}
                  className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                Aponte a câmera para o código de barras do produto
              </p>
            </div>
            
            <div id="barcode-reader" className="w-full bg-black rounded-b-2xl overflow-hidden"></div>
            
            <div className="mt-4 text-center">
              <button
                onClick={stopScan}
                className="px-6 py-3 bg-white text-gray-900 rounded-xl font-bold hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}