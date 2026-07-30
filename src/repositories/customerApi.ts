import { apiClient } from '../lib/apiClient';

export interface CustomerAddress {
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  codigoMunicipio?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export interface Customer extends CustomerAddress {
  id: string;
  companyId: string;
  name: string;
  documentDigits: string;
  documentType: 'cpf' | 'cnpj';
  documentFormatted: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  isActive: boolean;
}

export type CustomerInput = {
  name: string;
  document: string;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  isActive?: boolean;
} & CustomerAddress;

interface CustomerDto extends Customer {}

function mapDto(dto: CustomerDto): Customer {
  return {
    id: dto.id,
    companyId: dto.companyId,
    name: dto.name,
    documentDigits: dto.documentDigits,
    documentType: dto.documentType,
    documentFormatted: dto.documentFormatted,
    email: dto.email,
    phone: dto.phone,
    notes: dto.notes,
    logradouro: dto.logradouro,
    numero: dto.numero,
    complemento: dto.complemento,
    bairro: dto.bairro,
    municipio: dto.municipio,
    codigoMunicipio: dto.codigoMunicipio,
    uf: dto.uf,
    cep: dto.cep,
    isActive: dto.isActive !== false,
  };
}

export class CustomerApi {
  static async search(q: string, companyId?: string, opts?: { active?: boolean }): Promise<Customer[]> {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (opts?.active === false) params.set('active', 'false');
    const qs = params.toString() ? `?${params.toString()}` : '';
    const data = await apiClient.get<{ customers: CustomerDto[] }>(`/customers${qs}`, companyId);
    return (data.customers ?? []).map(mapDto);
  }

  static async get(id: string, companyId?: string): Promise<Customer> {
    const data = await apiClient.get<{ customer: CustomerDto }>(`/customers/${id}`, companyId);
    return mapDto(data.customer);
  }

  static async create(input: CustomerInput, companyId?: string): Promise<Customer> {
    const data = await apiClient.post<{ customer: CustomerDto }>(
      '/customers',
      {
        name: input.name,
        document: input.document,
        email: input.email,
        phone: input.phone,
        notes: input.notes,
        logradouro: input.logradouro,
        numero: input.numero,
        complemento: input.complemento,
        bairro: input.bairro,
        municipio: input.municipio,
        codigoMunicipio: input.codigoMunicipio,
        uf: input.uf,
        cep: input.cep,
      },
      companyId,
    );
    return mapDto(data.customer);
  }

  static async update(id: string, input: CustomerInput, companyId?: string): Promise<Customer> {
    const data = await apiClient.put<{ customer: CustomerDto }>(
      `/customers/${id}`,
      {
        name: input.name,
        document: input.document,
        email: input.email,
        phone: input.phone,
        notes: input.notes,
        isActive: input.isActive,
        logradouro: input.logradouro,
        numero: input.numero,
        complemento: input.complemento,
        bairro: input.bairro,
        municipio: input.municipio,
        codigoMunicipio: input.codigoMunicipio,
        uf: input.uf,
        cep: input.cep,
      },
      companyId,
    );
    return mapDto(data.customer);
  }

  static async remove(id: string, companyId?: string): Promise<void> {
    await apiClient.delete(`/customers/${id}`, companyId);
  }
}
