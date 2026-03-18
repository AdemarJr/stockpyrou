import { useState } from 'react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Upload, FileText, Download, AlertCircle, CheckCircle2, X, Plus, Edit2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import type { Product, Category } from '../../types';

interface ImportProductRow {
  line: number;
  barcode: string;
  name: string;
  description: string;
  category: string;
  unitPrice: number;
  costPrice: number;
  measurementUnit: string;
  minStock: number;
  safetyStock: number;
  status: 'new' | 'exists' | 'error';
  message?: string;
  existingProduct?: Product;
  shouldUpdate?: boolean;
}

interface ProductImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  categories: Category[];
  onImport: (rows: ImportProductRow[]) => void;
}

export function ProductImport({
  open,
  onOpenChange,
  products,
  categories,
  onImport
}: ProductImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportProductRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);

  const downloadTemplate = () => {
    const csvContent = [
      'codigo_barras,nome,descricao,categoria,preco_venda,preco_custo,unidade_medida,estoque_minimo,estoque_seguranca',
      '7891234567890,Produto Exemplo 1,Descrição do produto 1,Alimentos,25.50,18.00,UN,5,10',
      '7899876543210,Produto Exemplo 2,Descrição do produto 2,Bebidas,15.00,10.50,UN,10,20',
      ',Produto Sem Código,Descrição do produto 3,Limpeza,8.75,5.00,UN,3,8',
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'template_produtos_nfe.csv';
    link.click();
    toast.success('Template CSV baixado com sucesso!');
  };

  const parseXML = (xmlContent: string): any[] => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
      
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('Formato XML inválido');
      }

      const items: any[] = [];
      let detElements = xmlDoc.querySelectorAll('det');
      
      if (detElements.length === 0) {
        detElements = xmlDoc.querySelectorAll('item');
      }

      if (detElements.length === 0) {
        throw new Error('Nenhum item encontrado no XML. Verifique se é uma NF-e válida.');
      }

      detElements.forEach((det, index) => {
        const prod = det.querySelector('prod');
        if (!prod) return;

        const item: any = {
          lineNumber: index + 1,
          codigo_barras: 
            prod.querySelector('cEAN')?.textContent || 
            prod.querySelector('cEANTrib')?.textContent ||
            prod.querySelector('cProd')?.textContent || 
            '',
          nome: 
            prod.querySelector('xProd')?.textContent || 
            prod.querySelector('desc')?.textContent ||
            '',
          descricao: prod.querySelector('xProd')?.textContent || '',
          // Try to extract category from NCM or use default
          categoria: prod.querySelector('NCM')?.textContent || 'Geral',
          preco_custo: 
            prod.querySelector('vUnCom')?.textContent || 
            prod.querySelector('vUnTrib')?.textContent ||
            '0',
          preco_venda: '0', // Will be calculated or set manually
          unidade_medida: 
            prod.querySelector('uCom')?.textContent || 
            prod.querySelector('uTrib')?.textContent ||
            'UN',
          estoque_minimo: '5',
          estoque_seguranca: '10',
        };

        // Clean barcode
        if (item.codigo_barras && item.codigo_barras !== 'SEM GTIN') {
          item.codigo_barras = item.codigo_barras.trim();
          if (item.codigo_barras === 'SEM GTIN' || item.codigo_barras.length < 8) {
            item.codigo_barras = '';
          }
        }

        // Clean numeric values
        item.preco_custo = item.preco_custo.replace(',', '.');
        
        // Set default sale price as cost + 30% margin
        const cost = parseFloat(item.preco_custo);
        if (cost > 0) {
          item.preco_venda = (cost * 1.3).toFixed(2);
        }

        // Clean unit
        item.unidade_medida = item.unidade_medida.toUpperCase();

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

  const validateAndProcess = (rows: any[]): ImportProductRow[] => {
    return rows.map((row) => {
      const importRow: ImportProductRow = {
        line: row.lineNumber,
        barcode: row.codigo_barras || row.barcode || row.codigo || row.ean || '',
        name: row.nome || row.nome_produto || row.produto || row.name || row.descricao || '',
        description: row.descricao || row.description || row.desc || '',
        category: row.categoria || row.category || row.cat || 'Geral',
        costPrice: parseFloat(row.preco_custo || row.custo || row.cost || row.preco_unitario || '0'),
        unitPrice: parseFloat(row.preco_venda || row.preco || row.price || row.valor || '0'),
        measurementUnit: (row.unidade_medida || row.unidade || row.unit || row.un || 'UN').toUpperCase(),
        minStock: parseInt(row.estoque_minimo || row.min_stock || row.minimo || '5', 10),
        safetyStock: parseInt(row.estoque_seguranca || row.safety_stock || row.seguranca || '10', 10),
        status: 'new',
      };

      // Validações básicas
      if (!importRow.name) {
        importRow.status = 'error';
        importRow.message = 'Nome do produto obrigatório';
        return importRow;
      }

      if (importRow.costPrice < 0) {
        importRow.status = 'error';
        importRow.message = 'Preço de custo inválido';
        return importRow;
      }

      // If no sale price, calculate with 30% margin
      if (importRow.unitPrice === 0 && importRow.costPrice > 0) {
        importRow.unitPrice = parseFloat((importRow.costPrice * 1.3).toFixed(2));
      }

      // Check if product exists
      let existingProduct: Product | undefined;

      if (importRow.barcode) {
        existingProduct = products.find(p => p.barcode === importRow.barcode);
      }

      if (!existingProduct) {
        existingProduct = products.find(
          p => p.name.toLowerCase() === importRow.name.toLowerCase()
        );
      }

      if (existingProduct) {
        importRow.status = 'exists';
        importRow.existingProduct = existingProduct;
        importRow.message = `Produto já existe: ${existingProduct.name}`;
        importRow.shouldUpdate = updateExisting;
      } else {
        importRow.status = 'new';
        importRow.message = 'Produto será criado';
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
      
      const newCount = processedRows.filter(r => r.status === 'new').length;
      const existsCount = processedRows.filter(r => r.status === 'exists').length;
      const errorCount = processedRows.filter(r => r.status === 'error').length;

      toast.success(
        `${processedRows.length} produtos processados: ${newCount} novos, ${existsCount} existentes, ${errorCount} erros`
      );
    } catch (error: any) {
      console.error('Error processing CSV/XML:', error);
      toast.error(`Erro ao processar arquivo: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = () => {
    const validRows = preview.filter(r => r.status !== 'error');
    
    if (validRows.length === 0) {
      toast.error('Nenhum produto válido para importar');
      return;
    }

    // Filter based on update setting
    const rowsToImport = updateExisting 
      ? validRows 
      : validRows.filter(r => r.status === 'new');

    if (rowsToImport.length === 0) {
      toast.error('Nenhum produto para importar. Habilite "Atualizar existentes" se desejar atualizar produtos já cadastrados.');
      return;
    }

    onImport(rowsToImport);
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setPreview([]);
    setUpdateExisting(false);
    onOpenChange(false);
  };

  const handleUpdateExistingToggle = () => {
    setUpdateExisting(!updateExisting);
    // Reprocess with new setting
    if (preview.length > 0) {
      const reprocessed = preview.map(row => ({
        ...row,
        shouldUpdate: !updateExisting && row.status === 'exists',
      }));
      setPreview(reprocessed);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'text-green-600 bg-green-50 dark:bg-green-900/20';
      case 'exists': return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20';
      case 'error': return 'text-red-600 bg-red-50 dark:bg-red-900/20';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'new': return <Plus className="w-4 h-4" />;
      case 'exists': return <Edit2 className="w-4 h-4" />;
      case 'error': return <X className="w-4 h-4" />;
      default: return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'new': return 'Novo';
      case 'exists': return 'Existe';
      case 'error': return 'Erro';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar Produtos (CSV/XML NF-e)</DialogTitle>
          <DialogDescription>
            Cadastre múltiplos produtos automaticamente usando arquivo CSV ou XML da nota fiscal
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                  Formatos Suportados
                </h4>
                <div className="space-y-2 mb-3">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>📄 XML (NF-e SEFAZ):</strong> Importa produtos diretamente do XML da nota fiscal. Extrai: código EAN, nome, descrição, preço de custo e unidade de medida.
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <strong>📊 CSV:</strong> Arquivo customizado com as colunas: <code className="bg-blue-100 dark:bg-blue-800 px-1 py-0.5 rounded text-xs">codigo_barras, nome, descricao, categoria, preco_venda, preco_custo, unidade_medida, estoque_minimo, estoque_seguranca</code>
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
                Importe produtos do XML da NF-e ou arquivo CSV customizado
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
                    Preview da Importação ({preview.length} produtos)
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

              {/* Update Existing Toggle */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={updateExisting}
                    onChange={handleUpdateExistingToggle}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
                      Atualizar produtos existentes
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-0.5">
                      Se marcado, produtos que já existem no sistema terão seus dados atualizados. Caso contrário, apenas produtos novos serão importados.
                    </p>
                  </div>
                </label>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                          #
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Código EAN
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Nome
                        </th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Categoria
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Custo
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600 dark:text-gray-300">
                          Venda
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                          UN
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
                              <span>{getStatusText(row.status)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100 font-mono text-xs">
                            {row.barcode || '-'}
                          </td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100 max-w-xs truncate">
                            {row.name}
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs">
                            {row.category}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                            R$ {row.costPrice.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100 font-semibold">
                            R$ {row.unitPrice.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-center text-gray-600 dark:text-gray-400 text-xs font-mono">
                            {row.measurementUnit}
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
                    <Plus className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-900 dark:text-green-100">
                      {preview.filter(r => r.status === 'new').length} Novos
                    </span>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                      {preview.filter(r => r.status === 'exists').length} Existentes
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
              disabled={preview.filter(r => r.status !== 'error' && (r.status === 'new' || updateExisting)).length === 0}
            >
              <Plus className="w-4 h-4 mr-2" />
              Importar {preview.filter(r => r.status !== 'error' && (r.status === 'new' || updateExisting)).length} Produtos
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
