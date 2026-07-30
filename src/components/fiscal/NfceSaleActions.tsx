import { useEffect, useState } from 'react';
import { FileText, Loader2, Printer, XCircle } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useCompany } from '../../contexts/CompanyContext';
import {
  NfceApi,
  openDanfePrintWindow,
  type NfceSummary,
} from '../../repositories/nfceApi';
import { messageFromUnknownError } from '../../utils/errorMessage';

interface NfceSaleActionsProps {
  saleId: string;
  /** Se true, tenta emitir automaticamente ao montar */
  autoEmit?: boolean;
  compact?: boolean;
}

export function NfceSaleActions({ saleId, autoEmit = false, compact = false }: NfceSaleActionsProps) {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;
  const [nfce, setNfce] = useState<NfceSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [justification, setJustification] = useState('');

  useEffect(() => {
    if (!companyId || !saleId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await NfceApi.getBySale(saleId, companyId);
        if (cancelled) return;
        const current = list[0] ?? null;
        setNfce(current);
        if (autoEmit && (!current || current.status === 'ERROR' || current.status === 'REJECTED')) {
          setBusy(true);
          try {
            const res = await NfceApi.emitFromSale(saleId, companyId);
            if (!cancelled) {
              setNfce(res.nfce);
              if (res.success) toast.success('NFC-e autorizada');
              else toast.error(res.message || 'NFC-e não autorizada');
            }
          } catch (err) {
            if (!cancelled) {
              toast.error(messageFromUnknownError(err, 'Falha ao emitir NFC-e'));
            }
          } finally {
            if (!cancelled) setBusy(false);
          }
        }
      } catch {
        /* sem NFC-e ainda */
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
      const res = await NfceApi.emitFromSale(saleId, companyId);
      setNfce(res.nfce);
      if (res.success) toast.success('NFC-e autorizada');
      else toast.error(res.message || 'NFC-e não autorizada');
    } catch (err) {
      toast.error(messageFromUnknownError(err, 'Falha ao emitir NFC-e'));
    } finally {
      setBusy(false);
    }
  };

  const printDanfe = async () => {
    if (!companyId || !nfce?.id) return;
    setBusy(true);
    try {
      const { html } = await NfceApi.getDanfe(nfce.id, companyId);
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
    if (!companyId || !nfce?.id) return;
    if (justification.trim().length < 15) {
      toast.error('Justificativa com no mínimo 15 caracteres');
      return;
    }
    setBusy(true);
    try {
      const res = await NfceApi.cancel(nfce.id, justification.trim(), companyId);
      setNfce(res.nfce);
      setCancelOpen(false);
      if (res.success) toast.success('NFC-e cancelada');
      else toast.error(res.message || 'Cancelamento rejeitado');
    } catch (err) {
      toast.error(messageFromUnknownError(err, 'Falha ao cancelar'));
    } finally {
      setBusy(false);
    }
  };

  const status = nfce?.status;
  const authorized = status === 'AUTHORIZED';
  const cancelled = status === 'CANCELLED';

  return (
    <div
      className={
        compact
          ? 'space-y-2'
          : 'rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-3 space-y-2'
      }
    >
      <div className="flex items-center gap-2 text-sm font-bold text-emerald-800 dark:text-emerald-200">
        <FileText className="w-4 h-4" />
        NFC-e
        {status && (
          <span className="font-normal text-xs opacity-80">
            · {status}
            {nfce?.numero != null ? ` nº ${nfce.numero}` : ''}
          </span>
        )}
        {busy && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
      </div>

      {nfce?.motivoStatus && !authorized && (
        <p className="text-xs text-red-700 dark:text-red-300">{nfce.motivoStatus}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {!authorized && !cancelled && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void emit()}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
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
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs font-bold"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir DANFE
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
