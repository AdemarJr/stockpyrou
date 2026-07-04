import { readLastCompanyId } from '../config/branding';
import { safeStorage } from '../utils/safeStorage';
import { getApiBaseUrl } from './apiConfig';

const CUSTOM_TOKEN_KEY = 'pyroustock_custom_token';

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function getAuthToken(): string | null {
  return safeStorage.getItem(CUSTOM_TOKEN_KEY);
}

function buildHeaders(companyId?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-Custom-Token'] = token;
  }

  const cid = companyId ?? readLastCompanyId();
  if (cid) {
    headers['X-Company-Id'] = cid;
  }

  return headers;
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { companyId?: string } = {},
): Promise<T> {
  const { companyId, ...init } = options;
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      ...buildHeaders(companyId),
      ...(init.headers as Record<string, string> | undefined),
    },
  });

  const body = await parseJsonSafe(res);

  if (!res.ok) {
    const errMsg =
      body && typeof body === 'object' && body !== null && 'error' in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new ApiClientError(errMsg, res.status, body);
  }

  return body as T;
}

export const apiClient = {
  get: <T>(path: string, companyId?: string) =>
    apiRequest<T>(path, { method: 'GET', companyId }),

  post: <T>(path: string, data: unknown, companyId?: string) =>
    apiRequest<T>(path, {
      method: 'POST',
      body: JSON.stringify(data),
      companyId,
    }),

  put: <T>(path: string, data: unknown, companyId?: string) =>
    apiRequest<T>(path, {
      method: 'PUT',
      body: JSON.stringify(data),
      companyId,
    }),

  patch: <T>(path: string, data: unknown, companyId?: string) =>
    apiRequest<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(data),
      companyId,
    }),

  delete: <T>(path: string, companyId?: string) =>
    apiRequest<T>(path, { method: 'DELETE', companyId }),
};
