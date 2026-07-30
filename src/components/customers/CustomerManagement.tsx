import { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  UserRound,
  Phone,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { useCompany } from '../../contexts/CompanyContext';
import { CustomerApi, type Customer, type CustomerInput } from '../../repositories/customerApi';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { messageFromUnknownError } from '../../utils/errorMessage';

function onlyDigits(v: string) {
  return v.replace(/\D/g, '');
}

function formatDocInput(raw: string) {
  const d = onlyDigits(raw).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function formatCep(raw: string) {
  const d = onlyDigits(raw).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

const emptyForm = (): CustomerInput & { document: string } => ({
  name: '',
  document: '',
  email: '',
  phone: '',
  notes: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  municipio: '',
  codigoMunicipio: '',
  uf: 'AM',
  cep: '',
});

export function CustomerManagement() {
  const { currentCompany } = useCompany();
  const companyId = currentCompany?.id;

  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const list = await CustomerApi.search(search, companyId);
      setCustomers(list);
    } catch (err) {
      toast.error(messageFromUnknownError(err, 'Erro ao carregar clientes'));
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [companyId, search]);

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(t);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({
      name: c.name,
      document: c.documentFormatted || c.documentDigits,
      email: c.email || '',
      phone: c.phone || '',
      notes: c.notes || '',
      logradouro: c.logradouro || '',
      numero: c.numero || '',
      complemento: c.complemento || '',
      bairro: c.bairro || '',
      municipio: c.municipio || '',
      codigoMunicipio: c.codigoMunicipio || '',
      uf: c.uf || 'AM',
      cep: c.cep ? formatCep(c.cep) : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!companyId) return;
    const name = form.name.trim();
    const doc = onlyDigits(form.document);
    if (name.length < 2) {
      toast.error('Informe o nome do cliente');
      return;
    }
    if (doc.length !== 11 && doc.length !== 14) {
      toast.error('Informe CPF (11) ou CNPJ (14 dígitos)');
      return;
    }
    setSaving(true);
    try {
      const payload: CustomerInput = {
        name,
        document: doc,
        email: form.email || null,
        phone: form.phone || null,
        notes: form.notes || null,
        logradouro: form.logradouro || null,
        numero: form.numero || null,
        complemento: form.complemento || null,
        bairro: form.bairro || null,
        municipio: form.municipio || null,
        codigoMunicipio: form.codigoMunicipio || null,
        uf: form.uf || null,
        cep: form.cep || null,
      };
      if (editing) {
        await CustomerApi.update(editing.id, payload, companyId);
        toast.success('Cliente atualizado');
      } else {
        await CustomerApi.create(payload, companyId);
        toast.success('Cliente cadastrado');
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error(messageFromUnknownError(err, 'Erro ao salvar cliente'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!companyId) return;
    if (!confirm(`Desativar cliente «${c.name}»?`)) return;
    try {
      await CustomerApi.remove(c.id, companyId);
      toast.success('Cliente desativado');
      await load();
    } catch (err) {
      toast.error(messageFromUnknownError(err, 'Erro ao desativar'));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Clientes
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Cadastro para fiado, boleto e NFC-e (nome, CPF/CNPJ e endereço).
          </p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Novo cliente
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar nome, CPF/CNPJ ou telefone"
          className="pl-9"
        />
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            Carregando...
          </div>
        ) : customers.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <UserRound className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nenhum cliente encontrado</p>
            <p className="text-sm mt-1">Cadastre o primeiro cliente para usar no PDV e NFC-e.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {customers.map((c) => (
              <li
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-900/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.documentType.toUpperCase()} {c.documentFormatted}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
                    {c.phone && (
                      <span className="inline-flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {c.phone}
                      </span>
                    )}
                    {(c.municipio || c.uf) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {[c.municipio, c.uf].filter(Boolean).join(' / ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                    onClick={() => void handleDelete(c)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Nome completo ou razão social"
              />
            </div>
            <div className="space-y-1.5">
              <Label>CPF / CNPJ *</Label>
              <Input
                value={form.document}
                onChange={(e) => setForm((f) => ({ ...f, document: formatDocInput(e.target.value) }))}
                inputMode="numeric"
                placeholder="000.000.000-00"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={form.phone || ''}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="(92) 90000-0000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="cliente@email.com"
                />
              </div>
            </div>

            <p className="text-xs font-semibold text-gray-500 uppercase pt-2">Endereço (NFC-e)</p>
            <div className="space-y-1.5">
              <Label>Logradouro</Label>
              <Input
                value={form.logradouro || ''}
                onChange={(e) => setForm((f) => ({ ...f, logradouro: e.target.value }))}
                placeholder="Rua, avenida..."
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Nº</Label>
                <Input
                  value={form.numero || ''}
                  onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Complemento</Label>
                <Input
                  value={form.complemento || ''}
                  onChange={(e) => setForm((f) => ({ ...f, complemento: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bairro</Label>
                <Input
                  value={form.bairro || ''}
                  onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>CEP</Label>
                <Input
                  value={form.cep || ''}
                  onChange={(e) => setForm((f) => ({ ...f, cep: formatCep(e.target.value) }))}
                  inputMode="numeric"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Município</Label>
                <Input
                  value={form.municipio || ''}
                  onChange={(e) => setForm((f) => ({ ...f, municipio: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>UF</Label>
                <Input
                  value={form.uf || ''}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, uf: e.target.value.toUpperCase().slice(0, 2) }))
                  }
                  maxLength={2}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cód. município IBGE</Label>
              <Input
                value={form.codigoMunicipio || ''}
                onChange={(e) => setForm((f) => ({ ...f, codigoMunicipio: onlyDigits(e.target.value).slice(0, 7) }))}
                inputMode="numeric"
                placeholder="1302603 (Manaus)"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Input
                value={form.notes || ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
