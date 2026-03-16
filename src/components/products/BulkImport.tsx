import React, { useState, useRef } from 'react';
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import type { Product, MeasurementUnit } from '../../types';

interface BulkImportProps {
  onImport: (products: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<void>;
  onClose: () => void;
}

interface ImportError {
  row: number;
  field: string;
  message: string;
}

export function BulkImport({ onImport, onClose }: BulkImportProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [successCount, setSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = [
      'nome',
      'categoria',
      'unidade_medida',
      'estoque_minimo',
      'estoque_seguranca',
      'custo_medio',
      'preco_venda',
      'codigo_barras',
      'perecivel',
      'validade_dias'
    ];

    const exampleData = [
      'Arroz Branco 5kg',
      'alimento',
      'kg',
      '10',
      '20',
      '25.50',
      '35.00',
      '7891234567890',
      'não',
      ''
    ];

    const csvContent = [
      headers.join(','),
      exampleData.join(','),
      // Linha em branco para começar a preencher
      Array(headers.length).fill('').join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_produtos_pyroustock.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Template baixado com sucesso!');
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim());
    return lines.map(line => {
      // Simple CSV parser - handles basic cases
      const values: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      return values;
    });
  };

  const validateAndParse = (rows: string[][]): { products: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[], errors: ImportError[] } => {
    const products: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const errors: ImportError[] = [];
    
    console.log('🔍 Starting validation of', rows.length - 1, 'data rows');
    
    // Skip header row
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      
      console.log(`📝 Processing row ${rowNum}:`, row);
      
      // Skip empty rows
      if (row.every(cell => !cell.trim())) {
        console.log(`⏭️  Row ${rowNum} is empty, skipping`);
        continue;
      }
      
      const [
        name,
        category,
        measurementUnit,
        minStock,
        safetyStock,
        averageCost,
        sellingPrice,
        barcode,
        isPerishable,
        shelfLife
      ] = row;

      console.log(`🔎 Row ${rowNum} values:`, {
        name,
        category,
        measurementUnit,
        minStock,
        safetyStock,
        averageCost,
        sellingPrice,
        barcode,
        isPerishable,
        shelfLife
      });

      // Validations
      if (!name || !name.trim()) {
        errors.push({ row: rowNum, field: 'nome', message: 'Nome é obrigatório' });
        console.log(`❌ Row ${rowNum}: Nome vazio`);
        continue;
      }

      const validCategories = ['alimento', 'bebida', 'descartavel', 'limpeza', 'outro'];
      const normalizedCategory = category?.toLowerCase().trim();
      if (!normalizedCategory || !validCategories.includes(normalizedCategory)) {
        errors.push({ 
          row: rowNum, 
          field: 'categoria', 
          message: `Categoria inválida: "${category}". Use: ${validCategories.join(', ')}` 
        });
        console.log(`❌ Row ${rowNum}: Categoria inválida "${category}"`);
        continue;
      }

      const validUnits = ['kg', 'g', 'l', 'ml', 'un', 'cx', 'pct', 'porcao', 'saco'];
      const normalizedUnit = measurementUnit?.toLowerCase().trim();
      if (!normalizedUnit || !validUnits.includes(normalizedUnit)) {
        errors.push({ 
          row: rowNum, 
          field: 'unidade_medida', 
          message: `Unidade inválida: \"${measurementUnit}\". Use: ${validUnits.join(', ')}` 
        });
        console.log(`❌ Row ${rowNum}: Unidade inválida \"${measurementUnit}\"`);
        continue;
      }

      const parsedMinStock = parseFloat(minStock) || 0;
      const parsedSafetyStock = parseFloat(safetyStock) || 0;
      const parsedAverageCost = parseFloat(averageCost) || 0;
      const parsedSellingPrice = parseFloat(sellingPrice) || 0;
      const parsedShelfLife = parseFloat(shelfLife) || 0;
      const parsedIsPerishable = isPerishable?.toLowerCase().trim() === 'sim' || isPerishable?.toLowerCase().trim() === 's';

      if (parsedAverageCost <= 0) {
        errors.push({ row: rowNum, field: 'custo_medio', message: `Custo médio deve ser maior que zero (valor informado: "${averageCost}")` });
        console.log(`❌ Row ${rowNum}: Custo médio inválido "${averageCost}"`);
        continue;
      }

      const product = {
        name: name.trim(),
        category: normalizedCategory as any,
        measurementUnit: normalizedUnit as MeasurementUnit,
        minStock: parsedMinStock,
        safetyStock: parsedSafetyStock,
        currentStock: 0, // Initial stock is 0, user will add via stock entry
        averageCost: parsedAverageCost,
        sellingPrice: parsedSellingPrice || null,
        barcode: barcode?.trim() || undefined,
        isPerishable: parsedIsPerishable,
        shelfLife: parsedIsPerishable ? parsedShelfLife : undefined,
        supplierId: undefined,
      };
      
      products.push(product);
      console.log(`✅ Row ${rowNum} validated successfully:`, product);
    }

    console.log('📊 Validation complete:', products.length, 'valid products,', errors.length, 'errors');
    return { products, errors };
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('📁 File selected:', file.name, file.type, file.size);

    // Check file type
    if (!file.name.endsWith('.csv')) {
      toast.error('Por favor, selecione um arquivo CSV');
      return;
    }

    setIsProcessing(true);
    setErrors([]);
    setSuccessCount(0);

    try {
      const text = await file.text();
      console.log('📄 File content preview:', text.substring(0, 200));
      
      const rows = parseCSV(text);
      console.log('📊 Parsed rows:', rows.length, 'rows');
      console.log('📋 First 3 rows:', rows.slice(0, 3));

      if (rows.length < 2) {
        toast.error('Arquivo vazio ou sem dados');
        setIsProcessing(false);
        return;
      }

      const { products, errors: validationErrors } = validateAndParse(rows);
      console.log('✅ Valid products:', products.length);
      console.log('❌ Validation errors:', validationErrors.length);

      if (validationErrors.length > 0) {
        setErrors(validationErrors);
        toast.error(`${validationErrors.length} erro(s) encontrado(s). Corrija e tente novamente.`);
        setIsProcessing(false);
        return;
      }

      if (products.length === 0) {
        toast.error('Nenhum produto válido encontrado no arquivo');
        setIsProcessing(false);
        return;
      }

      console.log('🚀 Starting import of', products.length, 'products');
      // Import products
      await onImport(products);
      setSuccessCount(products.length);
      toast.success(`${products.length} produto(s) importado(s) com sucesso!`);
      
      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      console.error('💥 Error importing products:', error);
      toast.error(`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'Verifique o formato'}`);
    } finally {
      setIsProcessing(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div>
            <h2 className="text-2xl font-bold dark:text-white">Importação em Massa</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Importe múltiplos produtos de uma vez via CSV</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            disabled={isProcessing}
          >
            <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Como usar:
            </h3>
            <ol className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-decimal list-inside">
              <li>Baixe o template CSV clicando no botão abaixo</li>
              <li>Preencha os dados dos produtos no arquivo</li>
              <li>Salve o arquivo e faça o upload</li>
              <li>Os produtos serão validados e importados automaticamente</li>
            </ol>
          </div>

          {/* Download Template */}
          <div className="space-y-3">
            <h3 className="font-bold dark:text-white">1. Baixar Template</h3>
            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center gap-3 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
              disabled={isProcessing}
            >
              <Download className="w-5 h-5 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              <span className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Baixar Template CSV
              </span>
            </button>
          </div>

          {/* Upload File */}
          <div className="space-y-3">
            <h3 className="font-bold dark:text-white">2. Fazer Upload</h3>
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                disabled={isProcessing}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className={`w-full flex items-center justify-center gap-3 p-6 border-2 border-dashed rounded-lg transition-colors cursor-pointer ${
                  isProcessing
                    ? 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 cursor-not-allowed'
                    : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 group'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
                    <span className="font-medium text-gray-600 dark:text-gray-400">Processando arquivo...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-6 h-6 text-gray-500 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                    <div className="text-center">
                      <p className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        Clique para selecionar o arquivo CSV
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Apenas arquivos .csv são aceitos
                      </p>
                    </div>
                  </>
                )}
              </label>
            </div>
          </div>

          {/* Success Message */}
          {successCount > 0 && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-300">
                <CheckCircle className="w-5 h-5" />
                <span className="font-bold">{successCount} produto(s) importado(s) com sucesso!</span>
              </div>
            </div>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h3 className="font-bold text-red-900 dark:text-red-300 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Erros encontrados ({errors.length}):
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {errors.map((error, idx) => (
                  <div key={idx} className="text-sm text-red-800 dark:text-red-300 bg-red-100 dark:bg-red-900/30 p-2 rounded">
                    <strong>Linha {error.row}</strong> - {error.field}: {error.message}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Field Reference */}
          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Referência de Campos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div>
                <strong className="text-gray-900 dark:text-gray-100">categoria:</strong>
                <span className="text-gray-600 dark:text-gray-400"> alimento, bebida, descartavel, limpeza, outro</span>
              </div>
              <div>
                <strong className="text-gray-900 dark:text-gray-100">unidade_medida:</strong>
                <span className="text-gray-600 dark:text-gray-400"> kg, g, l, ml, un, cx, pct, porcao, saco</span>
              </div>
              <div>
                <strong className="text-gray-900 dark:text-gray-100">perecivel:</strong>
                <span className="text-gray-600 dark:text-gray-400"> sim ou não</span>
              </div>
              <div>
                <strong className="text-gray-900 dark:text-gray-100">validade_dias:</strong>
                <span className="text-gray-600 dark:text-gray-400"> número (apenas se perecível)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}