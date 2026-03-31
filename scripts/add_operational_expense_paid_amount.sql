-- Valor já liquidado (acumulado). Saldo em aberto = amount - paid_amount.
-- Execute no SQL Editor do Supabase (ou psql) antes de usar pagamentos parciais no app.

ALTER TABLE public.operational_expenses
ADD COLUMN IF NOT EXISTS paid_amount numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.operational_expenses.paid_amount IS 'Total já pago (acumulado). Quando = amount, status pode ser paid.';

-- Despesas já marcadas como pagas: considerar quitadas integralmente.
UPDATE public.operational_expenses
SET paid_amount = amount
WHERE payment_status = 'paid'
  AND (paid_amount IS NULL OR paid_amount = 0);
