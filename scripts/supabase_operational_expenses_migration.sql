-- =============================================================================
-- Stockpyrou — operational_expenses: colunas usadas por Custos / Despesas
-- Rode no Supabase: SQL Editor → New query → colar → Run
-- Seguro para rodar mais de uma vez (IF NOT EXISTS / DROP IF EXISTS onde aplicável)
-- =============================================================================

-- 1) Condição de pagamento (à vista, faturado, parcelado)
ALTER TABLE public.operational_expenses
  ADD COLUMN IF NOT EXISTS payment_terms_type text
    DEFAULT 'avista'
    CHECK (payment_terms_type IS NULL OR payment_terms_type IN ('avista', 'faturado', 'parcelado'));

ALTER TABLE public.operational_expenses
  ADD COLUMN IF NOT EXISTS invoice_days integer
    CHECK (invoice_days IS NULL OR invoice_days > 0);

ALTER TABLE public.operational_expenses
  ADD COLUMN IF NOT EXISTS installment_count integer
    CHECK (installment_count IS NULL OR installment_count > 0);

COMMENT ON COLUMN public.operational_expenses.payment_terms_type IS 'Condição: avista, faturado ou parcelado';
COMMENT ON COLUMN public.operational_expenses.invoice_days IS 'Prazo em dias quando faturado';
COMMENT ON COLUMN public.operational_expenses.installment_count IS 'Número de parcelas quando parcelado';

-- 2) Pagamento parcial (valor já liquidado acumulado)
ALTER TABLE public.operational_expenses
  ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.operational_expenses.paid_amount IS 'Total já pago (acumulado). Saldo = amount - paid_amount.';

UPDATE public.operational_expenses
SET paid_amount = amount
WHERE payment_status = 'paid'
  AND paid_amount = 0;

-- 3) Vínculo opcional com entrada de estoque (compra)
ALTER TABLE public.operational_expenses
  ADD COLUMN IF NOT EXISTS stock_entry_id uuid;

ALTER TABLE public.operational_expenses
  DROP CONSTRAINT IF EXISTS operational_expenses_stock_entry_id_fkey;

ALTER TABLE public.operational_expenses
  ADD CONSTRAINT operational_expenses_stock_entry_id_fkey
  FOREIGN KEY (stock_entry_id) REFERENCES public.stock_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_operational_expenses_stock_entry_id
  ON public.operational_expenses(stock_entry_id);

COMMENT ON COLUMN public.operational_expenses.stock_entry_id IS 'Opcional: entrada de estoque (compra) relacionada a esta despesa.';

-- =============================================================================
-- Fim. Se o PostgREST reclamar de cache, aguarde ~1 min ou recarregue o projeto.
-- =============================================================================
