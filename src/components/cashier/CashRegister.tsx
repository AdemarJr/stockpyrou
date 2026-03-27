import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  LogOut, 
  ArrowUp, 
  ArrowDown, 
  Clock,
  TrendingUp,
  Wallet,
  Receipt,
  Calendar,
  User,
  ShoppingBag
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';
import { cn } from '../ui/utils';
import { nativeFieldInvalidClass } from '../../lib/formFieldValidation';
import { CashierPOS } from './CashierPOS';
import { CashierClose } from './CashierClose';
import { CashierHistory } from './CashierHistory';
import { CashierSales } from './CashierSales';
import { SaleReceipt } from './SaleReceipt';

interface CashRegisterProps {
  onBack?: () => void;
}

export function CashRegister({ onBack }: CashRegisterProps) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [currentRegister, setCurrentRegister] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'pos' | 'sales' | 'close' | 'history'>('pos');
  const [completedSale, setCompletedSale] = useState<any>(null);
  
  // Opening register form
  const [initialBalance, setInitialBalance] = useState('');
  const [initialBalanceInvalid, setInitialBalanceInvalid] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  useEffect(() => {
    if (user?.accessToken && currentCompany?.id) {
      checkCurrentRegister();
    }
  }, [user, currentCompany]);

  const checkCurrentRegister = async () => {
    if (!user?.accessToken) {
      console.log('⚠️ No access token available');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔍 Checking current register with token:', user.accessToken.substring(0, 20) + '...');
      console.log('🏢 Current company:', currentCompany?.id);
      
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Custom-Token': user.accessToken,
      };
      
      // Include companyId if available from context
      if (currentCompany?.id) {
        headers['X-Company-Id'] = currentCompany.id;
        console.log('📤 Sending X-Company-Id header:', currentCompany.id);
      }
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/cashier/current`,
        { headers }
      );

      const data = await response.json();
      console.log('📥 Response from /cashier/current:', data);
      
      if (data.error) {
        console.error('❌ Error checking register:', data.error);
        toast.error(`Erro: ${data.error}`);
        setCurrentRegister(null);
        // Remove do localStorage se houver erro
        localStorage.removeItem(`cashier_register_${currentCompany?.id}`);
        return;
      }

      if (data.register) {
        console.log('✅ Register found:', data.register.id, 'Sales:', data.register.sales?.length || 0);
        setCurrentRegister(data.register);
        // Salva no localStorage para persistência
        localStorage.setItem(`cashier_register_${currentCompany?.id}`, JSON.stringify(data.register));
      } else {
        console.log('ℹ️ No open register found');
        setCurrentRegister(null);
        // Remove do localStorage se não houver caixa aberto
        localStorage.removeItem(`cashier_register_${currentCompany?.id}`);
      }
    } catch (error) {
      console.error('💥 Error checking register:', error);
      toast.error('Erro ao verificar caixa');
      setCurrentRegister(null);
      // Remove do localStorage em caso de erro
      localStorage.removeItem(`cashier_register_${currentCompany?.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    const n = parseFloat(initialBalance.replace(',', '.'));
    if (!initialBalance.trim() || !Number.isFinite(n) || n < 0) {
      setInitialBalanceInvalid(true);
      return;
    }
    setInitialBalanceInvalid(false);

    // Validação de token antes de fazer requisição
    if (!user?.accessToken) {
      console.error('❌ No access token available for opening register');
      toast.error('Erro de autenticação. Por favor, faça login novamente.');
      return;
    }

    try {
      setIsOpening(true);
      
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Custom-Token': user.accessToken,
        'Content-Type': 'application/json',
      };
      
      if (currentCompany?.id) {
        headers['X-Company-Id'] = currentCompany.id;
      }
      
      console.log('📤 Opening register with headers:', { 
        hasToken: !!user.accessToken, 
        hasCompanyId: !!currentCompany?.id,
        initialBalance: parseFloat(initialBalance)
      });
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/cashier/open`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            initialBalance: parseFloat(initialBalance),
            cashierId: user?.id,
            cashierName: user?.fullName,
          }),
        }
      );

      const data = await response.json();
      
      if (data.error) {
        console.error('❌ Error from server:', data.error);
        toast.error(data.error);
        return;
      }

      console.log('✅ Register opened successfully:', data.register?.id);
      toast.success('Caixa aberto com sucesso!');
      setCurrentRegister(data.register);
      setInitialBalance('');
    } catch (error) {
      console.error('💥 Error opening register:', error);
      toast.error('Erro ao abrir caixa. Verifique sua conexão.');
    } finally {
      setIsOpening(false);
    }
  };

  const handleRegisterClosed = () => {
    setCurrentRegister(null);
    setActiveView('pos');
    checkCurrentRegister();
  };

  const handleSaleComplete = async (saleData: any) => {
    console.log('🎉 Sale completed:', saleData);
    console.log('📋 Current completedSale state before update:', completedSale);
    
    // Set completed sale to show receipt
    setCompletedSale(saleData);
    
    console.log('✅ setCompletedSale called with:', saleData);
    
    // Refresh register data in background
    await checkCurrentRegister();
  };

  const handleCloseReceipt = () => {
    setCompletedSale(null);
  };

  const handleNewSale = () => {
    setCompletedSale(null);
    setActiveView('pos');
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If no register is open, show opening form
  if (!currentRegister) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-white">
              <div className="flex items-center justify-center mb-4">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <DollarSign className="w-10 h-10" />
                </div>
              </div>
              <h1 className="text-3xl font-black text-center mb-2">Abertura de Caixa</h1>
              <p className="text-center text-blue-100">
                Informe o saldo inicial para começar o expediente
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleOpenRegister} className="p-8 space-y-6">
              <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                <div className="flex items-center gap-3 mb-4">
                  <User className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-700">Operador</p>
                    <p className="text-lg font-black text-gray-900">{user?.fullName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-bold text-gray-700">Data/Hora</p>
                    <p className="text-lg font-black text-gray-900">
                      {new Date().toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className={cn('block text-sm font-bold', initialBalanceInvalid ? 'text-destructive' : 'text-gray-700')}>
                  Saldo inicial em caixa (R$) <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Wallet className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={initialBalance}
                    onChange={(e) => {
                      setInitialBalance(e.target.value);
                      setInitialBalanceInvalid(false);
                    }}
                    aria-invalid={initialBalanceInvalid}
                    className={cn(
                      'w-full pl-12 pr-4 py-4 text-2xl font-bold bg-gray-50 rounded-xl outline-none focus:border-blue-600 transition-colors border-2',
                      initialBalanceInvalid
                        ? nativeFieldInvalidClass(true)
                        : 'border-gray-200 focus:border-blue-600'
                    )}
                    placeholder="0,00"
                    autoFocus
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Informe o valor em dinheiro disponível no início do expediente
                </p>
              </div>

              <button
                type="submit"
                disabled={isOpening}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4 rounded-xl font-black text-lg shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {isOpening ? 'Abrindo Caixa...' : 'Abrir Caixa e Iniciar Vendas'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // If register is open, show POS or close view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-bold">Caixa Aberto</p>
                  <p className="text-sm font-black text-gray-900">{user?.fullName}</p>
                </div>
              </div>
              
              <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-bold text-blue-900">
                  {new Date(currentRegister.openedAt).toLocaleTimeString('pt-BR')}
                </span>
              </div>

              <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
                <Wallet className="w-4 h-4 text-green-600" />
                <span className="text-sm font-bold text-green-900">
                  R$ {currentRegister.currentBalance.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveView('pos')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  activeView === 'pos'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Receipt className="w-4 h-4 inline mr-2" />
                Vendas
              </button>
              <button
                onClick={() => setActiveView('sales')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  activeView === 'sales'
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <ShoppingBag className="w-4 h-4 inline mr-2" />
                Histórico de Vendas
              </button>
              <button
                onClick={() => setActiveView('close')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  activeView === 'close'
                    ? 'bg-red-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <LogOut className="w-4 h-4 inline mr-2" />
                Fechar Caixa
              </button>
              <button
                onClick={() => setActiveView('history')}
                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${
                  activeView === 'history'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <TrendingUp className="w-4 h-4 inline mr-2" />
                Histórico
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {activeView === 'pos' && (
          <CashierPOS 
            register={currentRegister} 
            onSaleComplete={handleSaleComplete}
          />
        )}
        {activeView === 'sales' && (
          <CashierSales 
            register={currentRegister} 
            onSaleComplete={handleSaleComplete}
          />
        )}
        {activeView === 'close' && (
          <CashierClose 
            register={currentRegister}
            onClose={handleRegisterClosed}
          />
        )}
        {activeView === 'history' && (
          <CashierHistory />
        )}
      </div>

      {/* Sale Receipt Modal */}
      {completedSale && (
        <>
          {console.log('🎭 Rendering SaleReceipt with:', completedSale)}
          <SaleReceipt
            sale={completedSale}
            cashierName={user?.fullName || 'Operador'}
            companyName={currentCompany?.name}
            onClose={handleCloseReceipt}
            onNewSale={handleNewSale}
          />
        </>
      )}
    </div>
  );
}