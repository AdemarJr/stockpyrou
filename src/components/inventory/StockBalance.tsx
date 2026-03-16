import React, { useState, useEffect, useRef } from 'react';
import { 
  Barcode, 
  Search, 
  Camera, 
  CheckCircle, 
  AlertTriangle, 
  AlertCircle,
  ArrowRight, 
  Package, 
  RefreshCw,
  X,
  Plus,
  Minus,
  Save
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import type { Product, StockMovement } from '../../types';
import { StockService } from '../../services/StockService';
import { formatCurrency, formatPercentage } from '../../utils/calculations';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { toast } from 'sonner@2.0.3';

interface StockBalanceProps {
  products: Product[];
  onBalanceComplete: () => void;
}

export function StockBalance({ products, onBalanceComplete }: StockBalanceProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [isScanning, setIsScanning] = useState(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState(false);
  const [barcodeQuery, setBarcodeQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [actualQuantity, setActualQuantity] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

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
        
        // Pequeno delay para garantir render do DOM
        timer = setTimeout(async () => {
          const container = document.getElementById("barcode-reader");
          if (!container) {
             console.warn("Elemento barcode-reader não encontrado.");
             return;
          }

          try {
            // Tenta forçar permissão explicitamente antes de iniciar a lib
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
              stream.getTracks().forEach(track => track.stop()); // Fecha imediatamente
            } catch (e) {
              console.log("Permissão já solicitada ou erro silencioso no getUserMedia");
            }

            const html5QrCode = new Html5Qrcode("barcode-reader");
            html5QrCodeRef.current = html5QrCode;

            const config = { 
              fps: 10,
              qrbox: (viewWidth: number, viewHeight: number) => {
                const size = Math.min(viewWidth, viewHeight) * 0.7;
                return { width: size, height: size };
              },
              // Removido aspectRatio fixo para evitar erros em alguns sensores Motorola
            };

            await html5QrCode.start(
              { facingMode: "environment" }, 
              config,
              (decodedText) => {
                handleBarcodeDetected(decodedText);
                stopScanner();
              },
              () => { /* ignore */ }
            ).catch((err) => {
               console.log("Tentativa 2: Qualquer câmera...");
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
            console.error("Scanner error:", err);
            
            let userMessage = "Erro ao acessar câmera.";
            
            // Detect specific errors
            if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
              userMessage = "Permissão de câmera negada. Por favor, permita o acesso à câmera nas configurações do navegador.";
              setCameraError("permission-denied");
            } else if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
              userMessage = "Nenhuma câmera encontrada no dispositivo.";
              setCameraError("camera-not-found");
            } else if (err.name === 'NotReadableError') {
              userMessage = "Câmera já está em uso por outro aplicativo.";
              setCameraError("camera-busy");
            } else if (err.name === 'NotSupportedError' || err.message?.includes('HTTPS')) {
              userMessage = "Scanner de câmera requer conexão HTTPS segura. Use localhost ou HTTPS.";
              setCameraError("https-required");
            } else {
              userMessage = `Erro: ${err.message || 'Falha na inicialização'}`;
              setCameraError(userMessage);
            }
            
            setIsScanning(false);
            setIsLoadingCamera(false);
            toast.error(userMessage, { duration: 5000 });
          }
        }, 500);
      }
    }

    startScanner();

    return () => {
      mounted = false;
      if (timer) clearTimeout(timer);
      // Não chamamos stopScanner aqui para evitar loops, o componente desmontando já limpa
    };
  }, [isScanning]);

  const handleBarcodeDetected = (barcode: string) => {
    setBarcodeQuery(barcode);
    const product = products.find(p => p.barcode === barcode);
    if (product) {
      setSelectedProduct(product);
      setActualQuantity(product.currentStock);
      toast.success(`Produto encontrado: ${product.name}`);
    } else {
      setSelectedProduct(null);
      toast.error(`Produto com código ${barcode} não encontrado.`);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    handleBarcodeDetected(barcodeQuery);
  };

  const handleApplyBalance = async () => {
    if (!selectedProduct || !currentCompany || !user) return;

    try {
      setIsProcessing(true);
      await StockService.setStockBalance(
        currentCompany.id,
        selectedProduct.id,
        actualQuantity,
        user.id,
        notes
      );

      toast.success(`Balanço de ${selectedProduct.name} realizado com sucesso!`);
      setSelectedProduct(null);
      setBarcodeQuery('');
      setActualQuantity(0);
      setNotes('');
      onBalanceComplete();
    } catch (error: any) {
      console.error('Error applying stock balance:', error);
      toast.error(`Erro ao aplicar balanço: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const difference = selectedProduct ? actualQuantity - selectedProduct.currentStock : 0;
  const diffColor = difference > 0 ? 'text-green-600' : difference < 0 ? 'text-red-600' : 'text-gray-600';

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2>Balanço de Estoque</h2>
          <p className="text-gray-600 mt-1">
            Realize inventário rápido usando a câmera ou código de barras
          </p>
        </div>
        <button
          onClick={() => {
            if (isScanning) {
              stopScanner();
            } else {
              setCameraError(null);
              setIsScanning(true);
            }
          }}
          className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-bold transition-all shadow-lg w-full md:w-auto ${
            isScanning ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isScanning ? (
            <><X className="w-6 h-6" /> Cancelar Scanner</>
          ) : (
            <><Camera className="w-6 h-6" /> Escanear com Câmera</>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Side */}
        <div className="space-y-6">
          {isScanning && (
            <div className="bg-white p-4 rounded-2xl border-2 border-blue-500 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
              <div className="flex items-center justify-between mb-4">
                <h3 className="flex items-center gap-2 text-blue-900 font-bold">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-ping"></div>
                  Scanner Ativo
                </h3>
                {isLoadingCamera && (
                  <span className="text-xs text-blue-600 flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Inicializando...
                  </span>
                )}
              </div>
              
              <div 
                className="w-full relative bg-black rounded-xl overflow-hidden shadow-inner border-b-4 border-blue-600"
                style={{ minHeight: '350px' }}
              >
                <div id="barcode-reader" className="w-full h-full"></div>
                
                {isLoadingCamera && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 text-white gap-4 z-20">
                    <RefreshCw className="w-10 h-10 animate-spin text-blue-400" />
                    <p className="text-sm font-medium">Acessando hardware da câmera...</p>
                  </div>
                )}

                {/* Scanning HUD Overlay */}
                <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center">
                   <div className="w-64 h-64 border-2 border-white/30 rounded-3xl flex items-center justify-center relative overflow-hidden">
                      {/* Laser Line */}
                      <div className="w-full h-0.5 bg-red-500 absolute top-1/2 left-0 -translate-y-1/2 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-[scan_2s_ease-in-out_infinite]"></div>
                      
                      {/* Corners */}
                      <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-xl"></div>
                      <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-xl"></div>
                      <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-xl"></div>
                      <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-xl"></div>
                   </div>
                   <p className="text-white/70 text-[10px] mt-4 font-mono uppercase tracking-widest">Alinhe o código no centro</p>
                </div>
              </div>
              
              <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800 leading-relaxed">
                  Dica: Se a imagem estiver escura, tente iluminar o produto. O scanner funciona melhor com códigos EAN-13 (padrão de varejo).
                </p>
              </div>
            </div>
          )}
          
          {cameraError && (
             <div className="bg-red-50 border-2 border-red-200 p-6 rounded-2xl text-red-800 shadow-sm animate-in shake duration-500">
                <div className="flex gap-3 items-center mb-4">
                   <AlertTriangle className="w-8 h-8 text-red-600" />
                   <h4 className="font-bold text-lg">Acesso Bloqueado</h4>
                </div>
                
                {cameraError === "permission-denied" ? (
                  <div className="space-y-4">
                    <p className="text-sm leading-relaxed font-medium">
                      O seu celular impediu o acesso à câmera. Para corrigir isso no **Moto G34**:
                    </p>
                    <ol className="text-sm space-y-3 bg-white/50 p-4 rounded-xl border border-red-100">
                      <li className="flex gap-2">
                        <span className="font-bold">1.</span> 
                        <span>Toque no <strong>ícone de configurações/cadeado</strong> ao lado da barra de endereço (onde fica o link do site).</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold">2.</span> 
                        <span>Vá em <strong>"Configurações do site"</strong> ou <strong>"Permissões"</strong>.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold">3.</span> 
                        <span>Encontre <strong>Câmera</strong> e altere para <strong>"Permitir"</strong>.</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="font-bold">4.</span> 
                        <span>Atualize esta página e tente novamente.</span>
                      </li>
                    </ol>
                    <div className="p-3 bg-amber-100 rounded-lg text-amber-900 text-xs flex gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>Verifique também se o "Acesso à Câmera" não está desligado no painel de privacidade do seu Android.</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm mb-4 leading-relaxed">{cameraError}</p>
                )}

                <div className="flex flex-col gap-2 mt-6">
                   <button 
                     onClick={() => { window.location.reload(); }}
                     className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-red-700 transition-all flex items-center justify-center gap-2 shadow-md"
                   >
                     <RefreshCw className="w-4 h-4" /> Recarregar e Tentar Novamente
                   </button>
                </div>
             </div>
          )}

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm space-y-4">
            <h3 className="flex items-center gap-2">
              <Barcode className="w-5 h-5 text-blue-600" />
              Entrada Manual
            </h3>
            <form onSubmit={handleManualSearch} className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Escaneie ou digite o código de barras..."
                  value={barcodeQuery}
                  onChange={(e) => setBarcodeQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
              >
                Buscar
              </button>
            </form>
            <p className="text-xs text-gray-500">
              Dica: Você pode digitar o código EAN-13 e pressionar Enter.
            </p>
          </div>

          {!selectedProduct && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
              <Package className="w-12 h-12 text-blue-400 mx-auto mb-3 opacity-50" />
              <h4 className="text-blue-800">Aguardando identificação</h4>
              <p className="text-blue-600 text-sm mt-2">
                Escaneie um produto para iniciar o ajuste de balanço.
              </p>
            </div>
          )}

          {selectedProduct && (
            <div className="bg-white p-6 rounded-lg border-2 border-blue-600 shadow-lg space-y-6 animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded uppercase mb-2 inline-block">
                    Produto Identificado
                  </span>
                  <h3 className="text-xl font-bold">{selectedProduct.name}</h3>
                  <p className="text-gray-500 text-sm">{selectedProduct.barcode}</p>
                </div>
                <div className="bg-blue-50 p-3 rounded-full">
                  <Package className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-bold">Estoque Sistema</p>
                  <p className="text-2xl font-bold mt-1">
                    {selectedProduct.currentStock} <span className="text-sm font-normal text-gray-400">{selectedProduct.measurementUnit}</span>
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs text-gray-500 uppercase font-bold">Custo Médio</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(selectedProduct.averageCost)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block font-bold text-gray-700">Quantidade Contada</label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setActualQuantity(q => Math.max(0, q - 1))}
                    className="p-3 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Minus className="w-6 h-6" />
                  </button>
                  <input
                    type="number"
                    value={actualQuantity}
                    onChange={(e) => setActualQuantity(parseFloat(e.target.value) || 0)}
                    className="flex-1 text-center text-3xl font-bold py-3 border border-blue-300 rounded-lg focus:ring-4 focus:ring-blue-100"
                  />
                  <button
                    onClick={() => setActualQuantity(q => q + 1)}
                    className="p-3 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className={`p-4 rounded-lg flex items-center justify-between ${difference === 0 ? 'bg-gray-50' : difference > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div>
                  <p className="text-xs font-bold uppercase text-gray-500">Diferença de Ajuste</p>
                  <p className={`text-lg font-bold ${diffColor}`}>
                    {difference > 0 ? '+' : ''}{difference} {selectedProduct.measurementUnit}
                  </p>
                </div>
                {difference !== 0 && (
                  <div className="text-right">
                    <p className="text-xs font-bold uppercase text-gray-500">Impacto Financeiro</p>
                    <p className={`text-lg font-bold ${diffColor}`}>
                      {formatCurrency(difference * selectedProduct.averageCost)}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notas / Observações</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opcional: Ex: Quebra de estoque, erro de conferência..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-bold transition-colors"
                >
                  Limpar
                </button>
                <button
                  disabled={isProcessing || difference === 0}
                  onClick={handleApplyBalance}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <><RefreshCw className="w-5 h-5 animate-spin" /> Processando...</>
                  ) : (
                    <><Save className="w-5 h-5" /> Confirmar Balanço</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Info Side */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Instruções de Uso
            </h3>
            <ul className="space-y-4 text-sm text-gray-600">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">1</span>
                <p><strong>Escanear:</strong> Aponte a câmera para o código de barras ou digite manualmente.</p>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">2</span>
                <p><strong>Conferir:</strong> Verifique se o produto que apareceu é realmente o item físico.</p>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">3</span>
                <p><strong>Contar:</strong> Informe a quantidade exata que você está vendo na prateleira.</p>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold">4</span>
                <p><strong>Confirmar:</strong> O sistema criará automaticamente uma movimentação de "Ajuste" para igualar os estoques.</p>
              </li>
            </ul>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
            <h3 className="text-orange-800 mb-2 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Atenção
            </h3>
            <p className="text-sm text-orange-700">
              O balanço de estoque altera diretamente a quantidade disponível. Certifique-se de que não há recebimentos pendentes de lançamento para este item antes de confirmar.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
             <h3 className="mb-4">Produtos Recentes Sem Código</h3>
             <div className="space-y-2">
                {products.filter(p => !p.barcode).slice(0, 5).map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded border border-dashed border-gray-200">
                    <span className="text-sm">{p.name}</span>
                    <button className="text-xs text-blue-600 font-bold">Add Código</button>
                  </div>
                ))}
                {products.filter(p => !p.barcode).length === 0 && (
                   <p className="text-sm text-gray-400 italic">Todos os produtos possuem código cadastrado!</p>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}