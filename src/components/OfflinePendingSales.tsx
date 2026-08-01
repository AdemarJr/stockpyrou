import { useCallback, useEffect, useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../contexts/AuthContext';
import { useCompany } from '../contexts/CompanyContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import {
  countPendingOfflineSales,
  onOfflineSalesChanged,
  syncPendingOfflineSales,
} from '../offline/offlineSaleQueue';

/** Badge + sync das vendas cupom não fiscal feitas offline. */
export function OfflinePendingSales({
  onSynced,
}: {
  onSynced?: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const { currentCompany } = useCompany();
  const online = useOnlineStatus();
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentCompany?.id) {
      setPending(0);
      return;
    }
    try {
      setPending(await countPendingOfflineSales(currentCompany.id));
    } catch {
      setPending(0);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    void refresh();
    return onOfflineSalesChanged(() => {
      void refresh();
    });
  }, [refresh]);

  // Auto-sync uma vez ao voltar online (não a cada mudança de pending)
  useEffect(() => {
    if (!online || !currentCompany?.id || !user?.accessToken) return;
    let cancelled = false;
    void (async () => {
      const n = await countPendingOfflineSales(currentCompany.id);
      if (cancelled || n === 0) return;
      setSyncing(true);
      try {
        const res = await syncPendingOfflineSales({
          companyId: currentCompany.id,
          accessToken: user.accessToken,
        });
        if (cancelled) return;
        if (res.synced > 0) {
          toast.success(
            res.synced === 1
              ? '1 venda offline sincronizada'
              : `${res.synced} vendas offline sincronizadas`,
          );
          await onSynced?.();
        }
        if (res.failed > 0) {
          toast.error(`${res.failed} venda(s) offline falharam na sync. Tente de novo.`);
        }
        await refresh();
      } finally {
        if (!cancelled) setSyncing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao reconectar / trocar empresa
  }, [online, currentCompany?.id, user?.accessToken]);

  if (pending <= 0) return null;

  return (
    <div className="sticky top-0 z-[55] w-full bg-sky-700 text-white px-3 py-2 text-sm font-medium shadow-md">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="inline-flex items-center gap-2">
          <CloudOff className="w-4 h-4 shrink-0" aria-hidden />
          {pending} venda(s) offline (cupom não fiscal) pendente(s) de sincronizar
        </span>
        {online && (
          <button
            type="button"
            disabled={syncing || !user?.accessToken}
            onClick={() => {
              if (!currentCompany?.id || !user?.accessToken) return;
              setSyncing(true);
              void syncPendingOfflineSales({
                companyId: currentCompany.id,
                accessToken: user.accessToken,
              })
                .then(async (res) => {
                  if (res.synced > 0) {
                    toast.success(`${res.synced} sincronizada(s)`);
                    await onSynced?.();
                  }
                  if (res.failed > 0) toast.error(`${res.failed} falha(s) na sync`);
                  await refresh();
                })
                .finally(() => setSyncing(false));
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-white/15 px-2.5 py-1 text-xs font-semibold hover:bg-white/25 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
        )}
      </div>
    </div>
  );
}
