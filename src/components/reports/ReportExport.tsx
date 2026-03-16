import React, { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';

interface ReportExportProps {
  onExportExcel: () => Promise<void> | void;
  onExportPDF: () => Promise<void> | void;
  disabled?: boolean;
}

export function ReportExport({ onExportExcel, onExportPDF, disabled = false }: ReportExportProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [exportType, setExportType] = useState<'excel' | 'pdf' | null>(null);

  const handleExport = async (type: 'excel' | 'pdf') => {
    setIsExporting(true);
    setExportType(type);
    
    try {
      if (type === 'excel') {
        await onExportExcel();
      } else {
        await onExportPDF();
      }
    } finally {
      setIsExporting(false);
      setExportType(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleExport('excel')}
        disabled={disabled || isExporting}
        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md active:scale-95"
      >
        {isExporting && exportType === 'excel' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-4 h-4" />
        )}
        <span className="hidden sm:inline font-medium">Excel</span>
      </button>
      
      <button
        onClick={() => handleExport('pdf')}
        disabled={disabled || isExporting}
        className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md active:scale-95"
      >
        {isExporting && exportType === 'pdf' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        <span className="hidden sm:inline font-medium">PDF</span>
      </button>
    </div>
  );
}
