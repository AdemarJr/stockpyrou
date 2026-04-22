-- Verificações rápidas do Financeiro (ledger)
-- Rode no Supabase SQL Editor.

-- 1) Tabela existe?
select
  to_regclass('public.financial_movements') as financial_movements_table;

-- 2) Total de linhas e totais gerais
select
  count(*) as total_rows,
  coalesce(sum(case when direction='in' then amount else 0 end),0) as total_revenue,
  coalesce(sum(case when direction='out' then amount else 0 end),0) as total_expenses
from public.financial_movements;

-- 3) Totais por empresa (últimos 365 dias)
select
  company_id,
  coalesce(sum(case when direction='in' and status='realizado' then amount else 0 end),0) as in_realizado,
  coalesce(sum(case when direction='out' and status='realizado' then amount else 0 end),0) as out_realizado,
  coalesce(sum(case when direction='out' and status='previsto' then amount else 0 end),0) as out_previsto,
  count(*) as rows
from public.financial_movements
where competency_date >= (now() at time zone 'utc')::date - 365
group by company_id
order by in_realizado desc;

-- 4) Backfill: conferência de vendas (sales x ledger)
-- Ajuste período se necessário
with sales_ as (
  select company_id, count(*) as sales_rows, coalesce(sum(total),0) as sales_total
  from public.sales
  where (timestamp at time zone 'utc')::date between '2026-01-01' and '2026-04-22'
  group by company_id
),
ledger_ as (
  select company_id, count(*) as led_rows, coalesce(sum(amount),0) as led_total
  from public.financial_movements
  where direction='in' and status='realizado'
    and competency_date between '2026-01-01' and '2026-04-22'
  group by company_id
)
select
  coalesce(s.company_id, l.company_id) as company_id,
  coalesce(s.sales_rows,0) as sales_rows,
  coalesce(s.sales_total,0) as sales_total,
  coalesce(l.led_rows,0) as ledger_rows,
  coalesce(l.led_total,0) as ledger_total
from sales_ s
full join ledger_ l on l.company_id = s.company_id
order by sales_total desc;

