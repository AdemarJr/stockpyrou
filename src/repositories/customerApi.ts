import { apiClient } from '../lib/apiClient';

export interface Customer {
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

interface CustomerDto {
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
    isActive: dto.isActive !== false,
  };
}

export class CustomerApi {
  static async search(q: string, companyId?: string): Promise<Customer[]> {
    const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
    const data = await apiClient.get<{ customers: CustomerDto[] }>(`/customers${qs}`, companyId);
    return (data.customers ?? []).map(mapDto);
  }

  static async create(
    input: {
      name: string;
      document: string;
      email?: string;
      phone?: string;
    },
    companyId?: string,
  ): Promise<Customer> {
    const data = await apiClient.post<{ customer: CustomerDto }>(
      '/customers',
      {
        name: input.name,
        document: input.document,
        email: input.email,
        phone: input.phone,
      },
      companyId,
    );
    return mapDto(data.customer);
  }
}
