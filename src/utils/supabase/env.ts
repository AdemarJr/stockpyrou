import { embeddedPublicAnonKey, projectId } from "./info";

export { projectId };

/** URL do projeto Supabase (Vite: defina `VITE_SUPABASE_URL` em `.env.local`). */
export const supabaseUrl =
  (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ||
  `https://${projectId}.supabase.co`;

/**
 * Chave para `createClient` do `@supabase/supabase-js`: publishable (`sb_publishable_…`) ou JWT anon.
 */
export const supabaseClientKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY as string | undefined)?.trim() ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  embeddedPublicAnonKey;

/**
 * JWT anon (`eyJ…`) para `Authorization` / `apikey` em **fetch** às Edge Functions.
 * O gateway **não** aceita a chave publishable `sb_publishable_…` nesses headers — por isso fica 401 se reutilizarmos a publishable.
 * Defina `VITE_SUPABASE_ANON_KEY` no `.env.local` ou caia no anon embutido em `info.tsx`.
 */
export const publicAnonKey =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ||
  embeddedPublicAnonKey;
