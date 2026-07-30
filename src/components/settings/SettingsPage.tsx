import { useEffect, useState } from 'react';
import { Building2, KeyRound, Loader2, Plug, Save, Settings } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { apiClient, ApiClientError } from '../../lib/apiClient';
import { FiscalSettings } from '../fiscal/FiscalSettings';
import { ZigIntegrationSettings } from '../sales/ZigIntegrationSettings';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

export type SettingsTab = 'empresa' | 'integracoes' | 'senha';

interface SettingsPageProps {
  onSyncComplete?: () => void | Promise<void>;
  initialTab?: SettingsTab;
}

const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Building2 }> = [
  { id: 'empresa', label: 'Empresa', icon: Building2 },
  { id: 'integracoes', label: 'Integrações', icon: Plug },
  { id: 'senha', label: 'Senha', icon: KeyRound },
];

export function SettingsPage({ onSyncComplete, initialTab = 'empresa' }: SettingsPageProps) {
  const { user } = useAuth();
  const { currentCompany, refreshCompanies } = useCompany();
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [companyName, setCompanyName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    setCompanyName(currentCompany?.name || '');
  }, [currentCompany?.id, currentCompany?.name]);

  const canEditCompany =
    !!user?.permissions?.canManageSettings ||
    user?.role === 'admin' ||
    user?.role === 'superadmin';

  const saveCompanyName = async () => {
    if (!currentCompany?.id || !canEditCompany) return;
    const name = companyName.trim();
    if (name.length < 2) {
      toast.error('Informe um nome válido para a empresa');
      return;
    }
    setSavingName(true);
    try {
      await apiClient.patch(`/companies/${currentCompany.id}`, { name });
      await refreshCompanies();
      toast.success('Nome da empresa atualizado');
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erro ao salvar nome';
      toast.error(msg);
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async () => {
    if (!currentPassword) {
      toast.error('Informe a senha atual');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('A confirmação não confere com a nova senha');
      return;
    }
    setSavingPassword(true);
    try {
      await apiClient.post('/users/me/change-password', {
        currentPassword,
        newPassword,
      });
      toast.success('Senha alterada com sucesso');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erro ao alterar senha';
      toast.error(msg);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Settings className="w-7 h-7 text-blue-600" aria-hidden />
          Configurações
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Personalize a empresa, gerencie integrações e altere sua senha.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700 pb-2">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'empresa' && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identificação no sistema</CardTitle>
              <CardDescription>
                Nome exibido na troca de empresa e no painel. CNPJ fiscal, endereço e contato ficam
                abaixo (também usados no DANFE).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5 max-w-lg">
                <Label>Nome da empresa</Label>
                <Input
                  value={companyName}
                  disabled={!canEditCompany}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Nome da organização"
                />
              </div>
              {canEditCompany && (
                <Button onClick={saveCompanyName} disabled={savingName} className="gap-2">
                  {savingName ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Salvar nome
                </Button>
              )}
            </CardContent>
          </Card>

          <FiscalSettings section="company" />
        </div>
      )}

      {tab === 'integracoes' && (
        <div className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Fiscal (NFC-e)
            </h2>
            <FiscalSettings section="technical" />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">ZIG</h2>
            <ZigIntegrationSettings onSyncComplete={onSyncComplete} />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Outras integrações</CardTitle>
              <CardDescription>
                Espaço reservado para novos conectores (APIs, ERPs, marketplaces, etc.).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Quando você adicionar uma nova integração, ela aparecerá nesta área.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'senha' && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <KeyRound className="w-5 h-5" />
              Trocar senha
            </CardTitle>
            <CardDescription>
              Altere a senha da sua conta ({user?.email || 'usuário logado'}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label>Senha atual</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button onClick={changePassword} disabled={savingPassword} className="gap-2">
              {savingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              Alterar senha
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
