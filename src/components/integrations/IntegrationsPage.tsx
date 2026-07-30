import { SettingsPage } from '../settings/SettingsPage';

interface IntegrationsPageProps {
  onSyncComplete?: () => void | Promise<void>;
}

/** Mantido por compatibilidade — redireciona para Configurações → Integrações. */
export function IntegrationsPage({ onSyncComplete }: IntegrationsPageProps) {
  return <SettingsPage onSyncComplete={onSyncComplete} initialTab="integracoes" />;
}
