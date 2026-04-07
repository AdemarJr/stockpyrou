import React, { useState, useEffect, useMemo } from 'react';
import { usePagination } from '../../hooks/usePagination';
import { ListPaginationBar } from '../ui/list-pagination-bar';
import {
  Calendar,
  TrendingUp,
  DollarSign,
  Receipt,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  ShoppingBag,
  Package,
  Banknote,
  Smartphone,
  CreditCard,
  Search
} from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { rowMatchesSearch } from '../../utils/listFilters';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { projectId, publicAnonKey } from '../../utils/supabase/env';
import { toast } from 'sonner@2.0.3';

export function CashierHistory() {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const [registers, setRegisters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [diffFilter, setDiffFilter] = useState<string>('all');

  const filteredRegisters = useMemo(() => {
    return registers.filter((r: any) => {
      const matchesText = rowMatchesSearch(searchQuery, [
        r.cashierName,
        r.closedBy,
        r.notes,
        String(r.difference ?? ''),
        String(r.finalBalance ?? ''),
      ]);
      const d = Number(r.difference) || 0;
      let matchesDiff = true;
      if (diffFilter === 'zero') matchesDiff = Math.abs(d) <= 0.01;
      else if (diffFilter === 'positive') matchesDiff = d > 0.01;
      else if (diffFilter === 'negative') matchesDiff = d < -0.01;
      return matchesText && matchesDiff;
    });
  }, [registers, searchQuery, diffFilter]);

  const listKey = `${currentCompany?.id ?? ''}|${searchQuery}|${diffFilter}`;
  const {
    paginatedItems,
    page,
    setPage,
    totalPages,
    from,
    to,
    total: pageTotal
  } = usePagination(filteredRegisters, 10, listKey);

  useEffect(() => {
    if (currentCompany?.id) {
      loadHistory();
    }
  }, [currentCompany]);

  const loadHistory = async () => {
    if (!currentCompany?.id) {
      toast.error('Empresa não identificada');
      return;
    }

    try {
      setLoading(true);
      
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${publicAnonKey}`,
        'X-Custom-Token': user?.accessToken || '',
      };
      
      if (currentCompany?.id) {
        headers['X-Company-Id'] = currentCompany.id;
      }
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/cashier/history?limit=30`,
        { headers }
      );

      const data = await response.json();

      if (data.error) {
        toast.error(data.error);
        return;
      }

      setRegisters(data.registers || []);
    } catch (error) {
      console.error('Error loading history:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const downloadReport = (register: any) => {
    const content = generateReport(register);
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caixa-${new Date(register.closedAt).toLocaleDateString('pt-BR').replace(/\//g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const generateReport = (register: any) => {
    const lines = [
      '═══════════════════════════════════════',
      '      RELATÓRIO DE FECHAMENTO DE CAIXA',
      '═══════════════════════════════════════',
      '',
      `Operador: ${register.cashierName}`,
      `Abertura: ${new Date(register.openedAt).toLocaleString('pt-BR')}`,
      `Fechamento: ${new Date(register.closedAt).toLocaleString('pt-BR')}`,
      `Fechado por: ${register.closedBy}`,
      '',
      '───────────────────────────────────────',
      '  VALORES',
      '───────────────────────────────────────',
      `Saldo Inicial:     R$ ${register.initialBalance.toFixed(2)}`,
      `Total em Vendas:   R$ ${register.summary.totalSales.toFixed(2)}`,
      `Total Sangrias:    R$ ${register.summary.totalWithdrawals.toFixed(2)}`,
      `Total Reforços:    R$ ${register.summary.totalDeposits.toFixed(2)}`,
      `Saldo Esperado:    R$ ${register.expectedBalance.toFixed(2)}`,
      `Saldo Final:       R$ ${register.finalBalance.toFixed(2)}`,
      `Diferença:         R$ ${register.difference.toFixed(2)}`,
      '',
      '───────────────────────────────────────',
      '  VENDAS',
      '───────────────────────────────────────',
      `Total de Vendas: ${register.summary.salesCount}`,
      '',
      'Por Forma de Pagamento:',
      `  Dinheiro: ${register.summary.paymentBreakdown.money.count} vendas - R$ ${register.summary.paymentBreakdown.money.total.toFixed(2)}`,
      `  PIX:      ${register.summary.paymentBreakdown.pix.count} vendas - R$ ${register.summary.paymentBreakdown.pix.total.toFixed(2)}`,
      `  Débito:   ${register.summary.paymentBreakdown.debit.count} vendas - R$ ${register.summary.paymentBreakdown.debit.total.toFixed(2)}`,
      `  Crédito:  ${register.summary.paymentBreakdown.credit.count} vendas - R$ ${register.summary.paymentBreakdown.credit.total.toFixed(2)}`,
      '',
    ];

    if (register.notes) {
      lines.push('───────────────────────────────────────');
      lines.push('  OBSERVAÇÕES');
      lines.push('───────────────────────────────────────');
      lines.push(register.notes);
      lines.push('');
    }

    lines.push('═══════════════════════════════════════');
    lines.push('');

    return lines.join('\n');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (registers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <Calendar className="w-16 h-16 text-gray-300 mb-4" />
        <h3 className="text-xl font-black text-gray-900 mb-2">
          Nenhum histórico encontrado
        </h3>
        <p className="text-gray-500">
          Os fechamentos de caixa aparecerão aqui
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
        <h2 className="text-2xl font-black text-gray-900 mb-2 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          Histórico de Caixas
        </h2>
        <p className="text-gray-600">Últimos 30 fechamentos</p>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Buscar</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="search"
                placeholder="Operador, quem fechou, diferença…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-gray-500">Diferença de caixa</Label>
            <Select value={diffFilter} onValueChange={setDiffFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="zero">Sem diferença (zerado)</SelectItem>
                <SelectItem value="positive">Sobra (positivo)</SelectItem>
                <SelectItem value="negative">Falta (negativo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {filteredRegisters.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-500">
          Nenhum fechamento corresponde aos filtros.
        </div>
      ) : (
      <div className="space-y-4">
        {paginatedItems.map((register) => {
          const isExpanded = expandedId === register.id;
          const hasDifference = Math.abs(register.difference) > 0.01;

          return (
            <div
              key={register.id}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => toggleExpanded(register.id)}
                className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    hasDifference
                      ? register.difference > 0
                        ? 'bg-blue-100'
                        : 'bg-red-100'
                      : 'bg-green-100'
                  }`}>
                    {hasDifference ? (
                      <AlertCircle className={`w-6 h-6 ${
                        register.difference > 0 ? 'text-blue-600' : 'text-red-600'
                      }`} />
                    ) : (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    )}
                  </div>

                  <div className="text-left">
                    <p className="font-black text-gray-900">
                      {new Date(register.closedAt).toLocaleDateString('pt-BR')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {register.cashierName} • {register.summary.salesCount} vendas
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total</p>
                    <p className="text-xl font-black text-blue-600">
                      R$ {register.summary.totalSales.toFixed(2)}
                    </p>
                  </div>
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-gray-100 p-6 bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Saldo Inicial</p>
                      <p className="text-xl font-black text-gray-900">
                        R$ {register.initialBalance.toFixed(2)}
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Saldo Esperado</p>
                      <p className="text-xl font-black text-orange-600">
                        R$ {register.expectedBalance.toFixed(2)}
                      </p>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-200">
                      <p className="text-sm text-gray-600 mb-1">Saldo Final</p>
                      <p className={`text-xl font-black ${
                        hasDifference
                          ? register.difference > 0
                            ? 'text-blue-600'
                            : 'text-red-600'
                          : 'text-green-600'
                      }`}>
                        R$ {register.finalBalance.toFixed(2)}
                      </p>
                      {hasDifference && (
                        <p className={`text-sm font-bold mt-1 ${
                          register.difference > 0 ? 'text-blue-600' : 'text-red-600'
                        }`}>
                          {register.difference > 0 ? '+' : ''}
                          R$ {register.difference.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Payment Breakdown */}
                  <div className="bg-white rounded-xl p-4 border border-gray-200 mb-4">
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Formas de Pagamento
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Dinheiro</p>
                        <p className="font-bold text-gray-900">
                          R$ {register.summary.paymentBreakdown.money.total.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {register.summary.paymentBreakdown.money.count} vendas
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">PIX</p>
                        <p className="font-bold text-gray-900">
                          R$ {register.summary.paymentBreakdown.pix.total.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {register.summary.paymentBreakdown.pix.count} vendas
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Débito</p>
                        <p className="font-bold text-gray-900">
                          R$ {register.summary.paymentBreakdown.debit.total.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {register.summary.paymentBreakdown.debit.count} vendas
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Crédito</p>
                        <p className="font-bold text-gray-900">
                          R$ {register.summary.paymentBreakdown.credit.total.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {register.summary.paymentBreakdown.credit.count} vendas
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Sales List */}
                  {register.sales && register.sales.length > 0 && (
                    <div className="bg-white rounded-xl p-4 border border-gray-200 mb-4">
                      <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                        <ShoppingBag className="w-4 h-4" />
                        Vendas Realizadas ({register.sales.length})
                      </h4>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {register.sales.slice().reverse().map((sale: any, index: number) => {
                          const paymentMethodIcons: any = {
                            money: Banknote,
                            pix: Smartphone,
                            credit: CreditCard,
                            debit: CreditCard,
                          };
                          const paymentMethodLabels: any = {
                            money: 'Dinheiro',
                            pix: 'PIX',
                            credit: 'Crédito',
                            debit: 'Débito',
                          };
                          const PaymentIcon = paymentMethodIcons[sale.paymentMethod];
                          
                          return (
                            <div key={sale.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Receipt className="w-4 h-4 text-blue-600" />
                                  <span className="text-sm font-bold text-gray-900">
                                    Venda #{register.sales.length - index}
                                  </span>
                                  <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-bold">
                                    {paymentMethodLabels[sale.paymentMethod]}
                                  </span>
                                </div>
                                <span className="text-lg font-black text-blue-600">
                                  R$ {sale.total.toFixed(2)}
                                </span>
                              </div>
                              <div className="space-y-1">
                                {sale.items.map((item: any, itemIndex: number) => (
                                  <div key={itemIndex} className="flex items-center justify-between text-xs text-gray-600">
                                    <span>
                                      <span className="font-bold">{item.quantity}x</span> {item.name}
                                    </span>
                                    <span className="font-bold text-gray-900">
                                      R$ {(item.quantity * item.price).toFixed(2)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Withdrawals and Deposits */}
                  {(register.withdrawals?.length > 0 || register.deposits?.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      {register.withdrawals?.length > 0 && (
                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                          <h4 className="font-bold text-gray-900 mb-2 text-sm">
                            Sangrias ({register.withdrawals.length})
                          </h4>
                          <p className="text-lg font-black text-red-600">
                            R$ {register.summary.totalWithdrawals.toFixed(2)}
                          </p>
                        </div>
                      )}
                      {register.deposits?.length > 0 && (
                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                          <h4 className="font-bold text-gray-900 mb-2 text-sm">
                            Reforços ({register.deposits.length})
                          </h4>
                          <p className="text-lg font-black text-green-600">
                            R$ {register.summary.totalDeposits.toFixed(2)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {register.notes && (
                    <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200 mb-4">
                      <p className="text-sm font-bold text-yellow-900 mb-1">
                        Observações
                      </p>
                      <p className="text-sm text-yellow-800">{register.notes}</p>
                    </div>
                  )}

                  {/* Details */}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div>
                      <p>
                        Aberto: {new Date(register.openedAt).toLocaleString('pt-BR')}
                      </p>
                      <p>
                        Fechado: {new Date(register.closedAt).toLocaleString('pt-BR')}
                      </p>
                      <p>Fechado por: {register.closedBy}</p>
                    </div>
                    <button
                      onClick={() => downloadReport(register)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Baixar Relatório
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {totalPages > 1 && (
          <ListPaginationBar
            page={page}
            totalPages={totalPages}
            from={from}
            to={to}
            total={pageTotal}
            onPageChange={setPage}
            className="mt-2"
          />
        )}
      </div>
      )}
    </div>
  );
}