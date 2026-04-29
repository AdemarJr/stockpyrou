-- =============================================================================
-- Stockpyrou — Verificações de duplicidade (baixas)
-- Rode no Supabase SQL Editor após aplicar:
-- - scripts/stock_movements_idempotency.sql
-- - scripts/finance_ledger.sql (atualizado com índice único)
-- - scripts/sales_idempotency.sql
-- =============================================================================

-- 1) Duplicados por origem no ledger (deve retornar 0 linhas)
select company_id, source, count(*) as cnt
from public.financial_movements
group by company_id, source
having count(*) > 1;

-- 2) Duplicados por origem em stock_movements (somente quando source preenchido)
select company_id, source, count(*) as cnt
from public.stock_movements
where source is not null and btrim(source) <> ''
group by company_id, source
having count(*) > 1;

-- 3) Vendas duplicadas por idempotency key
select company_id, client_request_id, count(*) as cnt
from public.sales
where client_request_id is not null
group by company_id, client_request_id
having count(*) > 1;

-- 4) (Opcional) Top 50 últimas baixas de estoque com source (para auditoria)
select id, company_id, product_id, quantity, movement_date, source, notes
from public.stock_movements
where source is not null and btrim(source) <> ''
order by movement_date desc
limit 50;

