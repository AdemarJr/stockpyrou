import { publicAnonKey } from "./supabase/env";

/**
 * fetch com AbortSignal para não travar a UI se o Edge/ rede não responder.
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
  projectId: string,
  companyId: string
): Promise<{ status?: string } | null> {
  const url = `https://${projectId}.supabase.co/functions/v1/make-server-8a20b27d/companies/${companyId}/status`;
  const res = await fetchWithTimeout(url, {
    timeoutMs: 12000,
    headers: {
      Authorization: `Bearer ${publicAnonKey}`,
      apikey: publicAnonKey,
    },
  });
  if (!res?.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}
