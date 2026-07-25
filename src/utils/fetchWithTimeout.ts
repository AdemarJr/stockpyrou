import { getBackendUrl } from '../lib/backendUrl';

/**
 * fetch com AbortSignal para não travar a UI se a API/ rede não responder.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response | null> {
  const { timeoutMs = 12000, ...rest } = init;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    return res;
  } catch {
    return null;
  } finally {
    clearTimeout(tid);
  }
}

export async function fetchCompanyStatusJson(
  companyId: string,
  token?: string | null
): Promise<{ status?: string } | null> {
  const url = getBackendUrl(`/companies/${companyId}/status`);
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    headers['X-Custom-Token'] = token;
  }
  const res = await fetchWithTimeout(url, {
    timeoutMs: 12000,
    headers,
  });
  if (!res?.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}
