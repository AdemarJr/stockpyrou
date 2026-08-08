import React, { useState, useEffect } from 'react';
import { Building2, Users, Plus, ShieldCheck, Mail, Lock, UserPlus, Search, Globe, ChevronRight, Activity, Trash2, X, Power, CheckCircle2, AlertCircle, Menu, Key, UserCog } from 'lucide-react';
import logoImg from "figma:asset/e8d336438522d7b8e8099c7d47e7869928dfd8f9.png";
import { getBackendApiRoot } from '../../lib/backendUrl';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../../contexts/AuthContext';
import type { Company } from '../../types';
import { APP_NAME } from '../../config/branding';

interface AdminSaaSProps {
  onLogout: () => void;
}

function adminAuthHeaders(accessToken?: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = accessToken || '';
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-Custom-Token'] = token;
  }
  return headers;
}

export function AdminSaaS({ onLogout }: AdminSaaSProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'companies' | 'users' | 'dashboard' | 'profile'>(() => {
    // Restore last active tab from localStorage
    const saved = localStorage.getItem('pyroustock_admin_tab');
    return (saved as 'companies' | 'users' | 'dashboard' | 'profile') || 'dashboard';
  });
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyUsers, setCompanyUsers] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'company' | 'user'>('company');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Confirmation modal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'suspend' | 'delete' | null;
    company: Company | null;
  }>({ isOpen: false, type: null, company: null });
  
  // Change Password modal states
  const [changePasswordModal, setChangePasswordModal] = useState<{
    isOpen: boolean;
    company: Company | null;
  }>({ isOpen: false, company: null });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Clear Data modal states
  const [clearDataModal, setClearDataModal] = useState<{
    isOpen: boolean;
    company: Company | null;
  }>({ isOpen: false, company: null });
  const [clearDataConfirmation, setClearDataConfirmation] = useState('');
  const emptyClearOptions = {
    stockQuantities: false,
    products: false,
    stockEntries: false,
    movements: false,
    priceHistory: false,
    suppliers: false,
    sales: false,
    customers: false,
    costs: false,
    inboundNfe: false,
    zigCache: false,
  };
  type ClearOptionKey = keyof typeof emptyClearOptions;

  const CLEAR_OPTION_LABELS: Record<ClearOptionKey, string> = {
    stockQuantities: 'Zerar estoques',
    products: 'Deletar produtos',
    stockEntries: 'Entradas de estoque',
    movements: 'Movimentos de estoque',
    priceHistory: 'Histórico de preços',
    suppliers: 'Fornecedores',
    sales: 'Vendas, caixa e NFC-e',
    customers: 'Clientes',
    costs: 'Custos e financeiro',
    inboundNfe: 'NF-e de entrada (DF-e)',
    zigCache: 'Cache ZIG',
  };

  /** Ao marcar A, também marca B (FK / vínculo operacional). */
  const CLEAR_REQUIRES: Partial<Record<ClearOptionKey, ClearOptionKey[]>> = {
    products: ['stockEntries', 'movements', 'priceHistory'],
    suppliers: ['stockEntries'],
    customers: ['sales'],
    /** Entradas geram ledger; limpar entradas sem financeiro deixa órfãos/erro de FK */
    stockEntries: ['costs'],
  };

  const CLEAR_EXTRA_NOTES: Partial<Record<ClearOptionKey, string>> = {
    stockEntries:
      'As entradas de compra estão ligadas ao financeiro (contas a pagar / movimentos). Por isso Custos e financeiro também precisa ser limpo.',
    products:
      'Produtos referenciam entradas, movimentos e histórico de preços — esses itens são marcados automaticamente. Vínculos em sale_items/NFC-e são desfeitos no servidor.',
    suppliers:
      'Fornecedores estão ligados às entradas de estoque — entradas também serão limpas.',
    customers:
      'Clientes estão ligados a vendas/fiado — vendas, caixa e NFC-e também serão limpos.',
    costs:
      'Remove despesas e movimentos financeiros (incluindo os vinculados a compras/entradas).',
  };

  const [clearDataOptions, setClearDataOptions] = useState({ ...emptyClearOptions });
  const [clearDataBusy, setClearDataBusy] = useState(false);

  const applyClearDependencies = (
    base: typeof emptyClearOptions,
  ): typeof emptyClearOptions => {
    const next = { ...base };
    let changed = true;
    // Propaga dependências em cascata (ex.: produtos → entradas → custos)
    while (changed) {
      changed = false;
      (Object.keys(CLEAR_REQUIRES) as ClearOptionKey[]).forEach((key) => {
        if (!next[key]) return;
        for (const dep of CLEAR_REQUIRES[key] || []) {
          if (!next[dep]) {
            next[dep] = true;
            changed = true;
          }
        }
      });
    }
    if (next.products) next.stockQuantities = false;
    return next;
  };

  const clearDependencyHints = (() => {
    const hints: string[] = [];
    (Object.keys(CLEAR_REQUIRES) as ClearOptionKey[]).forEach((key) => {
      if (!clearDataOptions[key]) return;
      const deps = (CLEAR_REQUIRES[key] || []).filter((d) => clearDataOptions[d]);
      if (deps.length === 0) return;
      const note = CLEAR_EXTRA_NOTES[key];
      hints.push(
        `${CLEAR_OPTION_LABELS[key]} → também: ${deps.map((d) => CLEAR_OPTION_LABELS[d]).join(', ')}.${
          note ? ` ${note}` : ''
        }`,
      );
    });
    return hints;
  })();
  
  // Admin Profile Password Change
  const [adminPasswordData, setAdminPasswordData] = useState({
    current: '',
    new: '',
    confirm: ''
  });
  
  // Form states
  const [newCompany, setNewCompany] = useState({ name: '', cnpj: '', email: '' });
  const [newUser, setNewUser] = useState({ email: '', password: '', fullName: '', companyId: '', role: 'admin' });

  // Persist active tab to localStorage
  useEffect(() => {
    localStorage.setItem('pyroustock_admin_tab', activeTab);
  }, [activeTab]);

  const fetchUsers = async () => {
    try {
      if (!user) return;
      
      console.log('🔍 Fetching all users to map to companies...');
      const response = await fetch(`${getBackendApiRoot()}/users`, {
        headers: adminAuthHeaders(user.accessToken)
      });
      
      const data = await response.json();
      if (data.error) {
        console.error('Error fetching users:', data.error);
        return;
      }
      
      console.log('📊 Fetched users:', data.users?.length || 0);
      
      // Map users to companies
      const userMap: Record<string, any> = {};
      if (data.users && Array.isArray(data.users)) {
        data.users.forEach((u: any) => {
          console.log(`👤 User: ${u.email}, Company: ${u.companyId}, Role: ${u.role}`);
          if (u.companyId) {
            // Priority to admin/manager
            if (!userMap[u.companyId] || (u.role === 'admin' || u.role === 'superadmin')) {
               userMap[u.companyId] = u;
            }
          }
        });
      }
      
      console.log('📋 Company users map:', Object.keys(userMap).length, 'companies have users');
      console.log('📋 User map details:', userMap);
      setCompanyUsers(userMap);
      
    } catch (error) {
      console.error('Fetch Users Error:', error);
    }
  };

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      
      // Fetch users in parallel
      fetchUsers();
      
      const response = await fetch(`${getBackendApiRoot()}/admin/companies`, {
        headers: adminAuthHeaders(user?.accessToken)
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      const mappedCompanies = (data.companies || []).map((c: any) => ({
        id: c.id || c.company_id,
        name: c.name,
        cnpj: c.cnpj,
        email: c.email,
        status: c.status || 'active',
        createdAt: new Date(c.created_at || c.createdAt)
      }));

      setCompanies(mappedCompanies);
      
      if (mappedCompanies.length === 0) {
        toast.info('Nenhuma empresa encontrada. O sistema tentou criar uma empresa padrão.');
      }
    } catch (error: any) {
      console.error('Fetch Companies Error:', error);
      toast.error('Erro ao carregar empresas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const syncCompanies = async () => {
    try {
      setLoading(true);
      const loadingToast = toast.loading('Sincronizando empresas...');
      
      const response = await fetch(`${getBackendApiRoot()}/admin/companies/sync`, {
        method: 'POST',
        headers: adminAuthHeaders(user?.accessToken)
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Erro ao sincronizar');
      
      toast.success(data.message || 'Empresas sincronizadas com sucesso!', { id: loadingToast });
      await fetchCompanies(); // Refresh the list
    } catch (error: any) {
      console.error('Sync Companies Error:', error);
      toast.error('Erro ao sincronizar empresas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleCompanyStatus = async (companyId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const response = await fetch(`${getBackendApiRoot()}/admin/companies/${companyId}/status`, {
        method: 'POST',
        headers: adminAuthHeaders(user?.accessToken),
        body: JSON.stringify({ status: newStatus })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      
      toast.success(`Empresa ${newStatus === 'active' ? 'ativada' : 'desativada'} com sucesso!`);
      fetchCompanies();
    } catch (error: any) {
      toast.error('Erro ao alterar status: ' + error.message);
    }
  };

  useEffect(() => {
    if (!user?.accessToken) return;
    void fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega quando o token do superadmin estiver disponível
  }, [user?.accessToken]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const loadingToast = toast.loading('Criando organização...');
      const response = await fetch(`${getBackendApiRoot()}/admin/create-company`, {
        method: 'POST',
        headers: adminAuthHeaders(user?.accessToken),
        body: JSON.stringify(newCompany)
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      
      toast.success('Empresa criada com sucesso!', { id: loadingToast });
      setIsModalOpen(false);
      setNewCompany({ name: '', cnpj: '', email: '' });
      fetchCompanies();
    } catch (error: any) {
      toast.error('Erro ao criar empresa: ' + error.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const loadingToast = toast.loading('Criando usuário e vinculando empresa...');
      
      const response = await fetch(`${getBackendApiRoot()}/admin/create-user`, {
        method: 'POST',
        headers: adminAuthHeaders(user?.accessToken),
        body: JSON.stringify(newUser)
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Erro desconhecido');
      }

      toast.success('Usuário criado com sucesso!', { id: loadingToast });
      setIsModalOpen(false);
      setNewUser({ email: '', password: '', fullName: '', companyId: '', role: 'admin' });
    } catch (error: any) {
      toast.error('Erro ao criar usuário: ' + error.message);
    }
  };

  const handleDeleteCompany = async () => {
    if (!confirmModal.company) return;
    
    try {
      const loadingToast = toast.loading('Excluindo empresa...');
      const response = await fetch(`${getBackendApiRoot()}/admin/companies/${confirmModal.company.id}`, {
        method: 'DELETE',
        headers: adminAuthHeaders(user?.accessToken)
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      
      toast.success('Empresa excluída com sucesso!', { id: loadingToast });
      setConfirmModal({ isOpen: false, type: null, company: null });
      fetchCompanies();
    } catch (error: any) {
      toast.error('Erro ao excluir empresa: ' + error.message);
    }
  };

  const handleSuspendCompany = async () => {
    if (!confirmModal.company) return;
    
    try {
      await toggleCompanyStatus(confirmModal.company.id, confirmModal.company.status || 'active');
      setConfirmModal({ isOpen: false, type: null, company: null });
    } catch (error: any) {
      toast.error('Erro ao suspender empresa: ' + error.message);
    }
  };

  const handleAdminChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (adminPasswordData.new.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres!');
      return;
    }
    
    if (adminPasswordData.new !== adminPasswordData.confirm) {
      toast.error('As senhas não coincidem!');
      return;
    }

    if (!user) return;

    try {
      const loadingToast = toast.loading('Atualizando sua senha...');
      const response = await fetch(`${getBackendApiRoot()}/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: adminAuthHeaders(user.accessToken),
        body: JSON.stringify({ newPassword: adminPasswordData.new })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      
      toast.success('Sua senha foi atualizada com sucesso!', { id: loadingToast });
      setAdminPasswordData({ current: '', new: '', confirm: '' });
    } catch (error: any) {
      toast.error('Erro ao atualizar senha: ' + error.message);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changePasswordModal.company) return;
    
    // Validations
    if (newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres!');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem!');
      return;
    }
    
    try {
      const loadingToast = toast.loading('Alterando senha da empresa...');
      const response = await fetch(`${getBackendApiRoot()}/admin/companies/${changePasswordModal.company.id}/change-password`, {
        method: 'POST',
        headers: adminAuthHeaders(user?.accessToken),
        body: JSON.stringify({ newPassword })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      
      toast.success('Senha alterada com sucesso!', { id: loadingToast });
      setChangePasswordModal({ isOpen: false, company: null });
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error('Erro ao alterar senha: ' + error.message);
    }
  };

  const toggleClearOption = (key: ClearOptionKey, checked: boolean) => {
    const prev = clearDataOptions;
    const next = { ...prev, [key]: checked };
    if (key === 'stockQuantities' && checked) {
      next.products = false;
    }
    const withDeps = applyClearDependencies(next);
    setClearDataOptions(withDeps);

    if (checked) {
      const autoMarked = (Object.keys(withDeps) as ClearOptionKey[]).filter(
        (k) => withDeps[k] && !prev[k] && k !== key,
      );
      if (autoMarked.length > 0) {
        toast.message(
          `Para limpar “${CLEAR_OPTION_LABELS[key]}”, também é necessário: ${autoMarked
            .map((d) => CLEAR_OPTION_LABELS[d])
            .join(', ')}. Já marcamos automaticamente.`,
          { duration: 7000 },
        );
      }
    }
  };

  const selectResetDemo = () => {
    setClearDataOptions({
      stockQuantities: false,
      products: true,
      stockEntries: true,
      movements: true,
      priceHistory: true,
      suppliers: true,
      sales: true,
      customers: true,
      costs: true,
      inboundNfe: true,
      zigCache: true,
    });
  };

  const handleClearData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearDataModal.company || clearDataBusy) return;

    const hasSelection = Object.values(clearDataOptions).some((v) => v);
    if (!hasSelection) {
      toast.error('Selecione pelo menos um tipo de dado para limpar!');
      return;
    }
    if (clearDataConfirmation !== 'LIMPAR') {
      toast.error('Código de confirmação incorreto!');
      return;
    }

    setClearDataBusy(true);
    const loadingToast = toast.loading('Limpando dados selecionados…');
    try {
      const response = await fetch(`${getBackendApiRoot()}/admin/clear-data`, {
        method: 'POST',
        headers: adminAuthHeaders(user?.accessToken),
        body: JSON.stringify({
          companyId: clearDataModal.company.id,
          confirmationCode: clearDataConfirmation,
          options: clearDataOptions,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Falha na limpeza');

      const d = result.deletions || {};
      const messages: string[] = [];
      if (d.stockQuantities) messages.push(`Estoques zerados: ${d.stockQuantities}`);
      if (d.products) messages.push(`Produtos: ${d.products}`);
      if (d.stockEntries) messages.push(`Entradas: ${d.stockEntries}`);
      if (d.movements) messages.push(`Movimentos: ${d.movements}`);
      if (d.priceHistory) messages.push(`Histórico preços: ${d.priceHistory}`);
      if (d.suppliers) messages.push(`Fornecedores: ${d.suppliers}`);
      if (d.sales) messages.push(`Vendas: ${d.sales}`);
      if (d.saleItems) messages.push(`Itens de venda: ${d.saleItems}`);
      if (d.cashRegisters) messages.push(`Caixas: ${d.cashRegisters}`);
      if (d.nfce) messages.push(`NFC-e: ${d.nfce}`);
      if (d.receivables) messages.push(`Contas a receber: ${d.receivables}`);
      if (d.customers) messages.push(`Clientes: ${d.customers}`);
      if (d.expenses) messages.push(`Despesas: ${d.expenses}`);
      if (d.financialMovements || d.financialMovementsSales) {
        messages.push(
          `Financeiro: ${(d.financialMovements || 0) + (d.financialMovementsSales || 0)}`,
        );
      }
      if (d.inboundNfe) messages.push(`NF-e entrada (DF-e): ${d.inboundNfe}`);
      if (d.zigCache) messages.push(`Cache ZIG: ${d.zigCache}`);

      toast.success(
        messages.length
          ? `Limpeza concluída!\n${messages.join('\n')}`
          : 'Limpeza concluída (nenhuma linha afetada).',
        { id: loadingToast, duration: 12000 },
      );
      if (Array.isArray(result.warnings) && result.warnings.length) {
        toast.message(`Avisos: ${result.warnings.slice(0, 3).join(' · ')}`, {
          duration: 8000,
        });
      }

      setClearDataModal({ isOpen: false, company: null });
      setClearDataConfirmation('');
      setClearDataOptions({ ...emptyClearOptions });
    } catch (error: any) {
      toast.error('Erro ao limpar dados: ' + error.message, { id: loadingToast });
    } finally {
      setClearDataBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-slate-900 text-white p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <img src={logoImg} alt="Logo" className="w-8 h-8 rounded-lg" />
          <div>
            <h1 className="font-black text-sm leading-none">{APP_NAME}</h1>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Painel Admin</span>
          </div>
        </div>
        <button 
          onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
        >
          {isMobileSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Admin - Responsive */}
      <aside className={`
        ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0
        fixed md:relative
        inset-y-0 left-0
        w-64 md:w-64 
        bg-slate-900 text-white 
        flex flex-col 
        shrink-0
        transition-transform duration-300 ease-in-out
        z-50
        md:z-auto
      `}>
        {/* Desktop Header */}
        <div className="hidden md:block p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="Logo" className="w-10 h-10 rounded-xl" />
            <div>
              <h1 className="font-black text-lg leading-none">{APP_NAME}</h1>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Painel de Controle</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => { setActiveTab('dashboard'); setIsMobileSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Activity className="w-5 h-5" />
            <span className="font-bold text-sm">Visão Geral</span>
          </button>
          <button 
            onClick={() => { setActiveTab('companies'); setIsMobileSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'companies' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <Building2 className="w-5 h-5" />
            <span className="font-bold text-sm">Empresas / Tenants</span>
          </button>
          
          <button 
            onClick={() => { setActiveTab('profile'); setIsMobileSidebarOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800 text-slate-400'}`}
          >
            <UserCog className="w-5 h-5" />
            <span className="font-bold text-sm">Meu Perfil</span>
          </button>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
            <span className="font-bold text-sm">Sair do Sistema</span>
          </button>
        </div>
      </aside>

      {/* Overlay para fechar sidebar no mobile */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Main Content - Responsive */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6 md:mb-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900">
              {activeTab === 'dashboard' && 'Dashboard Central'}
              {activeTab === 'companies' && 'Gestão de Organizações'}
              {activeTab === 'profile' && 'Perfil do Administrador'}
            </h2>
            <p className="text-sm md:text-base text-gray-500 font-medium">Controle de ativação e licenciamento do SaaS.</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 md:gap-4">
            <button 
              onClick={syncCompanies}
              disabled={loading}
              className="bg-white text-gray-700 border border-gray-200 px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50 text-sm md:text-base"
            >
              <Activity className={`w-4 h-4 md:w-5 md:h-5 ${loading ? 'animate-spin' : ''}`} />
              Sincronizar
            </button>
            <button 
              onClick={() => { setModalType('company'); setIsModalOpen(true); }}
              className="bg-white text-gray-700 border border-gray-200 px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-50 transition-all shadow-sm text-sm md:text-base"
            >
              <Plus className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">Nova Empresa</span>
              <span className="sm:hidden">Empresa</span>
            </button>
            <button 
              onClick={() => { setModalType('user'); setIsModalOpen(true); }}
              className="bg-blue-600 text-white px-4 md:px-6 py-2 md:py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all text-sm md:text-base"
            >
              <UserPlus className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline">Criar Usuário Cliente</span>
              <span className="sm:hidden">Usuário</span>
            </button>
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {loading ? (
              <>
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-white p-6 rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm animate-pulse">
                    <div className="w-12 h-12 bg-gray-100 rounded-2xl mb-4" />
                    <div className="h-4 bg-gray-100 rounded w-24 mb-2" />
                    <div className="h-8 bg-gray-100 rounded w-12" />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="bg-white p-6 rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 text-blue-600">
                    <Building2 />
                  </div>
                  <p className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-widest">Total de Empresas</p>
                  <p className="text-3xl md:text-4xl font-black mt-1 text-gray-900">{companies.length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-4 text-green-600">
                    <CheckCircle2 />
                  </div>
                  <p className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-widest">Empresas Ativas</p>
                  <p className="text-3xl md:text-4xl font-black mt-1 text-gray-900">{companies.filter(c => c.status === 'active').length}</p>
                </div>
                <div className="bg-white p-6 rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm">
                  <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mb-4 text-red-600">
                    <AlertCircle />
                  </div>
                  <p className="text-xs md:text-sm font-bold text-gray-500 uppercase tracking-widest">Empresas Suspensas</p>
                  <p className="text-3xl md:text-4xl font-black mt-1 text-gray-900">{companies.filter(c => c.status === 'inactive').length}</p>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'companies' && (
          <div className="bg-white rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden">
            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-gray-100">
              {companies.map(company => (
                <div key={company.id} className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-10 h-10 ${company.status === 'active' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'} rounded-xl flex items-center justify-center font-black flex-shrink-0`}>
                      {company.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{company.name}</p>
                      <p className="text-xs text-gray-400 font-medium truncate">ID: {company.id.slice(0, 8)}...</p>
                      <p className="text-xs text-gray-500 mt-1 truncate">{company.email || 'Não informado'}</p>
                      {companyUsers[company.id] && (
                        <div className="flex items-center gap-1 mt-2 text-xs bg-gray-50 p-1.5 rounded-lg border border-gray-100">
                           <Users className="w-3 h-3 text-indigo-500" />
                           <span className="font-bold text-gray-700">{companyUsers[company.id].fullName}</span>
                        </div>
                      )}
                    </div>
                    {company.status === 'active' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-[9px] font-black uppercase rounded-full whitespace-nowrap">
                        <CheckCircle2 className="w-3 h-3" />
                        Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-[9px] font-black uppercase rounded-full whitespace-nowrap">
                        <Power className="w-3 h-3" />
                        Bloqueado
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    <button 
                      onClick={() => setClearDataModal({ isOpen: true, company })}
                      className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-xl font-bold text-xs text-orange-600 bg-orange-50 hover:bg-orange-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Dados
                    </button>
                    <button 
                      onClick={() => setChangePasswordModal({ isOpen: true, company })}
                      className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-xl font-bold text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all"
                    >
                      <Key className="w-4 h-4" />
                      Senha
                    </button>
                    <button 
                      onClick={() => setConfirmModal({ isOpen: true, type: 'suspend', company })}
                      className={`inline-flex items-center justify-center gap-1 px-2 py-2 rounded-xl font-bold text-xs transition-all ${
                        company.status === 'active' 
                          ? 'text-red-600 bg-red-50 hover:bg-red-100' 
                          : 'text-green-600 bg-green-50 hover:bg-green-100'
                      }`}
                    >
                      <Power className="w-4 h-4" />
                      {company.status === 'active' ? 'Suspender' : 'Reativar'}
                    </button>
                    <button 
                      onClick={() => setConfirmModal({ isOpen: true, type: 'delete', company })}
                      className="inline-flex items-center justify-center gap-1 px-2 py-2 rounded-xl font-bold text-xs text-red-600 bg-red-50 hover:bg-red-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                      Excluir
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <table className="hidden md:table w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Empresa</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Usuário Admin</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Documento</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Status Atual</th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Ações de Controle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {companies.map(company => (
                  <tr key={company.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${company.status === 'active' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'} rounded-xl flex items-center justify-center font-black`}>
                          {company.name[0]}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900">{company.name}</p>
                          <p className="text-[10px] text-gray-400 font-medium">ID: {company.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {companyUsers[company.id] ? (
                        <div className="flex items-center gap-2">
                           <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                             {companyUsers[company.id].fullName[0]}
                           </div>
                           <div>
                             <p className="text-sm font-bold text-gray-700">{companyUsers[company.id].fullName}</p>
                             <p className="text-xs text-gray-500">{companyUsers[company.id].email}</p>
                           </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Sem usuário vinculado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 font-medium">{company.email || 'Não informado'}</td>
                    <td className="px-6 py-4">
                      {company.status === 'active' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-full">
                          <CheckCircle2 className="w-3 h-3" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-full">
                          <Power className="w-3 h-3" />
                          Bloqueado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => setClearDataModal({ isOpen: true, company })}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-orange-600 hover:bg-orange-50 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                          Limpar Dados
                        </button>
                        <button 
                          onClick={() => setChangePasswordModal({ isOpen: true, company })}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-blue-600 hover:bg-blue-50 transition-all"
                        >
                          <Key className="w-4 h-4" />
                          Alterar Senha
                        </button>
                        <button 
                          onClick={() => setConfirmModal({ isOpen: true, type: 'suspend', company })}
                          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all ${
                            company.status === 'active' 
                              ? 'text-red-600 hover:bg-red-50' 
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                          {company.status === 'active' ? 'Suspender Acesso' : 'Reativar Empresa'}
                        </button>
                        <button 
                          onClick={() => setConfirmModal({ isOpen: true, type: 'delete', company })}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm text-red-600 hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-2xl md:rounded-[2rem] border border-gray-100 shadow-sm p-6 md:p-10 max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                <UserCog className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-black text-gray-900">Configurações do Perfil</h3>
              <p className="text-gray-500 font-medium">Gerencie suas credenciais de acesso administrativo.</p>
            </div>

            <div className="space-y-6">
              <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5" />
                  Informações da Conta
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-blue-100/50">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Nome Completo</p>
                    <p className="font-bold text-gray-900">{user?.fullName || 'Administrador'}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-blue-100/50">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Email de Acesso</p>
                    <p className="font-bold text-gray-900">{user?.email}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-blue-100/50">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">Função no Sistema</p>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 text-xs font-black uppercase rounded-full mt-1">
                      <ShieldCheck className="w-3 h-3" />
                      Super Admin
                    </span>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-blue-100/50">
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-1">ID do Usuário</p>
                    <p className="font-mono text-xs text-gray-500 truncate" title={user?.id}>{user?.id}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 my-6"></div>

              <form onSubmit={handleAdminChangePassword} className="space-y-6">
                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                  <Key className="w-5 h-5 text-gray-400" />
                  Alterar Senha de Acesso
                </h4>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Nova Senha</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input 
                        required
                        type="password"
                        value={adminPasswordData.new}
                        onChange={e => setAdminPasswordData({...adminPasswordData, new: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-600 transition-colors"
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Confirmar Nova Senha</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input 
                        required
                        type="password"
                        value={adminPasswordData.confirm}
                        onChange={e => setAdminPasswordData({...adminPasswordData, confirm: e.target.value})}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-blue-600 transition-colors"
                        placeholder="Digite a senha novamente"
                        minLength={6}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button 
                    type="submit"
                    className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98]"
                  >
                    Atualizar Minha Senha
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* Modal Unified - Responsive */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl md:rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="p-6 md:p-8 border-b border-gray-100 flex justify-between items-start md:items-center sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-xl md:text-2xl font-black text-gray-900">
                  {modalType === 'company' ? 'Nova Empresa' : 'Novo Usuário Admin'}
                </h3>
                <p className="text-sm md:text-base text-gray-500 font-medium">O usuário terá acesso completo à empresa selecionada.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full flex-shrink-0">
                <X className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />
              </button>
            </div>

            <form onSubmit={modalType === 'company' ? handleCreateCompany : handleCreateUser} className="p-6 md:p-8 space-y-4 md:space-y-5">
              {modalType === 'company' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Nome da Empresa</label>
                    <input 
                      required
                      type="text"
                      value={newCompany.name}
                      onChange={e => setNewCompany({...newCompany, name: e.target.value})}
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-200 text-gray-700 rounded-2xl outline-none focus:border-blue-600"
                      style={{ color: '#1f2937 !important' }}
                      placeholder="Ex: Restaurante do João"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">CNPJ (Opcional)</label>
                    <input 
                      type="text"
                      value={newCompany.cnpj}
                      onChange={e => setNewCompany({...newCompany, cnpj: e.target.value})}
                      className="w-full px-5 py-3 bg-gray-50 border text-gray-700 border-gray-200 rounded-2xl outline-none focus:border-blue-600"
                      style={{ color: '#1f2937 !important' }}
                      placeholder="00.000.000/0000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Email de Contato (Opcional)</label>
                    <input 
                      type="email"
                      value={newCompany.email}
                      onChange={e => setNewCompany({...newCompany, email: e.target.value})}
                      className="w-full px-5 py-3 bg-gray-50 border text-gray-700 border-gray-200 rounded-2xl outline-none focus:border-blue-600"
                      style={{ color: '#1f2937 !important' }}
                      placeholder="contato@empresa.com"
                    />
                  </div>
                </>
              )}

              {modalType === 'user' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Mail className="w-4 h-4 text-blue-600" />
                      Email do Usuário
                    </label>
                    <input 
                      required
                      type="email"
                      value={newUser.email}
                      onChange={e => setNewUser({...newUser, email: e.target.value})}
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-blue-600"
                      style={{ color: '#1f2937 !important' }}
                      placeholder="admin@empresa.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-blue-600" />
                      Senha de Acesso
                    </label>
                    <input 
                      required
                      type="password"
                      value={newUser.password}
                      onChange={e => setNewUser({...newUser, password: e.target.value})}
                      className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-blue-600"
                      style={{ color: '#1f2937 !important' }}
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Nome Completo</label>
                    <input 
                      required
                      type="text"
                      value={newUser.fullName}
                      onChange={e => setNewUser({...newUser, fullName: e.target.value})}
                      className="w-full px-5 py-3 bg-gray-50 border text-gray-700 border-gray-200 rounded-2xl outline-none focus:border-blue-600"
                      style={{ color: '#1f2937 !important' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700">Empresa Vinculada</label>
                    <select 
                      required
                      value={newUser.companyId}
                      onChange={e => setNewUser({...newUser, companyId: e.target.value})}
                      className="w-full px-5 py-3 bg-gray-50 border text-gray-700 border-gray-200 rounded-2xl outline-none focus:border-blue-600 appearance-none"
                      style={{ color: '#1f2937 !important' }}
                    >
                      <option value="">Selecione a empresa</option>
                      {companies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <button 
                type="submit"
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-[0.98]"
              >
                Salvar Cadastro
              </button>
            </form>
          </div>
        </div>
      )}
      
      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.company && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 mx-auto ${
                confirmModal.type === 'delete' ? 'bg-red-100' : 'bg-orange-100'
              }`}>
                {confirmModal.type === 'delete' ? (
                  <Trash2 className="w-8 h-8 text-red-600" />
                ) : (
                  <Power className="w-8 h-8 text-orange-600" />
                )}
              </div>
              
              <h3 className="text-2xl font-black text-gray-900 text-center mb-3">
                {confirmModal.type === 'delete' 
                  ? 'Excluir Empresa?' 
                  : confirmModal.company.status === 'active' 
                    ? 'Suspender Acesso?' 
                    : 'Reativar Empresa?'}
              </h3>
              
              <p className="text-gray-600 text-center mb-2 font-medium">
                {confirmModal.type === 'delete' 
                  ? `Você está prestes a excluir a empresa "${confirmModal.company.name}". Esta ação é permanente e não pode ser desfeita.`
                  : confirmModal.company.status === 'active'
                    ? `Ao suspender o acesso, a empresa "${confirmModal.company.name}" não poderá mais acessar o sistema.`
                    : `A empresa "${confirmModal.company.name}" terá seu acesso reativado ao sistema.`}
              </p>
              
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 mb-6 mt-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 ${confirmModal.company.status === 'active' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'} rounded-xl flex items-center justify-center font-black text-sm`}>
                    {confirmModal.company.name[0]}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{confirmModal.company.name}</p>
                    <p className="text-xs text-gray-500">{confirmModal.company.email || 'Sem email cadastrado'}</p>
                  </div>
                </div>
              </div>
              
              <p className="text-center text-sm font-bold text-gray-600 mb-6">
                Deseja realmente prosseguir com essa ação?
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal({ isOpen: false, type: null, company: null })}
                  className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmModal.type === 'delete' ? handleDeleteCompany : handleSuspendCompany}
                  className={`flex-1 py-3 rounded-xl font-bold text-white transition-all ${
                    confirmModal.type === 'delete' 
                      ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-200' 
                      : confirmModal.company.status === 'active'
                        ? 'bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-200'
                        : 'bg-green-600 hover:bg-green-700 shadow-lg shadow-green-200'
                  }`}
                >
                  {confirmModal.type === 'delete' 
                    ? 'Sim, Excluir' 
                    : confirmModal.company.status === 'active' 
                      ? 'Sim, Suspender' 
                      : 'Sim, Reativar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Change Password Modal */}
      {changePasswordModal.isOpen && changePasswordModal.company && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-6 mx-auto">
                <Key className="w-8 h-8 text-blue-600" />
              </div>
              
              <h3 className="text-2xl font-black text-gray-900 text-center mb-3">
                Alterar Senha da Empresa
              </h3>
              
              <p className="text-gray-600 text-center mb-6 font-medium">
                Defina uma nova senha de acesso para a empresa "{changePasswordModal.company.name}".
              </p>
              
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-600" />
                    Nova Senha
                  </label>
                  <input 
                    required
                    type="password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-blue-600"
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-blue-600" />
                    Confirmar Nova Senha
                  </label>
                  <input 
                    required
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-blue-600"
                    placeholder="Digite a senha novamente"
                    minLength={6}
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => {
                      setChangePasswordModal({ isOpen: false, company: null });
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 py-3 rounded-xl font-bold text-white transition-all bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200"
                  >
                    Alterar Senha
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Clear Data Modal */}
      {clearDataModal.isOpen && clearDataModal.company && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="p-8">
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-6 mx-auto">
                <Trash2 className="w-8 h-8 text-orange-600" />
              </div>
              
              <h3 className="text-2xl font-black text-gray-900 text-center mb-3">
                Gerenciar Dados da Empresa
              </h3>
              
              <p className="text-gray-600 text-center mb-4 font-medium">
                Selecione o que deseja limpar da empresa <strong>"{clearDataModal.company.name}"</strong>
              </p>
              
              <form onSubmit={handleClearData} className="space-y-4">
                <div className="flex flex-wrap gap-2 mb-1">
                  <button
                    type="button"
                    onClick={selectResetDemo}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-orange-100 text-orange-800 hover:bg-orange-200"
                  >
                    Reset demo (tudo operacional)
                  </button>
                  <button
                    type="button"
                    onClick={() => setClearDataOptions({ ...emptyClearOptions })}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    Limpar seleção
                  </button>
                </div>

                <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                    Selecione os itens para limpar:
                  </p>

                  {(
                    [
                      {
                        key: 'stockQuantities' as const,
                        title: 'Zerar estoques',
                        desc: 'Mantém produtos; só zera current_stock',
                      },
                      {
                        key: 'products' as const,
                        title: 'Deletar produtos',
                        desc: 'Exige também: entradas, movimentos e histórico de preços',
                      },
                      {
                        key: 'stockEntries' as const,
                        title: 'Entradas de estoque',
                        desc: 'Exige também: custos e financeiro (lançamentos das compras)',
                      },
                      {
                        key: 'movements' as const,
                        title: 'Movimentos de estoque',
                        desc: 'Saídas, vendas, ajustes e baixas',
                      },
                      {
                        key: 'priceHistory' as const,
                        title: 'Histórico de preços',
                        desc: 'Alterações de custo/preço registradas',
                      },
                      {
                        key: 'suppliers' as const,
                        title: 'Fornecedores',
                        desc: 'Exige também: entradas de estoque (+ financeiro das compras)',
                      },
                      {
                        key: 'sales' as const,
                        title: 'Vendas, caixa e NFC-e',
                        desc: 'Vendas, itens, caixa, NFC-e, fiado/contas a receber',
                      },
                      {
                        key: 'customers' as const,
                        title: 'Clientes',
                        desc: 'Exige também: vendas, caixa e NFC-e',
                      },
                      {
                        key: 'costs' as const,
                        title: 'Custos e financeiro',
                        desc: 'Despesas operacionais e movimentos financeiros',
                      },
                      {
                        key: 'inboundNfe' as const,
                        title: 'NF-e de entrada (DF-e)',
                        desc: 'Notas sincronizadas da SEFAZ para recebimento',
                      },
                      {
                        key: 'zigCache' as const,
                        title: 'Cache ZIG',
                        desc: 'Baixas processadas / mapeamentos em cache (KV)',
                      },
                    ] as const
                  ).map((item) => {
                    const requiredBy = (Object.keys(CLEAR_REQUIRES) as ClearOptionKey[]).filter(
                      (parent) =>
                        clearDataOptions[parent] &&
                        (CLEAR_REQUIRES[parent] || []).includes(item.key),
                    );
                    const lockedByParent = requiredBy.length > 0 && clearDataOptions[item.key];
                    return (
                    <label
                      key={item.key}
                      className={`flex items-start gap-3 p-3 bg-white rounded-xl border-2 cursor-pointer transition-all ${
                        clearDataOptions[item.key]
                          ? 'border-orange-300 bg-orange-50/40'
                          : 'border-gray-200 hover:border-orange-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={clearDataOptions[item.key]}
                        onChange={(e) => toggleClearOption(item.key, e.target.checked)}
                        className="mt-1 w-5 h-5 text-orange-600 rounded focus:ring-2 focus:ring-orange-500"
                      />
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{item.title}</p>
                        <p className="text-xs text-gray-500">{item.desc}</p>
                        {lockedByParent && (
                          <p className="text-[11px] text-orange-700 mt-1 font-medium">
                            Marcado automaticamente porque você selecionou:{' '}
                            {requiredBy.map((k) => CLEAR_OPTION_LABELS[k]).join(', ')}
                          </p>
                        )}
                      </div>
                    </label>
                    );
                  })}
                </div>

                {clearDependencyHints.length > 0 && (
                  <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 space-y-2">
                    <p className="text-amber-950 font-bold text-sm">
                      Vínculos entre os itens selecionados
                    </p>
                    <ul className="space-y-1.5">
                      {clearDependencyHints.map((hint) => (
                        <li key={hint.slice(0, 48)} className="text-xs text-amber-900/90 leading-relaxed">
                          • {hint}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-xs text-gray-500 text-center">
                  Não remove: usuários, empresa, certificado A1 nem configuração fiscal (CNPJ/CSC).
                </p>

                {Object.values(clearDataOptions).some((v) => v) && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4">
                    <p className="text-red-900 font-bold text-center text-sm">
                      Atenção: esta ação é irreversível
                    </p>
                    <p className="text-red-700 text-xs text-center mt-1">
                      A limpeza roda em transação. Em caso de erro, nada é parcialmente aplicado.
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700 text-center block">
                    Para confirmar, digite:
                  </label>
                  <div className="bg-gray-100 p-3 rounded-lg mb-2 font-mono text-center text-sm font-bold text-gray-900">
                    LIMPAR
                  </div>
                  <input
                    required
                    type="text"
                    value={clearDataConfirmation}
                    onChange={(e) => setClearDataConfirmation(e.target.value)}
                    className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-2xl outline-none focus:border-orange-600 font-mono text-center"
                    placeholder="Digite LIMPAR"
                    disabled={clearDataBusy}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    disabled={clearDataBusy}
                    onClick={() => {
                      setClearDataModal({ isOpen: false, company: null });
                      setClearDataConfirmation('');
                      setClearDataOptions({ ...emptyClearOptions });
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={
                      clearDataBusy ||
                      clearDataConfirmation !== 'LIMPAR' ||
                      !Object.values(clearDataOptions).some((v) => v)
                    }
                    className="flex-1 py-3 rounded-xl font-bold text-white transition-all bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-200 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {clearDataBusy ? 'Limpando…' : 'Confirmar limpeza'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}