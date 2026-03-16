import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ReportCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export function ReportCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-blue-600',
  trend,
  variant = 'default',
}: ReportCardProps) {
  
  const variantStyles = {
    default: 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200',
    success: 'bg-gradient-to-br from-green-50 to-emerald-100 border-green-200',
    warning: 'bg-gradient-to-br from-amber-50 to-yellow-100 border-amber-200',
    danger: 'bg-gradient-to-br from-red-50 to-rose-100 border-red-200',
    info: 'bg-gradient-to-br from-blue-50 to-cyan-100 border-blue-200',
  };

  const iconBgStyles = {
    default: 'bg-white',
    success: 'bg-green-100',
    warning: 'bg-amber-100',
    danger: 'bg-red-100',
    info: 'bg-blue-100',
  };

  return (
    <div className={`rounded-xl border shadow-sm p-5 transition-all hover:shadow-md ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span className={`text-xs font-semibold ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-gray-500">vs período anterior</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${iconBgStyles[variant]}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
}
