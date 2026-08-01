import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Aviso fixo quando o cliente fica sem rede.
 * Modo seguro: UI pode abrir do cache; vendas/baixas/API exigem conexão.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;

  return (
    <div
      role="status"
      className="sticky top-0 z-[60] w-full bg-amber-600 text-white px-3 py-2 text-center text-sm font-medium shadow-md"
    >
      <span className="inline-flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4 shrink-0" aria-hidden />
        Sem conexão — cupom não fiscal no PDV pode ser enfileirado. NFC-e, fiado, ZIG e login precisam de internet.
      </span>
    </div>
  );
}
