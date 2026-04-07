import { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Upload, FileText, Download, AlertCircle, CheckCircle2, X, Plus, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import type { Product, Supplier } from '../../types';
import { projectId, publicAnonKey } from '../../utils/supabase/env';

interface ImportRow {
  line: number;
  barcode: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  batchNumber?: string;
  expirationDate?: string;
  status: 'valid' | 'warning' | 'error';
  message?: string;
  matchedProduct?: Product;
  shouldCreate?: boolean;
}

interface StockEntryImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  suppliers: Supplier[];
  selectedSupplier: string;
  onImport: (rows: ImportRow[]) => void;
}

export function StockEntryImport({
  open,
  onOpenChange,
  products,
  suppliers,
  selectedSupplier,
  onImport
}: StockEntryImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [invoiceInfo, setInvoiceInfo] = useState<any>(null);
  const [isDuplicateInvoice, setIsDuplicateInvoice] = useState(false);

  const downloadTemplate = () => {
    const csvContent = [
      'codigo_barras,nome_produto,quantidade,preco_unitario,lote,validade',
      '7891234567890,Produto Exemplo 1,10,25.50,LOTE123,2025-12-31',
      '7899876543210,Produto Exemplo 2,5,15.00,LOTE456,2026-06-30',
      ',Produto Sem Código,20,8.75,,',
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_nota_fiscal.csv';
    link.click();
    toast.success('Template CSV baixado com sucesso!');
  };

  const parseXML = (xmlContent: string): any[] => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      // Check for XML parsing errors
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('Formato XML inválido');
      }

      const items: any[] = [];
      
      // Extract invoice number (chave da nota)
      const nfeKey = xmlDoc.querySelector('infNFe')?.getAttribute('Id')?.replace('NFe', '') || '';
      const nfeNumber = xmlDoc.querySelector('nNF')?.textContent || '';
      const nfeSerie = xmlDoc.querySelector('serie')?.textContent || '';
      const invoiceId = nfeKey || `${nfeSerie}-${nfeNumber}`;
      
      // Try to find items in NFe structure (standard SEFAZ format)
      // Structure: nfeProc > NFe > infNFe > det (multiple)
      let detElements = xmlDoc.querySelectorAll('det');
      
      // If not found, try alternative structures
      if (detElements.length === 0) {
        detElements = xmlDoc.querySelectorAll('item');
      }

      if (detElements.length === 0) {
        throw new Error('Nenhum item encontrado no XML. Verifique se é uma NF-e válida.');
      }

      detElements.forEach((det, index) => {
        // Get product data (prod element)
        const prod = det.querySelector('prod');
        if (!prod) return;

        const item: any = {
          lineNumber: index + 1,
          invoiceId, // Add invoice ID to each item
          invoiceNumber: nfeNumber,
          invoiceSeries: nfeSerie,
          // Try multiple field names for barcode
          codigo_barras: 
            prod.querySelector('cEAN')?.textContent || 
            prod.querySelector('cEANTrib')?.textContent ||
            prod.querySelector('cProd')?.textContent || 
            '',
          // Product name
          nome_produto: 
            prod.querySelector('xProd')?.textContent || 
            prod.querySelector('desc')?.textContent ||
            '',
          // Quantity
          quantidade: 
            prod.querySelector('qCom')?.textContent || 
            prod.querySelector('qTrib')?.textContent ||
            '0',
          // Unit price
          preco_unitario: 
            prod.querySelector('vUnCom')?.textContent || 
            prod.querySelector('vUnTrib')?.textContent ||
            '0',
          // Batch number (if available)
          lote: prod.querySelector('nLote')?.textContent || '',
          // Expiration date (if available)
          validade: 
            prod.querySelector('dVal')?.textContent || 
            prod.querySelector('dValid')?.textContent ||
            '',
        };

        // Clean barcode (remove non-numeric for EAN)
        if (item.codigo_barras && item.codigo_barras !== 'SEM GTIN') {
          item.codigo_barras = item.codigo_barras.trim();
          // If it's "SEM GTIN" or invalid, clear it
          if (item.codigo_barras === 'SEM GTIN' || item.codigo_barras.length < 8) {
            item.codigo_barras = '';
          }
        }

        // Clean numeric values
        item.quantidade = item.quantidade.replace(',', '.');
        item.preco_unitario = item.preco_unitario.replace(',', '.');

        items.push(item);
      });

      return items;
    } catch (error: any) {
      console.error('XML parsing error:', error);
      throw new Error(`Erro ao processar XML: ${error.message}`);
    }
  };

  const parseCSV = (content: string): any[] => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: any = {};
      
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      row.lineNumber = i + 1;
      rows.push(row);
    }

    return rows;
  };

  const validateAndProcess = (rows: any[]): ImportRow[] => {
    return rows.map((row) => {
      const importRow: ImportRow = {
        line: row.lineNumber,
        barcode: row.codigo_barras || row.barcode || row.codigo || '',
        productName: row.nome_produto || row.produto || row.descricao || row.name || '',
        quantity: parseFloat(row.quantidade || row.qtd || row.qty || '0'),
        unitPrice: parseFloat(row.preco_unitario || row.preco || row.valor || row.price || '0'),
        batchNumber: row.lote || row.batch || '',
        expirationDate: row.validade || row.expiration || row.vencimento || '',
        status: 'valid',
      };

      // Validações
      if (!importRow.productName) {
        importRow.status = 'error';
        importRow.message = 'Nome do produto obrigatório';
        return importRow;
      }

      if (importRow.quantity <= 0) {
        importRow.status = 'error';
        importRow.message = 'Quantidade inválida';
        return importRow;
      }

      if (importRow.unitPrice < 0) {
        importRow.status = 'error';
        importRow.message = 'Preço unitário inválido';
        return importRow;
      }

      // Buscar produto existente por código de barras
      if (importRow.barcode) {
        const matchedProduct = products.find(
          p => p.barcode === importRow.barcode
        );

        if (matchedProduct) {
          importRow.matchedProduct = matchedProduct;
          importRow.status = 'valid';
          importRow.message = `Produto encontrado: ${matchedProduct.name}`;
        } else {
          // Buscar por nome similar
          const similarProduct = products.find(
            p => p.name.toLowerCase() === importRow.productName.toLowerCase()
          );

          if (similarProduct) {
            importRow.matchedProduct = similarProduct;
            importRow.status = 'warning';
            importRow.message = `Produto encontrado por nome (código diferente)`;
          } else {
            importRow.status = 'warning';
            importRow.message = 'Produto não encontrado - será necessário cadastro';
            importRow.shouldCreate = true;
          }
        }
      } else {
        // Sem código de barras - buscar por nome
        const matchedProduct = products.find(
          p => p.name.toLowerCase() === importRow.productName.toLowerCase()
        );

        if (matchedProduct) {
          importRow.matchedProduct = matchedProduct;
          importRow.status = 'warning';
          importRow.message = 'Produto encontrado por nome (sem código de barras)';
        } else {
          importRow.status = 'warning';
          importRow.message = 'Produto não encontrado - será necessário cadastro';
          importRow.shouldCreate = true;
        }
      }

      return importRow;
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = event.target.files?.[0];
    if (!uploadedFile) return;

    if (!uploadedFile.name.endsWith('.csv') && !uploadedFile.name.endsWith('.xml')) {
      toast.error('Arquivo deve ser no formato CSV ou XML');
      return;
    }

    setFile(uploadedFile);
    setIsProcessing(true);

    try {
      const content = await uploadedFile.text();
      let parsedRows: any[] = [];

      if (uploadedFile.name.endsWith('.xml')) {
        parsedRows = parseXML(content);
      } else {
        parsedRows = parseCSV(content);
      }
      
      if (parsedRows.length === 0) {
        toast.error('Arquivo CSV/XML vazio ou formato inválido');
        setIsProcessing(false);
        return;
      }

      const processedRows = validateAndProcess(parsedRows);
      setPreview(processedRows);
      
      const validCount = processedRows.filter(r => r.status === 'valid').length;
      const warningCount = processedRows.filter(r => r.status === 'warning').length;
      const errorCount = processedRows.filter(r => r.status === 'error').length;

      toast.success(
        `${processedRows.length} itens processados: ${validCount} válidos, ${warningCount} avisos, ${errorCount} erros`
      );
    } catch (error: any) {
      console.error('Error processing CSV/XML:', error);
      toast.error(`Erro ao processar arquivo: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = () => {
    if (!selectedSupplier) {
      toast.error('Selecione um fornecedor antes de importar');
      return;
    }

    const validRows = preview.filter(r => r.status !== 'error');
    
    if (validRows.length === 0) {
      toast.error('Nenhum item válido para importar');
      return;
    }

    onImport(validRows);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    onOpenChange(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'valid': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'warning': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20';
      case 'error': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'valid': return <CheckCircle2 className="w-4 h-4" />;
      case 'warning': return <AlertCircle className="w-4 h-4" />;
      case 'error': return <X className="w-4 h-4" />;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Nota Fiscal (CSV/XML)</DialogTitle>
          <DialogDescription>
            Importe múltiplos itens de uma nota fiscal usando arquivo CSV ou XML
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Template Download */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Formatos Suportados
                </h4>
                <div className="space-y-2 mb-3">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>📄 XML (NF-e SEFAZ):</strong> Formato oficial da Nota Fiscal Eletrônica emitida pela SEFAZ. Basta fazer o upload do arquivo XML completo.
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>📊 CSV:</strong> Arquivo com as colunas: <code className="bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-xs">codigo_barras, nome_produto, quantidade, preco_unitario, lote, validade</code>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Baixar Template CSV
                </Button>
              </div>
            </div>
          </div>

          {/* File Upload */}
          {!file && (
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center">
              <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Selecione um arquivo CSV ou XML
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Clique no botão abaixo para escolher o arquivo da nota fiscal
              </p>
              <label className="inline-block">
                <input
                  type="file"
                  accept=".csv,.xml"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button type="button" asChild>
                  <span className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-2" />
                    Escolher Arquivo CSV/XML
                  </span>
                </Button>
              </label>
            </div>
          )}

          {/* Preview */}
          {file && preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Preview da Importação ({preview.length} itens)
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    📎 Arquivo: <span className="font-mono">{file.name}</span>
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFile(null);
                    setPreview([]);
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancelar Arquivo
                </Button>
              </div>

              {!selectedSupplier && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <p className="text-sm text-yellow-700 dark:text-yellow-300">
                      <strong>Atenção:</strong> Selecione um fornecedor antes de confirmar a importação
                    </p>
                  </div>
                </div>
              )}

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Linha
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Código
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Produto
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Qtd
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Preço
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Lote
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Mensagem
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {preview.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400">
                            {row.line}
                          </td>
                          <td className="px-3 py-2">
                            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full w-fit ${getStatusColor(row.status)}`}>
                              {getStatusIcon(row.status)}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100 font-mono text-xs">
                            {row.barcode || '-'}
                          </td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                            {row.productName}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                            {row.quantity}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                            R$ {row.unitPrice.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">
                            {row.batchNumber || '-'}
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                            {row.message}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                      {preview.filter(r => r.status === 'valid').length} Válidos
                    </span>
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                    <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
                      {preview.filter(r => r.status === 'warning').length} Avisos
                    </span>
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <X className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-semibold text-red-900 dark:text-red-100">
                      {preview.filter(r => r.status === 'error').length} Erros
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {isProcessing && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">Processando arquivo...</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {preview.length > 0 && (
          <div className="flex gap-3 justify-end border-t pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmImport}
              disabled={!selectedSupplier || preview.filter(r => r.status !== 'error').length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Importar {preview.filter(r => r.status !== 'error').length} Itens
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}