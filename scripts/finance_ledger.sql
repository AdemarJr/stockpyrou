-- =============================================================================
-- Stockpyrou — Finance Ledger (financial_movements) + Views (DRE / Centro de Custo)
-- Rode no Supabase: SQL Editor → New query → colar → Run
--
-- Objetivo:
-- - Ter um "livro caixa" (realizado) e um "contas a pagar/receber" (previsto)
-- - Permitir relatórios: lucro (mês/ano), a pagar, a receber (fiado), pagos, despesas por centro de custo
--
-- Observação importante (modelo):
-- - Venda ≠ recebimento. Este script registra "entradas realizadas" somente para meios que entram no caixa
--   (money/pix) e registra "a receber" (fiado) como previsto, por vencimento.
-- - Cartão (credit/debit) pode entrar como previsto (repasse) se você quiser — deixei como TODO opcional.
-- =============================================================================

-- 1) Ledger principal
create table if not exists public.financial_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,

  -- Identificador da origem (ex.: "sale:<uuid>", "expense:<uuid>")
  source text not null,

  -- Direção do fluxo
  direction text not null check (direction in ('in','out')),

  -- Status do movimento
  -- realizado: já ocorreu no caixa/banco
  -- previsto: compromisso futuro (a pagar / a receber)
  status text not null check (status in ('realizado','previsto')),

  -- Competência (para lucro/DRE) e caixa (para fluxo)
  competency_date date not null,
  cash_date date null,
  due_date date null,

  amount numeric not null check (amount >= 0),

  -- Classificações
  cost_center_id uuid null references public.cost_centers(id) on delete set null,
  category text null, -- ex.: "venda", "despesa_operacional", "ajuste"

  -- Metadados
  description text null,
  payment_method text null, -- money/pix/credit/debit/fiado/boleto...
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_financial_movements_company_competency
  on public.financial_movements(company_id, competency_date);

create index if not exists idx_financial_movements_company_cash
  on public.financial_movements(company_id, cash_date)
  where cash_date is not null;

create index if not exists idx_financial_movements_company_due
  on public.financial_movements(company_id, due_date)
  where due_date is not null;

create index if not exists idx_financial_movements_company_center
  on public.financial_movements(company_id, cost_center_id)
  where cost_center_id is not null;

-- Idempotência forte (evita duplicidade por concorrência / reprocessamento):
-- 1 origem ("source") por empresa no ledger.
-- Se você já tiver duplicados, rode a limpeza abaixo antes do índice.
-- (Mantém o registro mais recente por company_id+source)
with d as (
  select
    id,
    row_number() over (
      partition by company_id, source
      order by updated_at desc, created_at desc, id desc
    ) as rn
  from public.financial_movements
)
delete from public.financial_movements fm
using d
where fm.id = d.id
  and d.rn > 1;

create unique index if not exists idx_financial_movements_company_source_unique
  on public.financial_movements(company_id, source);

comment on table public.financial_movements is
  'Ledger financeiro: entradas/saídas realizadas e previstas, com datas de competência/caixa/vencimento e centro de custo.';

-- 2) Views auxiliares para DRE (mês) e centro de custo

-- 2.1) Receita por mês (competência) a partir de sales
-- - money/pix entram como realizado na data da venda
-- - fiado entra como previsto na data de vencimento (payment_details.dueDate) ou D+30
create or replace view public.v_sales_revenue_month as
with s as (
  select
    company_id,
    (timestamp at time zone 'utc')::date as sale_date,
    (timestamp at time zone 'utc')::date as competency_date,
    coalesce(nullif(payment_method, ''), 'unknown') as payment_method,
    total::numeric as amount,
    payment_details
  from public.sales
)
select
  company_id,
  to_char(competency_date, 'YYYY-MM') as month,
  sum(case when payment_method in ('money','pix') then amount else 0 end) as revenue_realized,
  sum(case when payment_method = 'fiado' then amount else 0 end) as revenue_fiado_competency,
  sum(amount) as revenue_total_competency
from s
group by company_id, to_char(competency_date, 'YYYY-MM');

