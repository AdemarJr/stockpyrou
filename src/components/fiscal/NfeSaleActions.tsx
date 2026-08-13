import { useEffect, useState } from 'react';
import { FileText, Loader2, Printer, XCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useCompany } from '../../contexts/CompanyContext';
import { NfeApi, openDanfePrintWindow, type NfeSummary } from '../../repositories/nfeApi';
import { messageFromUnknownError } from '../../utils/errorMessage';

interface NfeSaleActionsProps {
  saleId: string;
  autoEmit?: boolean;
  compact?: boolean;
}

export function NfeSaleActions({ saleId, autoEmit = false, compact = false }: NfeSaleActionsProps) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;
  const [nfe, setNfe] = useState<NfeSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [justification, setJustification] = useState('');

  useEffect(() => {
    if (!companyId || !saleId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await NfeApi.getBySale(saleId, companyId);
        if (cancelled) return;
        const current = list[0] ?? null;
        setNfe(current);
        if (autoEmit && (!current || current.status === 'ERROR' || current.status === 'REJECTED')) {
          setBusy(true);
          try {
            const res = await NfeApi.emitFromSale(saleId, companyId);
            if (!cancelled) {
              setNfe(res.nfe);
              if (res.success) toast.success('NF-e autorizada');
              else toast.error(res.message || 'NF-e não autorizada');
            }
          } catch (err) {
            if (!cancelled) {
              toast.error(messageFromUnknownError(err, 'Falha ao emitir NF-e'));
            }
          } finally {
            if (!cancelled) setBusy(false);
          }
        }
      } catch {
        /* sem NF-e ainda */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, saleId, autoEmit]);

  const emit = async () => {
    if (!companyId) return;
    setBusy(true);
    try {
      const res = await NfeApi.emitFromSale(saleId, companyId);
      setNfe(res.nfe);
      if (res.success) toast.success('NF-e autorizada');
      else toast.error(res.message || 'NF-e não autorizada');
    } catch (err) {
      toast.error(messageFromUnknownError(err, 'Falha ao emitir NF-e'));
    } finally {
      setBusy(false);
    }
  };

  const printDanfe = async () => {
    if (!companyId || !nfe?.id) return;
    setBusy(true);
    try {
      const { html } = await NfeApi.getDanfe(nfe.id, companyId);
      if (!openDanfePrintWindow(html)) {
        toast.error('Permita pop-ups para imprimir o DANFE');
      }
    } catch (err) {
      toast.error(messageFromUnknownError(err, 'DANFE indisponível'));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!companyId || !nfe?.id) return;
    if (justification.trim().length < 15) {
      toast.error('Justificativa com no mínimo 15 caracteres');
      return;
    }
    setBusy(true);
    try {
      const res = await NfeApi.cancel(nfe.id, justification.trim(), companyId);
      setNfe(res.nfe);
      setCancelOpen(false);
      if (res.success) toast.success('NF-e cancelada');
      else toast.error(res.message || 'Cancelamento rejeitado');
    } catch (err) {
      toast.error(messageFromUnknownError(err, 'Falha ao cancelar'));
    } finally {
      setBusy(false);
    }
  };

  const status = nfe?.status;
  const authorized = status === 'AUTHORIZED';
  const cancelled = status === 'CANCELLED';

  return (
    <div
      className={
        compact
          ? 'space-y-2'
          : 'rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3 space-y-2'
      }
    >
      <div className="flex items-center gap-2 text-sm font-bold text-blue-800 dark:text-blue-200">
        <FileText className="w-4 h-4" />
        NF-e
        {status && (
          <span className="font-normal text-xs opacity-80">
            · {status}
            {nfe?.numero != null ? ` nº ${nfe.numero}` : ''}
          </span>
        )}
        {busy && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
      </div>

      {nfe?.motivoStatus && !authorized && (
        <p className="text-xs text-red-700 dark:text-red-300">{nfe.motivoStatus}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {!authorized && !cancelled && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void emit()}
            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {status ? 'Reenviar SEFAZ' : 'Emitir agora'}
          </button>
        )}
        {authorized && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void printDanfe()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-blue-300 text-blue-800 dark:text-blue-200 text-xs font-bold"
            >
              <Printer className="w-3.5 h-3.5" />
              Reimprimir DANFE
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setCancelOpen((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-red-200 text-red-700 text-xs font-bold"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancelar
            </button>
          </>
        )}
      </div>

      {cancelOpen && (
        <div className="space-y-2 pt-1">
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={2}
            placeholder="Justificativa do cancelamento (mín. 15 caracteres)"
            className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-2"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void cancel()}
            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold disabled:opacity-50"
          >
            Confirmar cancelamento
          </button>
        </div>
      )}
    </div>
  );
}
