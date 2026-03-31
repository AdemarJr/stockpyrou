/** Mensagem legível a partir de erro do Supabase/PostgREST ou qualquer throw. */
export function messageFromUnknownError(err: unknown): string {
  if (err == null) return 'Erro desconhecido';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.message === 'string' && o.message) parts.push(o.message);
    if (typeof o.details === 'string' && o.details) parts.push(o.details);
    if (typeof o.hint === 'string' && o.hint) parts.push(o.hint);
    if (parts.length) return parts.join(' — ');
  }
  try {
    return JSON.stringify(err);
  } catch {
    return 'Erro desconhecido';
  }
}
