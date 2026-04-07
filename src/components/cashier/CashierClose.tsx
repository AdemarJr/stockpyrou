import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Receipt,
  Wallet,
  AlertCircle,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  CreditCard,
  Smartphone,
  Banknote
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { projectId, publicAnonKey } from '../../utils/supabase/env';
import { toast } from 'sonner@2.0.3';

interface CashierCloseProps {
  register: any;
  onClose: () => void;
}

export function CashierClose({ register, onClose }: CashierCloseProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [finalBalance, setFinalBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);
  const [showWithdrawal, setShowWithdrawal] = useState(false);
  const [showDeposit, setShowDeposit] = useState(false);
  
  // Withdrawal/Deposit state
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [withdrawalReason, setWithdrawalReason] = useState('');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositReason, setDepositReason] = useState('');

  const totalSales = register.sales?.reduce((sum: number, sale: any) => sum + sale.total, 0) || 0;
  const totalWithdrawals = register.withdrawals?.reduce((sum: number, w: any) => sum + w.amount, 0) || 0;
  const totalDeposits = register.deposits?.reduce((sum: number, d: any) => sum + d.amount, 0) || 0;
  const expectedBalance = register.initialBalance + totalSales + totalDeposits - totalWithdrawals;
  const salesCount = register.sales?.length || 0;

  // Payment breakdown
  const paymentBreakdown = {
    money: { count: 0, total: 0 },
    pix: { count: 0, total: 0 },
    credit: { count: 0, total: 0 },
    debit: { count: 0, total: 0 },
  };

  register.sales?.forEach((sale: any) => {
    const method = sale.paymentMethod || 'money';
    if (paymentBreakdown[method as keyof typeof paymentBreakdown]) {
      paymentBreakdown[method as keyof typeof paymentBreakdown].count++;
      paymentBreakdown[method as keyof typeof paymentBreakdown].total += sale.total;
    }
  });

  const difference = finalBalance ? parseFloat(finalBalance) - expectedBalance : 0;

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!withdrawalAmount || parseFloat(withdrawalAmount) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Custom-Token': user?.accessToken || '',
        'Content-Type': 'application/json',
      };
      
      if (currentCompany?.id) {
        headers['X-Company-Id'] = currentCompany.id;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/cashier/withdrawal`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            registerId: register.id,
            amount: parseFloat(withdrawalAmount),
            reason: withdrawalReason,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success('Sangria registrada');
      setWithdrawalAmount('');
      setWithdrawalReason('');
      setShowWithdrawal(false);
      
      // Reload page to update data
      window.location.reload();
    } catch (error) {
      console.error('Error recording withdrawal:', error);
      toast.error('Erro ao registrar sangria');
    }
  };

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Custom-Token': user?.accessToken || '',
        'Content-Type': 'application/json',
      };
      
      if (currentCompany?.id) {
        headers['X-Company-Id'] = currentCompany.id;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/cashier/deposit`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            registerId: register.id,
            amount: parseFloat(depositAmount),
            reason: depositReason,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success('Reforço registrado');
      setDepositAmount('');
      setDepositReason('');
      setShowDeposit(false);
      
      // Reload page to update data
      window.location.reload();
    } catch (error) {
      console.error('Error recording deposit:', error);
      toast.error('Erro ao registrar reforço');
    }
  };

  const handleClose = async () => {
    if (!finalBalance || parseFloat(finalBalance) < 0) {
      toast.error('Informe o saldo final em caixa');
      return;
    }

    try {
      setIsClosing(true);

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Custom-Token': user?.accessToken || '',
        'Content-Type': 'application/json',
      };
      
      if (currentCompany?.id) {
        headers['X-Company-Id'] = currentCompany.id;
      }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/cashier/close`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            registerId: register.id,
            finalBalance: parseFloat(finalBalance),
            notes,
          }),
        }
      );

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success('Caixa fechado com sucesso!');
      onClose();
    } catch (error) {
      console.error('Error closing register:', error);
      toast.error('Erro ao fechar caixa');
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Wallet className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm font-bold text-gray-600">Saldo Inicial</p>
          </div>
          <p className="text-2xl font-black text-gray-900">
            R$ {register.initialBalance.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-sm font-bold text-gray-600">Total Vendas</p>
          </div>
          <p className="text-2xl font-black text-green-600">
            R$ {totalSales.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{salesCount} vendas</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Receipt className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm font-bold text-gray-600">Saldo Atual</p>
          </div>
          <p className="text-2xl font-black text-purple-600">
            R$ {register.currentBalance.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-sm font-bold text-gray-600">Esperado</p>
          </div>
          <p className="text-2xl font-black text-orange-600">
            R$ {expectedBalance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Payment Breakdown */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h3 className="text-lg font-black text-gray-900 mb-4 flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-600" />
          Formas de Pagamento
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Banknote className="w-4 h-4 text-gray-600" />
              <p className="text-sm font-bold text-gray-600">Dinheiro</p>
            </div>
            <p className="text-xl font-black text-gray-900">
              R$ {paymentBreakdown.money.total.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">{paymentBreakdown.money.count} vendas</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="w-4 h-4 text-gray-600" />
              <p className="text-sm font-bold text-gray-600">PIX</p>
            </div>
            <p className="text-xl font-black text-gray-900">
              R$ {paymentBreakdown.pix.total.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">{paymentBreakdown.pix.count} vendas</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-gray-600" />
              <p className="text-sm font-bold text-gray-600">Débito</p>
            </div>
            <p className="text-xl font-black text-gray-900">
              R$ {paymentBreakdown.debit.total.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">{paymentBreakdown.debit.count} vendas</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-gray-600" />
              <p className="text-sm font-bold text-gray-600">Crédito</p>
            </div>
            <p className="text-xl font-black text-gray-900">
              R$ {paymentBreakdown.credit.total.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500">{paymentBreakdown.credit.count} vendas</p>
          </div>
        </div>
      </div>

      {/* Withdrawals and Deposits */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Withdrawals */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <ArrowDown className="w-5 h-5 text-red-600" />
              Sangrias
            </h3>
            <button
              onClick={() => setShowWithdrawal(true)}
              className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors"
            >
              + Nova
            </button>
          </div>
          
          {register.withdrawals && register.withdrawals.length > 0 ? (
            <div className="space-y-2">
              {register.withdrawals.map((w: any) => (
                <div key={w.id} className="bg-red-50 rounded-lg p-3 border border-red-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-red-900">R$ {w.amount.toFixed(2)}</p>
                    <p className="text-xs text-red-600">
                      {new Date(w.timestamp).toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                  <p className="text-sm text-red-700">{w.reason}</p>
                  <p className="text-xs text-red-600 mt-1">{w.performedBy}</p>
                </div>
              ))}
              <div className="pt-2 border-t border-red-200 mt-2">
                <p className="text-sm font-bold text-red-700">
                  Total: R$ {totalWithdrawals.toFixed(2)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Nenhuma sangria registrada</p>
          )}
        </div>

        {/* Deposits */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <ArrowUp className="w-5 h-5 text-green-600" />
              Reforços
            </h3>
            <button
              onClick={() => setShowDeposit(true)}
              className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-bold hover:bg-green-200 transition-colors"
            >
              + Novo
            </button>
          </div>
          
          {register.deposits && register.deposits.length > 0 ? (
            <div className="space-y-2">
              {register.deposits.map((d: any) => (
                <div key={d.id} className="bg-green-50 rounded-lg p-3 border border-green-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-bold text-green-900">R$ {d.amount.toFixed(2)}</p>
                    <p className="text-xs text-green-600">
                      {new Date(d.timestamp).toLocaleTimeString('pt-BR')}
                    </p>
                  </div>
                  <p className="text-sm text-green-700">{d.reason}</p>
                  <p className="text-xs text-green-600 mt-1">{d.performedBy}</p>
                </div>
              ))}
              <div className="pt-2 border-t border-green-200 mt-2">
                <p className="text-sm font-bold text-green-700">
                  Total: R$ {totalDeposits.toFixed(2)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">Nenhum reforço registrado</p>
          )}
        </div>
      </div>

      {/* Close Form */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <h3 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
          <CheckCircle2 className="w-6 h-6 text-blue-600" />
          Fechamento de Caixa
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              Saldo Final em Dinheiro (R$)
            </label>
            <input
              type="number"
              step="0.01"
              value={finalBalance}
              onChange={(e) => setFinalBalance(e.target.value)}
              className="w-full px-4 py-3 text-xl font-bold bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-600 transition-colors"
              placeholder="0,00"
            />
            <p className="text-sm text-gray-500 mt-2">
              Conte todo o dinheiro em caixa e informe o valor total
            </p>
          </div>

          {finalBalance && (
            <div className={`rounded-xl p-4 border-2 ${
              Math.abs(difference) < 0.01
                ? 'bg-green-50 border-green-200'
                : difference > 0
                ? 'bg-blue-50 border-blue-200'
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold mb-1">
                    {Math.abs(difference) < 0.01
                      ? 'Caixa Conferido ✓'
                      : difference > 0
                      ? 'Sobra em Caixa'
                      : 'Falta em Caixa'}
                  </p>
                  <p className={`text-2xl font-black ${
                    Math.abs(difference) < 0.01
                      ? 'text-green-600'
                      : difference > 0
                      ? 'text-blue-600'
                      : 'text-red-600'
                  }`}>
                    {Math.abs(difference) < 0.01 ? 'R$ 0,00' : `R$ ${Math.abs(difference).toFixed(2)}`}
                  </p>
                </div>
                {Math.abs(difference) < 0.01 ? (
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                ) : (
                  <AlertCircle className={`w-8 h-8 ${difference > 0 ? 'text-blue-600' : 'text-red-600'}`} />
                )}
              </div>
            </div>
          )}

          <div>
            <label className="text-sm font-bold text-gray-700 block mb-2">
              Observações (opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-600 transition-colors resize-none"
              rows={3}
              placeholder="Adicione observações sobre o fechamento..."
            />
          </div>

          <button
            onClick={handleClose}
            disabled={isClosing || !finalBalance}
            className="w-full py-4 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-black text-lg shadow-lg hover:shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClosing ? 'Fechando Caixa...' : 'Confirmar Fechamento'}
          </button>
        </div>
      </div>

      {/* Withdrawal Modal */}
      {showWithdrawal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleWithdrawal}
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-gray-900">
                Registrar Sangria
              </h3>
              <button
                type="button"
                onClick={() => setShowWithdrawal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={withdrawalAmount}
                  onChange={(e) => setWithdrawalAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-600 transition-colors"
                  placeholder="0,00"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">
                  Motivo
                </label>
                <input
                  type="text"
                  value={withdrawalReason}
                  onChange={(e) => setWithdrawalReason(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-600 transition-colors"
                  placeholder="Ex: Depósito bancário"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors"
              >
                Registrar Sangria
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Deposit Modal */}
      {showDeposit && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleDeposit}
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-black text-gray-900">
                Registrar Reforço
              </h3>
              <button
                type="button"
                onClick={() => setShowDeposit(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-600 transition-colors"
                  placeholder="0,00"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-sm font-bold text-gray-700 block mb-2">
                  Motivo
                </label>
                <input
                  type="text"
                  value={depositReason}
                  onChange={(e) => setDepositReason(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl outline-none focus:border-blue-600 transition-colors"
                  placeholder="Ex: Troco adicional"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
              >
                Registrar Reforço
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}