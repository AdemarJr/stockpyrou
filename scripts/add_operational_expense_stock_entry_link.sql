-- Liga uma despesa operacional a uma entrada de estoque (compra), para rastreio financeiro × estoque.
-- Execute no SQL Editor do Supabase.

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
