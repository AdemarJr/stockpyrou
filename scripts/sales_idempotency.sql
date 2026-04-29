-- =============================================================================
-- Stockpyrou — Idempotência para registro de vendas (public.sales)
--
-- Problema:
-- - Retry / duplo clique / instabilidade pode inserir a mesma venda mais de uma vez.
--
-- Solução:
-- - Coluna `client_request_id` (UUID gerado no client/servidor)
-- - Índice único (company_id, client_request_id) quando preenchido
-- =============================================================================

alter table public.sales
  add column if not exists client_request_id uuid;

create unique index if not exists idx_sales_company_client_request_unique
  on public.sales(company_id, client_request_id)
  where client_request_id is not null;

