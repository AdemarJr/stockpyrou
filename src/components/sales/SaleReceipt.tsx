import React, { useRef } from 'react';
import { X, Download, Share2, Mail, MessageCircle, Printer } from 'lucide-react';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { toast } from 'sonner@2.0.3';
import logoImg from "figma:asset/e8d336438522d7b8e8099c7d47e7869928dfd8f9.png";

interface SaleReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface SaleReceiptProps {
  items: SaleReceiptItem[];
  total: number;
  saleDate: Date;
  onClose: () => void;
}

export function SaleReceipt({ items, total, saleDate, onClose }: SaleReceiptProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const receiptRef = useRef<HTMLDivElement>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  };

  const generateReceiptNumber = () => {
    const timestamp = Date.now().toString().slice(-8);
    return `${timestamp}`;
  };

  const receiptNumber = generateReceiptNumber();

  const handlePrint = () => {
    window.print();
    toast.success('Cupom enviado para impressora');
  };

  const handleDownload = async () => {
    try {
      // Create a simple text version
      const textContent = generateTextReceipt();
      const blob = new Blob([textContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cupom-${receiptNumber}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Cupom baixado com sucesso!');
    } catch (error) {
      console.error('Error downloading receipt:', error);
      toast.error('Erro ao baixar cupom');
    }
  };

  const generateTextReceipt = () => {
    const lines = [
      '========================================',
      currentCompany?.name.toUpperCase() || 'PYROUSTOCK',
      '========================================',
      `Cupom Fiscal: ${receiptNumber}`,
      `Data: ${formatDateTime(saleDate)}`,
      `Operador: ${user?.fullName || 'Sistema'}`,
      '========================================',
      'PRODUTOS',
      '========================================',
    ];

    items.forEach(item => {
      lines.push(`${item.name}`);
      lines.push(`  ${item.quantity} x ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}`);
    });

    lines.push('========================================');
    lines.push(`TOTAL: ${formatCurrency(total)}`);
    lines.push('========================================');
    lines.push('');
    lines.push('Obrigado pela preferência!');
    lines.push('');

    return lines.join('\n');
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Cupom Fiscal #${receiptNumber} - ${currentCompany?.name}`);
    const body = encodeURIComponent(generateTextReceipt());
    window.open(`mailto:?subject=${subject}&body=${body}`);
    toast.success('Abrindo cliente de email...');
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(generateTextReceipt());
    window.open(`https://wa.me/?text=${text}`, '_blank');
    toast.success('Abrindo WhatsApp...');
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:bg-white print:block print:p-0">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-2xl print:shadow-none print:max-w-full print:rounded-none">
        {/* Header - Hidden on print */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 z-10 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
              <Printer className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold dark:text-white">Cupom Fiscal</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">#{receiptNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Receipt Content */}
        <div ref={receiptRef} className="p-6 print:p-8">
          {/* Company Logo & Info */}
          <div className="text-center mb-6">
            <img src={logoImg} alt="Logo" className="w-16 h-16 mx-auto mb-3 rounded-xl object-contain" />
            <h1 className="text-xl font-bold dark:text-white print:text-black">{currentCompany?.name.toUpperCase()}</h1>
            {currentCompany?.cnpj && (
              <p className="text-xs text-gray-600 dark:text-gray-400 print:text-gray-700">CNPJ: {currentCompany.cnpj}</p>
            )}
            {currentCompany?.email && (
              <p className="text-xs text-gray-600 dark:text-gray-400 print:text-gray-700">{currentCompany.email}</p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t-2 border-dashed border-gray-300 dark:border-gray-600 print:border-gray-400 my-4"></div>

          {/* Receipt Info */}
          <div className="space-y-1 mb-4 text-sm">
            <div className="flex justify-between dark:text-gray-300 print:text-black">
              <span className="font-medium">Cupom Fiscal:</span>
              <span className="font-mono">#{receiptNumber}</span>
            </div>
            <div className="flex justify-between dark:text-gray-300 print:text-black">
              <span className="font-medium">Data/Hora:</span>
              <span>{formatDateTime(saleDate)}</span>
            </div>
            <div className="flex justify-between dark:text-gray-300 print:text-black">
              <span className="font-medium">Operador:</span>
              <span>{user?.fullName || 'Sistema'}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-dashed border-gray-300 dark:border-gray-600 print:border-gray-400 my-4"></div>

          {/* Items */}
          <div className="mb-4">
            <h3 className="font-bold text-sm mb-3 dark:text-white print:text-black">PRODUTOS</h3>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div key={index} className="text-sm">
                  <div className="font-medium dark:text-gray-200 print:text-black">{item.name}</div>
                  <div className="flex justify-between text-gray-600 dark:text-gray-400 print:text-gray-700 text-xs">
                    <span>{item.quantity} x {formatCurrency(item.unitPrice)}</span>
                    <span className="font-medium">{formatCurrency(item.total)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t-2 border-dashed border-gray-300 dark:border-gray-600 print:border-gray-400 my-4"></div>

          {/* Total */}
          <div className="bg-gray-50 dark:bg-gray-700 print:bg-gray-100 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center">
              <span className="text-lg font-bold dark:text-white print:text-black">TOTAL</span>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400 print:text-green-700">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Footer Message */}
          <div className="text-center text-sm text-gray-600 dark:text-gray-400 print:text-gray-700 space-y-1">
            <p className="font-medium">Obrigado pela preferência!</p>
            <p className="text-xs">Volte sempre!</p>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-gray-300 dark:border-gray-600 print:border-gray-400 mt-6 pt-4">
            <p className="text-center text-[10px] text-gray-500 dark:text-gray-500 print:text-gray-600">
              Documento gerado pelo PyrouStock
            </p>
          </div>
        </div>

        {/* Action Buttons - Hidden on print */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-3 print:hidden">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              <Download className="w-4 h-4" />
              Baixar
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white dark:bg-gray-800 px-2 text-gray-500 dark:text-gray-400">Compartilhar</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleShareEmail}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              <Mail className="w-4 h-4" />
              Email
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-3 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* Print-specific styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block,
          .print\\:block * {
            visibility: visible;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: 80mm auto;
            margin: 0;
          }
        }
      `}</style>
    </div>
  );
}
