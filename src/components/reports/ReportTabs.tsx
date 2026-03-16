import React from 'react';
import { 
  PackagePlus, DollarSign, ShoppingCart, AlertTriangle, 
  TrendingUp, History, ClipboardCheck, Receipt, CreditCard 
} from 'lucide-react';

export type TabType = 'entries' | 'cost' | 'orders' | 'waste' | 'forecast' | 'history' | 'audit' | 'sales' | 'closures';

interface Tab {
  id: TabType;
  label: string;
  icon: React.ElementType;
  badge?: string | number;
  badgeVariant?: 'default' | 'success' | 'warning' | 'danger';
}

interface ReportTabsProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  badges?: Partial<Record<TabType, string | number>>;
}

export function ReportTabs({ activeTab, onTabChange, badges = {} }: ReportTabsProps) {
  
  const tabs: Tab[] = [
    { 
      id: 'entries', 
      label: 'Entradas', 
      icon: PackagePlus,
      badge: badges.entries
    },
    { 
      id: 'sales', 
      label: 'Vendas', 
      icon: Receipt,
      badge: badges.sales
    },
    { 
      id: 'closures', 
      label: 'Fechamentos', 
      icon: CreditCard,
      badge: badges.closures
    },
    { 
      id: 'cost', 
      label: 'Custos e Margem', 
      icon: DollarSign,
      badge: badges.cost
    },
    { 
      id: 'orders', 
      label: 'Pedidos Sugeridos', 
      icon: ShoppingCart,
      badge: badges.orders,
      badgeVariant: 'warning'
    },
    { 
      id: 'waste', 
      label: 'Desperdícios', 
      icon: AlertTriangle,
      badge: badges.waste,
      badgeVariant: 'danger'
    },
    { 
      id: 'forecast', 
      label: 'Previsão', 
      icon: TrendingUp,
      badge: badges.forecast
    },
    { 
      id: 'history', 
      label: 'Histórico', 
      icon: History,
      badge: badges.history
    },
    { 
      id: 'audit', 
      label: 'Auditoria', 
      icon: ClipboardCheck,
      badge: badges.audit,
      badgeVariant: 'warning'
    },
  ];

  const getBadgeStyles = (variant?: string) => {
    switch (variant) {
      case 'success':
        return 'bg-green-100 text-green-700';
      case 'warning':
        return 'bg-amber-100 text-amber-700';
      case 'danger':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-blue-100 text-blue-700';
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Desktop Tabs */}
      <div className="hidden lg:block">
        <div className="flex flex-wrap border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`
                  relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all
                  ${isActive 
                    ? 'text-blue-600 bg-blue-50 border-b-2 border-blue-600' 
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 border-b-2 border-transparent'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${getBadgeStyles(tab.badgeVariant)}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="lg:hidden">
        <div className="p-2">
          <select
            value={activeTab}
            onChange={(e) => onTabChange(e.target.value as TabType)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {tabs.map((tab) => (
              <option key={tab.id} value={tab.id}>
                {tab.label}
                {tab.badge ? ` (${tab.badge})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
