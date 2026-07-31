import React, { useCallback, useEffect, useState } from 'react';
import { FileKey, Loader2, Save, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { apiClient, ApiClientError } from '../../lib/apiClient';
import { notifyFiscalConfigUpdated } from '../../hooks/useFiscalReadiness';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

type FiscalAmbiente = 'development' | 'homologation' | 'production';

interface FiscalConfigForm {
  cnpj: string;
  ie: string;
  razaoSocial: string;
  nomeFantasia: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  municipio: string;
  codigoMunicipio: string;
  uf: string;
  cep: string;
  telefone: string;
  email: string;
  logoUrl: string;
  crt: number;
  ambiente: FiscalAmbiente;
  serieNfce: number;
  numeroNfce: number;
  cscId: string;
  cscToken: string;
  enabled: boolean;
  hasCscToken: boolean;
  cscTokenMasked: string | null;
}

interface CertificateStatus {
  present: boolean;
  subjectCn: string | null;
  validUntil: string | null;
  expired: boolean;
  fingerprintSha256?: string | null;
}

const emptyForm = (): FiscalConfigForm => ({
  cnpj: '',
  ie: '',
  razaoSocial: '',
  nomeFantasia: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  municipio: '',
  codigoMunicipio: '',
  uf: 'AM',
  cep: '',
  telefone: '',
  email: '',
  logoUrl: '',
  crt: 1,
  ambiente: 'homologation',
  serieNfce: 1,
  numeroNfce: 0,
  cscId: '',
  cscToken: '',
  enabled: false,
  hasCscToken: false,
  cscTokenMasked: null,
});

type FiscalSettingsSection = 'full' | 'company' | 'technical';

interface FiscalSettingsProps {
  /** full = tudo; company = dados da empresa; technical = CSC/certificado/ambiente */
  section?: FiscalSettingsSection;
}

export function FiscalSettings({ section = 'full' }: FiscalSettingsProps) {
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const canEdit =
    !!user?.permissions?.canManageSettings ||
    user?.role === 'admin' ||
    user?.role === 'superadmin';
  const showCompany = section === 'full' || section === 'company';
  const showTechnical = section === 'full' || section === 'technical';

  const [form, setForm] = useState<FiscalConfigForm>(emptyForm);
  const [certificate, setCertificate] = useState<CertificateStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [certPassword, setCertPassword] = useState('');
  const [certFileName, setCertFileName] = useState<string | null>(null);
  const [certBase64, setCertBase64] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const [cfgRes, certRes] = await Promise.all([
        apiClient.get<{ config: Record<string, unknown> | null }>('/fiscal/config'),
        apiClient.get<{ certificate: CertificateStatus }>('/fiscal/certificate'),
      ]);
      const c = cfgRes.config;
      if (c) {
        setForm({
          cnpj: String(c.cnpj || ''),
          ie: String(c.ie || ''),
          razaoSocial: String(c.razaoSocial || ''),
          nomeFantasia: String(c.nomeFantasia || ''),
          logradouro: String(c.logradouro || ''),
          numero: String(c.numero || ''),
          complemento: String(c.complemento || ''),
          bairro: String(c.bairro || ''),
          municipio: String(c.municipio || ''),
          codigoMunicipio: String(c.codigoMunicipio || ''),
          uf: String(c.uf || 'AM'),
          cep: String(c.cep || ''),
          telefone: String(c.telefone || ''),
          email: String(c.email || ''),
          logoUrl: String(c.logoUrl || ''),
          crt: Number(c.crt) || 1,
          ambiente: (c.ambiente as FiscalAmbiente) || 'homologation',
          serieNfce: Number(c.serieNfce) || 1,
          numeroNfce: Number(c.numeroNfce) || 0,
          cscId: String(c.cscId || ''),
          cscToken: '',
          enabled: !!c.enabled,
          hasCscToken: !!c.hasCscToken,
          cscTokenMasked: c.cscTokenMasked != null ? String(c.cscTokenMasked) : null,
        });
      } else {
        setForm(emptyForm());
      }
      setCertificate(certRes.certificate);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Falha ao carregar fiscal';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const setField = <K extends keyof FiscalConfigForm>(key: K, value: FiscalConfigForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast.error('Sem permissão para alterar configuração fiscal');
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        cnpj: form.cnpj,
        ie: form.ie,
        razaoSocial: form.razaoSocial,
        nomeFantasia: form.nomeFantasia || null,
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento || null,
        bairro: form.bairro,
        municipio: form.municipio,
        codigoMunicipio: form.codigoMunicipio,
        uf: form.uf,
        cep: form.cep,
        telefone: form.telefone || null,
        email: form.email || null,
        logoUrl: form.logoUrl || null,
        crt: form.crt,
        ambiente: form.ambiente,
        serieNfce: form.serieNfce,
        numeroNfce: form.numeroNfce,
        cscId: form.cscId || null,
        enabled: form.enabled,
      };
      if (form.cscToken.trim()) {
        payload.cscToken = form.cscToken.trim();
      }
      await apiClient.put('/fiscal/config', payload);
      toast.success(
        form.enabled
          ? 'Fiscal ativado — NFC-e liberada no PDV e Venda Manual'
          : 'Configuração fiscal salva',
      );
      setForm((prev) => ({ ...prev, cscToken: '' }));
      notifyFiscalConfigUpdated();
      await load();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erro ao salvar';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const onCertFile = (file: File | null) => {
    if (!file) {
      setCertFileName(null);
      setCertBase64(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setCertBase64(result);
      setCertFileName(file.name);
    };
    reader.onerror = () => toast.error('Falha ao ler o certificado');
    reader.readAsDataURL(file);
  };

  const handleUploadCert = async () => {
    if (!canEdit) return;
    if (!certBase64) {
      toast.error('Selecione o arquivo .pfx / .p12');
      return;
    }
    if (!certPassword) {
      toast.error('Informe a senha do certificado');
      return;
    }
    setUploading(true);
    try {
      await apiClient.post('/fiscal/certificate', {
        fileBase64: certBase64,
        password: certPassword,
        subjectCn: certFileName || 'Certificado A1',
      });
      toast.success('Certificado A1 armazenado com segurança');
      setCertPassword('');
      setCertBase64(null);
      setCertFileName(null);
      notifyFiscalConfigUpdated();
      await load();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erro no upload';
      toast.error(msg);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteCert = async () => {
    if (!canEdit) return;
    if (!confirm('Remover o certificado digital desta empresa?')) return;
    try {
      await apiClient.delete('/fiscal/certificate');
      toast.success('Certificado removido');
      notifyFiscalConfigUpdated();
      await load();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Erro ao remover';
      toast.error(msg);
    }
  };

  if (!currentCompany) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Selecione uma empresa para configurar o módulo fiscal.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando configuração fiscal…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            {section === 'company' ? 'Dados da empresa' : 'NFC-e SEFAZ-AM'}
          </CardTitle>
          <CardDescription>
            {section === 'company'
              ? 'Nome, CNPJ, endereço e contato usados no cupom / DANFE e na emissão fiscal.'
              : section === 'technical'
                ? 'Ambiente SEFAZ, numeração, CSC e certificado digital A1.'
                : 'Configuração fiscal da empresa (modelo 65). Certificado e CSC ficam só no servidor.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {showTechnical && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div>
              <p className="font-medium text-sm">Habilitar módulo fiscal</p>
              <p className="text-xs text-muted-foreground">
                Necessário para liberar a opção “Emitir NFC-e” no PDV.
              </p>
            </div>
            <Switch
              checked={form.enabled}
              disabled={!canEdit}
              onCheckedChange={async (v) => {
                setField('enabled', v);
                if (!canEdit) return;
                // Persistência imediata do toggle — libera NFC-e no PDV sem depender só do “Salvar”
                try {
                  if (!form.cnpj.trim() || !form.ie.trim() || !form.razaoSocial.trim()) {
                    toast.message(
                      v
                        ? 'Módulo marcado. Preencha CNPJ, IE e razão social e clique em Salvar.'
                        : 'Desative e salve para gravar.',
                    );
                    return;
                  }
                  await apiClient.put('/fiscal/config', {
                    cnpj: form.cnpj,
                    ie: form.ie,
                    razaoSocial: form.razaoSocial,
                    nomeFantasia: form.nomeFantasia || null,
                    logradouro: form.logradouro,
                    numero: form.numero,
                    complemento: form.complemento || null,
                    bairro: form.bairro,
                    municipio: form.municipio,
                    codigoMunicipio: form.codigoMunicipio,
                    uf: form.uf,
                    cep: form.cep,
                    telefone: form.telefone || null,
                    email: form.email || null,
                    logoUrl: form.logoUrl || null,
                    crt: form.crt,
                    ambiente: form.ambiente,
                    serieNfce: form.serieNfce,
                    numeroNfce: form.numeroNfce,
                    cscId: form.cscId || null,
                    enabled: v,
                  });
                  toast.success(
                    v ? 'NFC-e ativada no PDV e Venda Manual' : 'Módulo fiscal desativado',
                  );
                  notifyFiscalConfigUpdated();
                } catch (err) {
                  setField('enabled', !v);
                  const msg = err instanceof ApiClientError ? err.message : 'Erro ao salvar';
                  toast.error(msg);
                }
              }}
            />
          </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {showTechnical && (
            <>
            <div className="space-y-1.5">
              <Label>Ambiente</Label>
              <select
                disabled={!canEdit}
                value={form.ambiente}
                onChange={(e) => setField('ambiente', e.target.value as FiscalAmbiente)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="development">Development (sandbox SEFAZ-AM)</option>
                <option value="homologation">Homologação oficial (recomendado)</option>
                <option value="production">Produção (bloqueada até testes)</option>
              </select>
              {form.ambiente === 'development' && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  Sandbox experimental (nfce-services-nac). O sistema usa automaticamente o CSC de
                  teste ID 000001 / 0123456789. Para empresa credenciada no AM, use Homologação
                  oficial com o CSC do portal da SEFAZ.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>CRT</Label>
              <select
                disabled={!canEdit}
                value={form.crt}
                onChange={(e) => setField('crt', Number(e.target.value))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value={1}>1 — Simples Nacional</option>
                <option value={2}>2 — Simples — excesso sublimite</option>
                <option value={3}>3 — Regime Normal</option>
              </select>
            </div>
            </>
            )}
            {showCompany && (
            <>
            <div className="space-y-1.5">
              <Label>CNPJ</Label>
              <Input
                disabled={!canEdit}
                value={form.cnpj}
                onChange={(e) => setField('cnpj', e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Inscrição Estadual</Label>
              <Input
                disabled={!canEdit}
                value={form.ie}
                onChange={(e) => setField('ie', e.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Razão social</Label>
              <Input
                disabled={!canEdit}
                value={form.razaoSocial}
                onChange={(e) => setField('razaoSocial', e.target.value)}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Nome fantasia</Label>
              <Input
                disabled={!canEdit}
                value={form.nomeFantasia}
                onChange={(e) => setField('nomeFantasia', e.target.value)}
              />
            </div>
            </>
            )}
          </div>

          {showCompany && (
          <>
          <div>
            <p className="text-sm font-semibold mb-3">Endereço do estabelecimento</p>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="md:col-span-4 space-y-1.5">
                <Label>Logradouro</Label>
                <Input
                  disabled={!canEdit}
                  value={form.logradouro}
                  onChange={(e) => setField('logradouro', e.target.value)}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label>Número</Label>
                <Input
                  disabled={!canEdit}
                  value={form.numero}
                  onChange={(e) => setField('numero', e.target.value)}
                />
              </div>
              <div className="md:col-span-3 space-y-1.5">
                <Label>Complemento</Label>
                <Input
                  disabled={!canEdit}
                  value={form.complemento}
                  onChange={(e) => setField('complemento', e.target.value)}
                />
              </div>
              <div className="md:col-span-3 space-y-1.5">
                <Label>Bairro</Label>
                <Input
                  disabled={!canEdit}
                  value={form.bairro}
                  onChange={(e) => setField('bairro', e.target.value)}
                />
              </div>
              <div className="md:col-span-3 space-y-1.5">
                <Label>Município</Label>
                <Input
                  disabled={!canEdit}
                  value={form.municipio}
                  onChange={(e) => setField('municipio', e.target.value)}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label>Cód. IBGE município</Label>
                <Input
                  disabled={!canEdit}
                  value={form.codigoMunicipio}
                  onChange={(e) => setField('codigoMunicipio', e.target.value)}
                  placeholder="1302603"
                />
              </div>
              <div className="space-y-1.5">
                <Label>UF</Label>
                <Input
                  disabled={!canEdit}
                  value={form.uf}
                  onChange={(e) => setField('uf', e.target.value.toUpperCase().slice(0, 2))}
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label>CEP</Label>
                <Input
                  disabled={!canEdit}
                  value={form.cep}
                  onChange={(e) => setField('cep', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold mb-3">Contato e logo (impressos no cupom / DANFE)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Telefone / WhatsApp</Label>
                <Input
                  disabled={!canEdit}
                  value={form.telefone}
                  onChange={(e) => setField('telefone', e.target.value)}
                  placeholder="(92) 90000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  disabled={!canEdit}
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  placeholder="contato@empresa.com.br"
                />
              </div>
              <div className="md:col-span-2 space-y-1.5">
                <Label>Logo (URL ou upload)</Label>
                <Input
                  disabled={!canEdit}
                  value={form.logoUrl}
                  onChange={(e) => setField('logoUrl', e.target.value)}
                  placeholder="https://... ou envie um arquivo abaixo"
                />
                {canEdit && (
                  <Input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 400_000) {
                        toast.error('Logo muito grande (máx. ~400 KB). Use PNG/JPG compacto.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        setField('logoUrl', String(reader.result || ''));
                        toast.success('Logo carregada — clique em Salvar');
                      };
                      reader.onerror = () => toast.error('Falha ao ler a logo');
                      reader.readAsDataURL(file);
                    }}
                  />
                )}
                {form.logoUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <img
                      src={form.logoUrl}
                      alt="Prévia da logo"
                      className="h-14 max-w-[160px] object-contain rounded border border-gray-200 dark:border-gray-700 bg-white p-1"
                    />
                    {canEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setField('logoUrl', '')}
                      >
                        Remover logo
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          </>
          )}

          {showTechnical && (
          <div>
            <p className="text-sm font-semibold mb-3">Numeração NFC-e / CSC</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label>Série</Label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={form.serieNfce}
                  onChange={(e) => setField('serieNfce', Number(e.target.value) || 1)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Último número</Label>
                <Input
                  type="number"
                  disabled={!canEdit}
                  value={form.numeroNfce}
                  onChange={(e) => setField('numeroNfce', Number(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>ID do CSC</Label>
                <Input
                  disabled={!canEdit}
                  value={form.cscId}
                  onChange={(e) => setField('cscId', e.target.value)}
                  placeholder="Ex.: 1 ou 000001"
                />
                <p className="text-[11px] text-muted-foreground">
                  Identificador numérico no portal (não é o token secreto).
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Token CSC (código secreto)</Label>
                <Input
                  type="password"
                  disabled={!canEdit}
                  value={form.cscToken}
                  onChange={(e) => setField('cscToken', e.target.value)}
                  placeholder={
                    form.hasCscToken
                      ? `Salvo (${form.cscTokenMasked || '********'}) — cole de novo p/ trocar`
                      : 'Cole o CSC de homologação do portal SEFAZ-AM'
                  }
                  autoComplete="new-password"
                />
              </div>
            </div>
            {form.ambiente === 'homologation' && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                Homologação exige o CSC de homologação da sua empresa no portal SEFAZ-AM.
                Não use 0123456789 (isso é só do sandbox Development). Se a SEFAZ retornar
                rejeição 464 (hash do QR), recadastre ID + Token e salve novamente.
              </p>
            )}
            {form.ambiente === 'development' && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                Em Development o CSC salvo é ignorado — a API aplica o CSC experimental
                000001 / 0123456789 na emissão.
              </p>
            )}
          </div>
          )}

          {canEdit && (
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar configuração
            </Button>
          )}
          {!canEdit && (
            <p className="text-xs text-muted-foreground">
              Somente administradores podem alterar a configuração fiscal.
            </p>
          )}
        </CardContent>
      </Card>

      {showTechnical && (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileKey className="w-5 h-5" />
            Certificado digital A1
          </CardTitle>
          <CardDescription>
            Upload .pfx / .p12. A senha é criptografada no servidor e nunca retorna ao frontend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {certificate?.present ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-4 text-sm space-y-1">
              <p className="font-medium text-emerald-900 dark:text-emerald-200">
                Certificado cadastrado
                {certificate.expired ? ' (expirado)' : ''}
              </p>
              {certificate.subjectCn && (
                <p className="text-emerald-800 dark:text-emerald-300">{certificate.subjectCn}</p>
              )}
              {certificate.validUntil && (
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Validade até {new Date(certificate.validUntil).toLocaleDateString('pt-BR')}
                </p>
              )}
              {canEdit && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1 text-red-600"
                  onClick={handleDeleteCert}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Remover
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum certificado cadastrado.</p>
          )}

          {canEdit && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Arquivo .pfx / .p12</Label>
                <Input
                  type="file"
                  accept=".pfx,.p12,application/x-pkcs12"
                  onChange={(e) => onCertFile(e.target.files?.[0] ?? null)}
                />
                {certFileName && (
                  <p className="text-xs text-muted-foreground">{certFileName}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Senha do certificado</Label>
                <Input
                  type="password"
                  value={certPassword}
                  onChange={(e) => setCertPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="md:col-span-2">
                <Button
                  onClick={handleUploadCert}
                  disabled={uploading || !certBase64}
                  className="gap-2"
                >
                  {uploading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Enviar certificado
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
