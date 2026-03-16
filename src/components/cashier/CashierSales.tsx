import React from 'react';
import {
  Receipt,
  Clock,
  DollarSign,
  Banknote,
  Smartphone,
  CreditCard,
  ShoppingBag,
  Calendar,
  TrendingUp,
  Package
} from 'lucide-react';

interface CashierSalesProps {
  register: {
    id: string;
    sales: Array<{
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
    }>;
    currentBalance: number;
    initialBalance: number;
  };
  onSaleComplete?: () => void;
}

export function CashierSales({ register }: CashierSalesProps) {
  console.log('📊 CashierSales rendering with register:', register?.id);
  console.log('📊 Sales count:', register?.sales?.length || 0);
  console.log('📊 Sales data:', register?.sales);

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

  const paymentMethodColors = {
    money: 'bg-green-100 text-green-700',
    pix: 'bg-blue-100 text-blue-700',
    credit: 'bg-purple-100 text-purple-700',
    debit: 'bg-orange-100 text-orange-700',
  };

  const totalSales = register.sales?.length || 0;
  const totalRevenue = register.sales?.reduce((sum, sale) => sum + sale.total, 0) || 0;
  const totalItems = register.sales?.reduce((sum, sale) => 
    sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0
  ) || 0;

  // Group sales by payment method
  const salesByPayment = register.sales?.reduce((acc, sale) => {
    if (!acc[sale.paymentMethod]) {
      acc[sale.paymentMethod] = { count: 0, total: 0 };
    }
    acc[sale.paymentMethod].count++;
    acc[sale.paymentMethod].total += sale.total;
    return acc;
  }, {} as Record<string, { count: number; total: number }>);

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Receipt className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90 font-bold">Total de Vendas</p>
          <p className="text-3xl font-black mt-1">{totalSales}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90 font-bold">Faturamento</p>
          <p className="text-3xl font-black mt-1">R$ {totalRevenue.toFixed(2)}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Package className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90 font-bold">Itens Vendidos</p>
          <p className="text-3xl font-black mt-1">{totalItems}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-sm opacity-90 font-bold">Ticket Médio</p>
          <p className="text-3xl font-black mt-1">
            R$ {totalSales > 0 ? (totalRevenue / totalSales).toFixed(2) : '0.00'}
          </p>
        </div>
      </div>

      {/* Payment Methods Breakdown */}
      {salesByPayment && Object.keys(salesByPayment).length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-blue-600" />
            Vendas por Forma de Pagamento
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(salesByPayment).map(([method, data]) => {
              const PaymentIcon = paymentMethodIcons[method as keyof typeof paymentMethodIcons];
              return (
                <div
                  key={method}
                  className="bg-gray-50 rounded-xl p-4 border border-gray-200"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethodColors[method as keyof typeof paymentMethodColors]}`}>
                      <PaymentIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 font-bold">
                        {paymentMethodLabels[method as keyof typeof paymentMethodLabels]}
                      </p>
                      <p className="text-sm font-black text-gray-900">{data.count} vendas</p>
                    </div>
                  </div>
                  <p className="text-2xl font-black text-gray-900">
                    R$ {data.total.toFixed(2)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sales List */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            Lista de Vendas
          </h3>
        </div>

        {!register.sales || register.sales.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500 font-bold">Nenhuma venda realizada ainda</p>
            <p className="text-sm text-gray-400 mt-1">
              As vendas aparecerão aqui após serem finalizadas
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {register.sales.slice().reverse().map((sale, index) => {
              const PaymentIcon = paymentMethodIcons[sale.paymentMethod];
              const totalItems = sale.items.reduce((sum, item) => sum + item.quantity, 0);
              
              return (
                <div key={sale.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Receipt className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-black text-gray-900">
                            Venda #{register.sales.length - index}
                          </p>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${paymentMethodColors[sale.paymentMethod]}`}>
                            {paymentMethodLabels[sale.paymentMethod]}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(sale.timestamp).toLocaleTimeString('pt-BR')}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            <span>{totalItems} {totalItems === 1 ? 'item' : 'itens'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-gray-900">
                        R$ {sale.total.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Items */}
                  <div className="ml-13 mt-3 space-y-2">
                    {sale.items.map((item, itemIndex) => (
                      <div
                        key={itemIndex}
                        className="flex items-center justify-between text-sm bg-gray-50 rounded-lg p-2"
                      >
                        <div>
                          <span className="font-bold text-gray-900">{item.quantity}x</span>
                          <span className="text-gray-700 ml-2">{item.name}</span>
                        </div>
                        <span className="font-bold text-gray-900">
                          R$ {(item.quantity * item.price).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Cash Details */}
                  {sale.paymentMethod === 'money' && sale.paymentDetails && (
                    <div className="ml-13 mt-3 pt-3 border-t border-gray-200 grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Recebido:</p>
                        <p className="font-bold text-gray-900">
                          R$ {sale.paymentDetails.cashReceived?.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Troco:</p>
                        <p className="font-bold text-green-600">
                          R$ {sale.paymentDetails.change?.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}