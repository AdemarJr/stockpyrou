-- =============================================================================
-- Stockpyrou — RLS policies for public.financial_movements
--
-- Problema que resolve:
-- "new row violates row-level security policy for table financial_movements"
--
-- Estratégia:
-- - Habilita RLS na tabela
-- - Permite acesso por tenant (company_id) com base no vínculo em public.user_companies
--   (user_id = auth.uid()).
--
-- Como aplicar:
-- - Supabase SQL Editor → New query → colar → Run
-- =============================================================================

-- 1) Garantir que RLS está ligado
alter table public.financial_movements enable row level security;

-- 2) Remover policies antigas (se existirem) para evitar conflito
do $$
begin
  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_movements'
      and policyname = 'financial_movements_select_by_company'
  ) then
    execute 'drop policy "financial_movements_select_by_company" on public.financial_movements';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_movements'
      and policyname = 'financial_movements_insert_by_company'
  ) then
    execute 'drop policy "financial_movements_insert_by_company" on public.financial_movements';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_movements'
      and policyname = 'financial_movements_update_by_company'
  ) then
    execute 'drop policy "financial_movements_update_by_company" on public.financial_movements';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_movements'
      and policyname = 'financial_movements_delete_by_company'
  ) then
    execute 'drop policy "financial_movements_delete_by_company" on public.financial_movements';
  end if;
end
$$;

-- 3) Policies tenant-aware via public.user_companies
create policy "financial_movements_select_by_company"
on public.financial_movements
for select
to authenticated
using (
  exists (
    select 1
    from public.user_companies uc
    where uc.user_id = auth.uid()
      and uc.company_id = financial_movements.company_id
  )
);

create policy "financial_movements_insert_by_company"
on public.financial_movements
for insert
to authenticated
with check (
  exists (
    select 1
    from public.user_companies uc
    where uc.user_id = auth.uid()
      and uc.company_id = financial_movements.company_id
  )
);

create policy "financial_movements_update_by_company"
on public.financial_movements
for update
to authenticated
using (
  exists (
    select 1
    from public.user_companies uc
    where uc.user_id = auth.uid()
      and uc.company_id = financial_movements.company_id
  )
)
with check (
  exists (
    select 1
    from public.user_companies uc
    where uc.user_id = auth.uid()
      and uc.company_id = financial_movements.company_id
  )
);

create policy "financial_movements_delete_by_company"
on public.financial_movements
for delete
to authenticated
using (
  exists (
    select 1
    from public.user_companies uc
    where uc.user_id = auth.uid()
      and uc.company_id = financial_movements.company_id
  )
);

-- 4) (Opcional) Verificação rápida
-- select * from pg_policies where schemaname='public' and tablename='financial_movements';

