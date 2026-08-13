import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Search, UserRound, X } from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { CustomerApi, type Customer } from '../../repositories/customerApi';
import { useCompany } from '../../contexts/CompanyContext';

export type SelectedCustomer = {
  id: string;
  name: string;
  documentDigits: string;
  documentType: 'cpf' | 'cnpj';
  documentFormatted: string;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  codigoMunicipio?: string | null;
  uf?: string | null;
  cep?: string | null;
};

interface CustomerPickerProps {
  value: SelectedCustomer | null;
  onChange: (customer: SelectedCustomer | null) => void;
  /** Quando true, bloqueia confirmar sem cliente */
  required?: boolean;
  label?: string;
  hint?: string;
  /**
   * Offline / venda avulsa: não busca API nem exige cadastro.
   * Mostra aviso e permite seguir sem cliente.
   */
  allowWalkInWithoutCustomer?: boolean;
  /** Exige endereço no cadastro (obrigatório para NF-e). */
  requireAddress?: boolean;
}

function onlyDigits(v: string) {
  return v.replace(/\D/g, '');
}

function toSelected(c: Customer): SelectedCustomer {
  return {
    id: c.id,
    name: c.name,
    documentDigits: c.documentDigits,
    documentType: c.documentType,
    documentFormatted: c.documentFormatted,
    logradouro: c.logradouro,
    numero: c.numero,
    complemento: c.complemento,
    bairro: c.bairro,
    municipio: c.municipio,
    codigoMunicipio: c.codigoMunicipio,
    uf: c.uf,
    cep: c.cep,
  };
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

function formatCepInput(raw: string) {
  const d = onlyDigits(raw).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

const emptyCreate = () => ({
  name: '',
  doc: '',
  phone: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  municipio: '',
  uf: 'AM',
  cep: '',
});

/**
 * Busca e seleciona cliente; cadastro novo fica no próprio painel (sem modal).
 */
export function CustomerPicker({
  value,
  onChange,
  required = false,
  label = 'Cliente',
  hint,
  allowWalkInWithoutCustomer = false,
  requireAddress = false,
}: CustomerPickerProps) {
  const { currentCompany } = useCompany();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyCreate);

  const walkIn = allowWalkInWithoutCustomer || (typeof navigator !== 'undefined' && !navigator.onLine);
  const effectivelyRequired = required && !walkIn;

  useEffect(() => {
    if (walkIn) {
      setResults([]);
      setLoading(false);
      setShowCreate(false);
      return;
    }
    if (!currentCompany?.id) return;
    const t = window.setTimeout(() => {
      setLoading(true);
      void CustomerApi.search(query, currentCompany.id)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(t);
  }, [query, currentCompany?.id, walkIn]);

  const filteredHint = useMemo(() => {
    if (walkIn) return 'Venda avulsa offline — cliente não é necessário';
    if (hint) return hint;
    if (requireAddress) {
      return 'Busque ou cadastre: nome, CPF/CNPJ e endereço (obrigatório para NF-e)';
    }
    if (effectivelyRequired) return 'Busque ou cadastre: nome e CPF/CNPJ';
    return 'Busque por nome ou documento — ou cadastre um novo abaixo';
  }, [hint, effectivelyRequired, walkIn, requireAddress]);

  const openCreate = () => {
    const next = emptyCreate();
    if (query && !onlyDigits(query)) next.name = query.trim();
    if (onlyDigits(query).length >= 11) next.doc = formatDocInput(query);
    setForm(next);
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!currentCompany?.id) return;
    const name = form.name.trim();
    const doc = onlyDigits(form.doc);
    if (name.length < 2) {
      toast.error('Informe o nome do cliente');
      return;
    }
    if (doc.length !== 11 && doc.length !== 14) {
      toast.error('Informe CPF (11) ou CNPJ (14 dígitos)');
      return;
    }
    if (requireAddress) {
      const cep = onlyDigits(form.cep);
      if (!form.logradouro.trim() || !form.municipio.trim() || cep.length !== 8) {
        toast.error('NF-e exige logradouro, município e CEP');
        return;
      }
    }
    setCreating(true);
    try {
      const customer = await CustomerApi.create(
        {
          name,
          document: doc,
          phone: form.phone.trim() || undefined,
          logradouro: form.logradouro.trim() || undefined,
          numero: form.numero.trim() || undefined,
          complemento: form.complemento.trim() || undefined,
          bairro: form.bairro.trim() || undefined,
          municipio: form.municipio.trim() || undefined,
          uf: form.uf.trim() || undefined,
          cep: onlyDigits(form.cep) || undefined,
        },
        currentCompany.id,
      );
      onChange(toSelected(customer));
      setShowCreate(false);
      setForm(emptyCreate());
      setQuery('');
      // Recarrega lista para o cliente aparecer nas próximas buscas
      try {
        const refreshed = await CustomerApi.search(customer.name, currentCompany.id);
        setResults(refreshed);
      } catch {
        /* ignore */
      }
      toast.success('Cliente cadastrado e selecionado');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar cliente';
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  if (walkIn && !value) {
    return (
      <div className="space-y-1.5 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-800 p-3">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">{label}</label>
        <p className="text-sm text-emerald-800 dark:text-emerald-200">
          Venda avulsa — sem dados de cliente. A busca/cadastro precisa de internet.
        </p>
      </div>
    );
  }

  if (value) {
    const hasAddr = !!(value.logradouro && value.municipio && onlyDigits(value.cep || '').length === 8);
    return (
      <div className="space-y-1.5">
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          {label}
          {effectivelyRequired && <span className="text-red-500"> *</span>}
        </label>
        <div className="flex items-start gap-3 rounded-xl border-2 border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 p-3">
          <UserRound className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900 dark:text-gray-100 truncate">{value.name}</p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {value.documentType.toUpperCase()}: {value.documentFormatted}
            </p>
            {hasAddr ? (
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                {value.logradouro}
                {value.numero ? `, ${value.numero}` : ''} — {value.municipio}/{value.uf || '—'}
              </p>
            ) : requireAddress ? (
              <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                Endereço incompleto — cadastre outro cliente ou complete no menu Clientes
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setShowCreate(false);
              setQuery('');
            }}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-white/80 dark:hover:bg-gray-800"
            aria-label="Trocar cliente"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
        {label}
        {effectivelyRequired && <span className="text-red-500"> *</span>}
      </label>
      <p className="text-xs text-gray-500">{filteredHint}</p>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (showCreate) setShowCreate(false);
          }}
          placeholder="Buscar por nome ou CPF/CNPJ"
          className="w-full pl-9 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>

      {results.length > 0 && !showCreate && (
        <ul className="max-h-44 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800 shadow-sm">
          {results.slice(0, 10).map((c) => {
            const addrOk =
              !!(c.logradouro && c.municipio && onlyDigits(c.cep || '').length === 8);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onChange(toSelected(c))}
                  className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                >
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.documentType.toUpperCase()} {c.documentFormatted}
                    {requireAddress && !addrOk ? ' · endereço incompleto' : ''}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && query.trim() && results.length === 0 && !showCreate && (
        <p className="text-xs text-gray-500 px-1">Nenhum cliente encontrado. Cadastre um novo abaixo.</p>
      )}

      {!showCreate ? (
        <button
          type="button"
          onClick={openCreate}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 text-sm font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
        >
          <Plus className="w-4 h-4" />
          Cadastrar novo cliente
        </button>
      ) : (
        <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-950/20 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold text-blue-800 dark:text-blue-200 uppercase tracking-wide">
              Novo cliente
            </p>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-xs font-medium text-gray-500 hover:text-gray-800"
              disabled={creating}
            >
              Voltar à busca
            </button>
          </div>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Nome completo *"
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
            autoFocus
          />
          <input
            type="text"
            value={form.doc}
            onChange={(e) => setForm((f) => ({ ...f, doc: formatDocInput(e.target.value) }))}
            placeholder="CPF ou CNPJ *"
            inputMode="numeric"
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
          />
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder="Telefone (opcional)"
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
          />

          {(requireAddress || showCreate) && (
            <div className="pt-1 space-y-2 border-t border-blue-100 dark:border-blue-900">
              <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 uppercase">
                Endereço{requireAddress ? ' *' : ' (opcional)'}
              </p>
              <input
                type="text"
                value={form.logradouro}
                onChange={(e) => setForm((f) => ({ ...f, logradouro: e.target.value }))}
                placeholder={requireAddress ? 'Logradouro *' : 'Logradouro'}
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.numero}
                  onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                  placeholder="Nº"
                  className="col-span-1 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                />
                <input
                  type="text"
                  value={form.bairro}
                  onChange={(e) => setForm((f) => ({ ...f, bairro: e.target.value }))}
                  placeholder="Bairro"
                  className="col-span-2 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={form.municipio}
                  onChange={(e) => setForm((f) => ({ ...f, municipio: e.target.value }))}
                  placeholder={requireAddress ? 'Município *' : 'Município'}
                  className="col-span-2 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                />
                <input
                  type="text"
                  value={form.uf}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, uf: e.target.value.toUpperCase().slice(0, 2) }))
                  }
                  placeholder="UF"
                  className="col-span-1 px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm uppercase"
                />
              </div>
              <input
                type="text"
                value={form.cep}
                onChange={(e) => setForm((f) => ({ ...f, cep: formatCepInput(e.target.value) }))}
                placeholder={requireAddress ? 'CEP *' : 'CEP'}
                inputMode="numeric"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              />
              <input
                type="text"
                value={form.complemento}
                onChange={(e) => setForm((f) => ({ ...f, complemento: e.target.value }))}
                placeholder="Complemento"
                className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
              />
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating}
            className="w-full py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Salvar e selecionar
          </button>
        </div>
      )}
    </div>
  );
}
