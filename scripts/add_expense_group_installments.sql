-- Parcelas de uma mesma NF: mesmo expense_group_id; installment_index / installment_of para exibição.
-- Execute no SQL Editor do Supabase (projeto Stockpyrou).

ALTER TABLE public.operational_expenses
  ADD COLUMN IF NOT EXISTS expense_group_id uuid,
  ADD COLUMN IF NOT EXISTS installment_index integer,
  ADD COLUMN IF NOT EXISTS installment_of integer;

CREATE INDEX IF NOT EXISTS idx_operational_expenses_expense_group_id
  ON public.operational_expenses(company_id, expense_group_id)
  WHERE expense_group_id IS NOT NULL;

COMMENT ON COLUMN public.operational_expenses.expense_group_id IS 'UUID comum a todas as parcelas geradas de um mesmo lançamento.';
COMMENT ON COLUMN public.operational_expenses.installment_index IS 'Número da parcela (1..N).';
COMMENT ON COLUMN public.operational_expenses.installment_of IS 'Total de parcelas do grupo.';
