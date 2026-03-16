import React, { useState } from 'react';
import {
  X,
  Printer,
  Share2,
  Mail,
  CheckCircle2,
  Clock,
  Receipt as ReceiptIcon,
  CreditCard,
  Smartphone,
  Banknote,
  Calendar,
  User,
  Send
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface SaleReceiptProps {
  sale: {
    id: string;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    total: number;
    paymentMethod: 'money' | 'pix' | 'credit' | 'debit';
    paymentDetails?: {
      cashReceived?: number;
      change?: number;
    };
    timestamp: string;
  };
  cashierName: string;
  companyName?: string;
  onClose: () => void;
  onNewSale: () => void;
}

export function SaleReceipt({
  sale,
  cashierName,
  companyName,
  onClose,
  onNewSale,
}: SaleReceiptProps) {
  const [isSending, setIsSending] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');

  const paymentMethodIcons = {
    money: Banknote,
    pix: Smartphone,
    credit: CreditCard,
    debit: CreditCard,
  };

  const paymentMethodLabels = {
    money: 'Dinheiro',
    pix: 'PIX',
    credit: 'Crédito',
    debit: 'Débito',
  };

  const PaymentIcon = paymentMethodIcons[sale.paymentMethod];

  const handlePrint = () => {
    window.print();
    toast.success('Documento preparado para impressão');
  };

  const handleWhatsAppClick = () => {
    setShowWhatsAppModal(true);
  };

  const handleSendWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!whatsappNumber) {
      toast.error('Informe o número do WhatsApp');
      return;
    }

    const text = formatReceiptText();
    // Remove caracteres não numéricos
    const cleanNumber = whatsappNumber.replace(/\D/g, '');
    const url = `https://wa.me/55${cleanNumber}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    toast.success('Abrindo WhatsApp...');
    setShowWhatsAppModal(false);
    setWhatsappNumber('');
  };

  const handleEmailClick = () => {
    setShowEmailModal(true);
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!emailAddress) {
      toast.error('Informe o email do cliente');
      return;
    }

    setIsSending(true);
    try {
      const text = formatReceiptText();
      const subject = `Recibo de Venda - ${sale.id.substring(0, 8)}`;
      const mailtoLink = `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
      window.location.href = mailtoLink;
      toast.success('Abrindo cliente de email...');
      setShowEmailModal(false);
      setEmailAddress('');
    } catch (error) {
      toast.error('Erro ao enviar email');
    } finally {
      setIsSending(false);
    }
  };

  const formatReceiptText = () => {
    const lines = [
      `═══════════════════════════════════`,
      companyName || 'MINHA EMPRESA',
      `RECIBO DE VENDA`,
      `═══════════════════════════════════`,
      ``,
      `Nº: ${sale.id.substring(0, 8).toUpperCase()}`,
      `Data: ${new Date(sale.timestamp).toLocaleString('pt-BR')}`,
      `Caixa: ${cashierName}`,
      ``,
      `───────────────────────────────────`,
      `ITENS:`,
      `───────────────────────────────────`,
    ];

    sale.items.forEach((item) => {
      lines.push(`${item.quantity}x ${item.name}`);
      lines.push(`    R$ ${item.price.toFixed(2)} = R$ ${(item.quantity * item.price).toFixed(2)}`);
    });

    lines.push(`───────────────────────────────────`);
    lines.push(`TOTAL: R$ ${sale.total.toFixed(2)}`);
    lines.push(`───────────────────────────────────`);
    lines.push(`Pagamento: ${paymentMethodLabels[sale.paymentMethod]}`);

    if (sale.paymentMethod === 'money' && sale.paymentDetails) {
      lines.push(`Recebido: R$ ${sale.paymentDetails.cashReceived?.toFixed(2)}`);
      lines.push(`Troco: R$ ${sale.paymentDetails.change?.toFixed(2)}`);
    }

    lines.push(`═══════════════════════════════════`);
    lines.push(`Obrigado pela preferência!`);
    lines.push(`═══════════════════════════════════`);

    return lines.join('\n');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto print:shadow-none print:max-w-full">
          {/* Header - Don't print close button */}
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-6 text-white print:bg-white print:text-black">
            <div className="flex items-center justify-between mb-4 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-black">Venda Concluída!</h2>
                  <p className="text-green-100 text-sm">Transação realizada com sucesso</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Receipt Header */}
            <div className="text-center print:text-black">
              <h3 className="text-xl font-black mb-2 print:text-2xl">
                {companyName || 'MINHA EMPRESA'}
              </h3>
              <div className="flex items-center justify-center gap-2 text-sm text-green-100 print:text-gray-600">
                <ReceiptIcon className="w-4 h-4" />
                <span className="font-bold">RECIBO DE VENDA</span>
              </div>
            </div>
          </div>

          {/* Receipt Content */}
          <div className="p-6 space-y-6">
            {/* Sale Info */}
            <div className="grid grid-cols-2 gap-4 pb-4 border-b-2 border-dashed border-gray-300">
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <ReceiptIcon className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 font-bold">Nº Venda</p>
                    <p className="text-sm font-black text-gray-900">
                      {sale.id.substring(0, 8).toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 font-bold">Caixa</p>
                    <p className="text-sm font-black text-gray-900">{cashierName}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 font-bold">Data</p>
                    <p className="text-sm font-black text-gray-900">
                      {new Date(sale.timestamp).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-500 font-bold">Hora</p>
                    <p className="text-sm font-black text-gray-900">
                      {new Date(sale.timestamp).toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="text-sm font-black text-gray-700 mb-3 uppercase">
                Itens da Venda
              </h3>
              <div className="space-y-2">
                {sale.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between py-2 border-b border-gray-200 last:border-0"
                  >
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-500">
                        {item.quantity} x R$ {item.price.toFixed(2)}
                      </p>
                    </div>
                    <p className="font-black text-gray-900">
                      R$ {(item.quantity * item.price).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-4 border-2 border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-700 uppercase">
                  Total da Venda
                </span>
                <span className="text-3xl font-black text-blue-600">
                  R$ {sale.total.toFixed(2)}
                </span>
              </div>

              {/* Payment Method */}
              <div className="flex items-center gap-2 text-sm">
                <PaymentIcon className="w-4 h-4 text-blue-600" />
                <span className="font-bold text-gray-700">
                  Pagamento: {paymentMethodLabels[sale.paymentMethod]}
                </span>
              </div>

              {/* Cash Details */}
              {sale.paymentMethod === 'money' && sale.paymentDetails && (
                <div className="mt-3 pt-3 border-t border-blue-200 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Recebido:</span>
                    <span className="font-bold text-gray-900">
                      R$ {sale.paymentDetails.cashReceived?.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Troco:</span>
                    <span className="font-bold text-green-600">
                      R$ {sale.paymentDetails.change?.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Actions - Don't print */}
            <div className="space-y-3 print:hidden">
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={handlePrint}
                  className="flex flex-col items-center gap-2 p-4 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                >
                  <Printer className="w-5 h-5 text-gray-700" />
                  <span className="text-xs font-bold text-gray-700">Imprimir</span>
                </button>
                <button
                  onClick={handleWhatsAppClick}
                  className="flex flex-col items-center gap-2 p-4 bg-green-100 hover:bg-green-200 rounded-xl transition-colors"
                >
                  <Share2 className="w-5 h-5 text-green-700" />
                  <span className="text-xs font-bold text-green-700">WhatsApp</span>
                </button>
                <button
                  onClick={handleEmailClick}
                  className="flex flex-col items-center gap-2 p-4 bg-blue-100 hover:bg-blue-200 rounded-xl transition-colors"
                >
                  <Mail className="w-5 h-5 text-blue-700" />
                  <span className="text-xs font-bold text-blue-700">Email</span>
                </button>
              </div>

              <button
                onClick={onNewSale}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-black text-lg shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
              >
                Nova Venda
              </button>

              <button
                onClick={onClose}
                className="w-full py-3 text-gray-600 hover:text-gray-900 font-bold transition-colors"
              >
                Fechar Recibo
              </button>
            </div>

            {/* Footer */}
            <div className="text-center pt-4 border-t border-gray-200">
              <p className="text-sm font-bold text-gray-600">
                Obrigado pela preferência!
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date().toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-green-600 to-green-500 p-6 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-black">Enviar por WhatsApp</h3>
                </div>
                <button
                  onClick={() => setShowWhatsAppModal(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSendWhatsApp} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Número do Cliente (com DDD)
                </label>
                <input
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-green-600 transition-colors font-bold"
                  autoFocus
                />
                <p className="text-xs text-gray-500 mt-1">
                  Digite apenas números ou com formatação
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowWhatsAppModal(false)}
                  className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-green-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  Enviar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-blue-500 p-6 text-white rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-black">Enviar por Email</h3>
                </div>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSendEmail} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Email do Cliente
                </label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-600 transition-colors font-bold"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1 py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSending}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {isSending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
