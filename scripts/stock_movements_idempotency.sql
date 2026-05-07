-- =============================================================================
-- Stockpyrou — Idempotência forte para "baixa" de estoque (evita duplicidade)
--
-- Problema:
-- - Duplo clique / retry / concorrência pode gerar baixa duplicada:
--   - Atualiza products.current_stock duas vezes
--   - Insere stock_movements duplicado
--
-- Solução:
-- - Coluna `source` em public.stock_movements (chave idempotente por origem)
-- - Índice único (company_id, source) recomendado (integridade extra)
-- - Função `public.deduct_stock_once(...)`:
--   - pg_advisory_xact_lock por empresa+source + verificação antes do insert
--   - Não usa ON CONFLICT (evita erro se UNIQUE não casar com o índice no banco)
-- =============================================================================

-- 1) Coluna source (idempotency key)
alter table public.stock_movements
  add column if not exists source text;

-- 2) Índice único por origem (recomendado)
create unique index if not exists idx_stock_movements_company_source_unique
  on public.stock_movements(company_id, source);

-- 3) Função atômica: baixa de estoque uma única vez por source
create or replace function public.deduct_stock_once(
  p_company_id uuid,
  p_product_id uuid,
  p_qty numeric,
  p_source text,
  p_notes text default null,
  p_movement_type text default 'venda',
  p_movement_date timestamptz default now()
)
returns table (
  applied boolean,
  movement_id uuid,
  new_stock numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cost numeric;
  v_prev numeric;
  v_new numeric;
  v_mid uuid;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'p_qty must be > 0';
  end if;
  if p_source is null or btrim(p_source) = '' then
    raise exception 'p_source is required (idempotency key)';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('stockpyrou:deduct_stock_once:v2:' || p_company_id::text || ':' || p_source)
  );

  select sm.id into v_mid
  from public.stock_movements sm
  where sm.company_id = p_company_id
    and sm.source = p_source
  limit 1;

  select p.current_stock::numeric, coalesce(p.cost_price::numeric, 0)
    into v_prev, v_cost
  from public.products p
  where p.id = p_product_id and p.company_id = p_company_id
  for update;

  if not found then
    raise exception 'Product not found for company';
  end if;

  if v_mid is not null then
    return query
      select
        false as applied,
        v_mid as movement_id,
        v_prev as new_stock;
    return;
  end if;

  v_new := v_prev - p_qty;

  insert into public.stock_movements (
    company_id,
    product_id,
    movement_type,
    quantity,
    unit_cost,
    total_value,
    notes,
    movement_date,
    type,
    source,
    created_at
  )
  values (
    p_company_id,
    p_product_id,
    p_movement_type,
    p_qty,
    v_cost,
    v_cost * p_qty,
    p_notes,
    p_movement_date,
    p_movement_type,
    p_source,
    now()
  )
  returning id into v_mid;

  update public.products
    set current_stock = v_new,
        updated_at = now()
    where id = p_product_id and company_id = p_company_id;

  return query
    select
      true as applied,
      v_mid as movement_id,
      v_new as new_stock;
end;
$$;

grant execute on function public.deduct_stock_once(uuid, uuid, numeric, text, text, text, timestamptz) to authenticated;
grant execute on function public.deduct_stock_once(uuid, uuid, numeric, text, text, text, timestamptz) to service_role;