-- 2.2) CMV por mês: soma de stock_movements de venda
-- Observação: usa movement_date. Caso seus campos sejam diferentes, ajuste aqui.
create or replace view public.v_cogs_month as
select
  company_id,
  to_char((movement_date at time zone 'utc')::date, 'YYYY-MM') as month,
  coalesce(sum(
    case
      when total_value is not null then total_value::numeric
      else (coalesce(unit_cost,0)::numeric * coalesce(quantity,0)::numeric)
    end
  ), 0) as cogs
from public.stock_movements
where coalesce(type, movement_type) = 'venda'
group by company_id, to_char((movement_date at time zone 'utc')::date, 'YYYY-MM');

-- 2.3) Lucro bruto por mês (receita competência - CMV)
create or replace view public.v_gross_profit_month as
select
  coalesce(r.company_id, c.company_id) as company_id,
  coalesce(r.month, c.month) as month,
  coalesce(r.revenue_total_competency, 0) as revenue,
  coalesce(c.cogs, 0) as cogs,
  (coalesce(r.revenue_total_competency, 0) - coalesce(c.cogs, 0)) as gross_profit
from public.v_sales_revenue_month r
full join public.v_cogs_month c
  on c.company_id = r.company_id and c.month = r.month;

-- 2.4) Resumo de despesas por centro de custo (operational_expenses)
create or replace view public.v_cost_center_summary as
select
  cc.company_id,
  cc.id as cost_center_id,
  cc.name as cost_center_name,
  cc.code as cost_center_code,
  coalesce(sum(oe.amount::numeric), 0) as total_expenses,
  coalesce(sum(case when oe.payment_status = 'paid' then oe.amount::numeric else 0 end), 0) as total_spent,
  coalesce(sum(case when oe.payment_status = 'paid' then coalesce(oe.paid_amount, oe.amount)::numeric else 0 end), 0) as total_paid,
  coalesce(sum(case when oe.payment_status in ('pending','overdue') then (oe.amount::numeric - coalesce(oe.paid_amount, 0)::numeric) else 0 end), 0) as total_pending,
  coalesce(sum(case when oe.payment_status = 'overdue' then (oe.amount::numeric - coalesce(oe.paid_amount, 0)::numeric) else 0 end), 0) as total_overdue
from public.cost_centers cc
left join public.operational_expenses oe
  on oe.company_id = cc.company_id
 and oe.cost_center_id = cc.id
 and coalesce(oe.payment_status, '') <> 'cancelled'
where cc.is_active = true
group by cc.company_id, cc.id, cc.name, cc.code;

-- =============================================================================
-- 3) (Opcional) Backfill / sincronização do ledger a partir de vendas/despesas
-- - Mantém o ledger idempotente via "source".
-- - Você pode rodar periodicamente, ou chamar via function (backend).
-- =============================================================================

-- 3.1) Entradas realizadas (money/pix) por venda (competência = caixa = sale_date)
insert into public.financial_movements (
  company_id, source, direction, status, competency_date, cash_date, amount, category, description, payment_method
)
select
  s.company_id,
  'sale:' || s.id as source,
  'in' as direction,
  'realizado' as status,
  (s.timestamp at time zone 'utc')::date as competency_date,
  (s.timestamp at time zone 'utc')::date as cash_date,
  s.total::numeric as amount,
  'venda' as category,
  'Venda PDV' as description,
  s.payment_method as payment_method
from public.sales s
where s.payment_method in ('money','pix')
on conflict (company_id, source) do update
set
  direction = excluded.direction,
  status = 'realizado',
  competency_date = excluded.competency_date,
  cash_date = excluded.cash_date,
  due_date = null,
  amount = excluded.amount,
  category = excluded.category,
  description = excluded.description,
  payment_method = excluded.payment_method,
  updated_at = now();

-- 3.2) A receber (fiado): previsto no vencimento (payment_details->>dueDate) ou D+30
insert into public.financial_movements (
  company_id, source, direction, status, competency_date, due_date, amount, category, description, payment_method
)
select
  s.company_id,
  'sale:' || s.id as source,
  'in' as direction,
  'previsto' as status,
  (s.timestamp at time zone 'utc')::date as competency_date,
  coalesce(
    nullif((s.payment_details->>'dueDate')::date, null),
    ((s.timestamp at time zone 'utc')::date + 30)
  ) as due_date,
  s.total::numeric as amount,
  'venda' as category,
  'Venda fiado (a receber)' as description,
  'fiado' as payment_method
