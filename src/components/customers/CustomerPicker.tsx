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
}

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

/**
 * Busca / seleciona / cadastra cliente (nome + CPF/CNPJ).
 */
export function CustomerPicker({
  value,
  onChange,
  required = false,
  label = 'Cliente',
  hint,
  allowWalkInWithoutCustomer = false,
}: CustomerPickerProps) {
  const { currentCompany } = useCompany();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDoc, setNewDoc] = useState('');
  const [newPhone, setNewPhone] = useState('');

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
    if (walkIn) {
      return 'Venda avulsa offline — cliente não é necessário';
    }
    if (hint) return hint;
    if (effectivelyRequired) return 'Obrigatório: nome e CPF ou CNPJ';
    return 'Busque ou cadastre (nome + CPF/CNPJ)';
  }, [hint, effectivelyRequired, walkIn]);

  const handleCreate = async () => {
    if (!currentCompany?.id) return;
    const name = newName.trim();
    const doc = onlyDigits(newDoc);
    if (name.length < 2) {
      toast.error('Informe o nome do cliente');
      return;
    }
    if (doc.length !== 11 && doc.length !== 14) {
      toast.error('Informe CPF (11) ou CNPJ (14 dígitos)');
      return;
    }
    setCreating(true);
    try {
      const customer = await CustomerApi.create(
        { name, document: doc, phone: newPhone.trim() || undefined },
        currentCompany.id,
      );
      onChange({
        id: customer.id,
        name: customer.name,
        documentDigits: customer.documentDigits,
        documentType: customer.documentType,
        documentFormatted: customer.documentFormatted,
      });
      setShowCreate(false);
      setNewName('');
      setNewDoc('');
      setNewPhone('');
      setQuery('');
      toast.success('Cliente cadastrado');
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
        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
          {label}
        </label>
        <p className="text-sm text-emerald-800 dark:text-emerald-200">
          Venda avulsa — sem dados de cliente. A busca/cadastro de clientes precisa de internet.
        </p>
      </div>
    );
  }

  if (value) {
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
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
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
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nome ou CPF/CNPJ"
          className="w-full pl-9 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>

      {results.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
          {results.slice(0, 8).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    id: c.id,
                    name: c.name,
                    documentDigits: c.documentDigits,
                    documentType: c.documentType,
                    documentFormatted: c.documentFormatted,
                  })
                }
                className="w-full text-left px-3 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
              >
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{c.name}</p>
                <p className="text-xs text-gray-500">
                  {c.documentType.toUpperCase()} {c.documentFormatted}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!showCreate ? (
        <button
          type="button"
          onClick={() => {
            setShowCreate(true);
            if (query && !onlyDigits(query)) setNewName(query);
            if (onlyDigits(query).length >= 11) setNewDoc(formatDocInput(query));
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-sm font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30"
        >
          <Plus className="w-4 h-4" />
          Cadastrar novo cliente
        </button>
      ) : (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3 space-y-2">
          <p className="text-xs font-bold text-gray-600 uppercase">Novo cliente</p>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome completo *"
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
            autoFocus
          />
          <input
            type="text"
            value={newDoc}
            onChange={(e) => setNewDoc(formatDocInput(e.target.value))}
            placeholder="CPF ou CNPJ *"
            inputMode="numeric"
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
          />
          <input
            type="text"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Telefone (opcional)"
            className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="flex-1 py-2 rounded-lg border border-gray-300 text-sm font-medium"
              disabled={creating}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