from public.sales s
where s.payment_method = 'fiado'
on conflict (company_id, source) do update
set
  direction = excluded.direction,
  -- Não deixa um movimento já realizado "voltar" para previsto por reprocessamento.
  status = case when public.financial_movements.status = 'realizado' then 'realizado' else 'previsto' end,
  competency_date = excluded.competency_date,
  due_date = case when public.financial_movements.status = 'realizado' then public.financial_movements.due_date else excluded.due_date end,
  cash_date = case when public.financial_movements.status = 'realizado' then public.financial_movements.cash_date else null end,
  amount = excluded.amount,
  category = excluded.category,
  description = excluded.description,
  payment_method = excluded.payment_method,
  updated_at = now();

-- 3.3) Saídas realizadas: despesas pagas (caixa = payment_date; competência = payment_date)
insert into public.financial_movements (
  company_id, source, direction, status, competency_date, cash_date, amount, cost_center_id, category, description, payment_method
)
select
  oe.company_id,
  'expense:' || oe.id as source,
  'out' as direction,
  'realizado' as status,
  oe.payment_date::date as competency_date,
  oe.payment_date::date as cash_date,
  coalesce(nullif(oe.paid_amount, 0), oe.amount)::numeric as amount,
  oe.cost_center_id,
  'despesa_operacional' as category,
  coalesce(oe.description, 'Despesa operacional') as description,
  oe.payment_method
from public.operational_expenses oe
where oe.payment_status = 'paid'
  and oe.payment_date is not null
on conflict (company_id, source) do update
set
  direction = excluded.direction,
  status = 'realizado',
  competency_date = excluded.competency_date,
  cash_date = excluded.cash_date,
  due_date = null,
  amount = excluded.amount,
  cost_center_id = excluded.cost_center_id,
  category = excluded.category,
  description = excluded.description,
  payment_method = excluded.payment_method,
  updated_at = now();

-- 3.4) Saídas previstas: despesas em aberto (competência = due_date; vencimento = due_date)
insert into public.financial_movements (
  company_id, source, direction, status, competency_date, due_date, amount, cost_center_id, category, description, payment_method
)
select
  oe.company_id,
  'expense:' || oe.id as source,
  'out' as direction,
  'previsto' as status,
  oe.due_date::date as competency_date,
  oe.due_date::date as due_date,
  greatest(0, (oe.amount::numeric - coalesce(oe.paid_amount, 0)::numeric)) as amount,
  oe.cost_center_id,
  'despesa_operacional' as category,
  coalesce(oe.description, 'Despesa operacional (a pagar)') as description,
  oe.payment_method
from public.operational_expenses oe
where oe.payment_status in ('pending','overdue')
  and oe.due_date is not null
  and greatest(0, (oe.amount::numeric - coalesce(oe.paid_amount, 0)::numeric)) > 0
on conflict (company_id, source) do update
set
  direction = excluded.direction,
  -- Não deixa um movimento já realizado "voltar" para previsto por reprocessamento.
  status = case when public.financial_movements.status = 'realizado' then 'realizado' else 'previsto' end,
  competency_date = case when public.financial_movements.status = 'realizado' then public.financial_movements.competency_date else excluded.competency_date end,
  due_date = case when public.financial_movements.status = 'realizado' then public.financial_movements.due_date else excluded.due_date end,
  cash_date = case when public.financial_movements.status = 'realizado' then public.financial_movements.cash_date else null end,
  amount = case when public.financial_movements.status = 'realizado' then public.financial_movements.amount else excluded.amount end,
  cost_center_id = excluded.cost_center_id,
  category = excluded.category,
  description = excluded.description,
  payment_method = excluded.payment_method,
  updated_at = now();

-- =============================================================================
-- Fim.
-- Se o PostgREST reclamar de cache, aguarde ~1 min e recarregue o app.
-- =============================================================================

