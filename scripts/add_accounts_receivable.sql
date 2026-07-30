-- =============================================================================
-- Stockpyrou — Contas a Receber
-- Rode no Postgres EasyPanel (database stock-pyrou)
-- =============================================================================

-- Permite fiado/boleto na tabela de vendas (além de money/pix/credit/debit)
DO $$
BEGIN
  ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_payment_method_check;
  ALTER TABLE public.sales
    ADD CONSTRAINT sales_payment_method_check
    CHECK (payment_method = ANY (ARRAY[
      'money'::text, 'pix'::text, 'credit'::text, 'debit'::text,
      'fiado'::text, 'boleto'::text, 'bank_transfer'::text
    ]));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sales_payment_method_check: %', SQLERRM;
END $$;

CREATE TABLE IF NOT EXISTS public.accounts_receivable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id uuid NULL REFERENCES public.sales(id) ON DELETE SET NULL,

  amount numeric NOT NULL CHECK (amount > 0),
  received_amount numeric NOT NULL DEFAULT 0 CHECK (received_amount >= 0),

  customer_name text NULL,
  description text NULL,
  reference_number text NULL,
  notes text NULL,

  due_date date NOT NULL,
  received_date date NULL,
  payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text])),
  payment_method text NULL,

  -- origem: sale_fiado | sale_boleto | manual | installment
  source text NOT NULL DEFAULT 'manual',

  receivable_group_id uuid NULL,
  installment_index int NULL,
  installment_of int NULL,

  user_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_accounts_receivable_sale
  ON public.accounts_receivable (sale_id)
  WHERE sale_id IS NOT NULL AND (installment_index IS NULL OR installment_index = 1);

CREATE INDEX IF NOT EXISTS idx_ar_company_due
  ON public.accounts_receivable (company_id, due_date DESC);

CREATE INDEX IF NOT EXISTS idx_ar_company_status
  ON public.accounts_receivable (company_id, payment_status);

COMMENT ON TABLE public.accounts_receivable IS
  'Títulos a receber (fiado/boleto/prazo). Vendas PDV criam linha automaticamente.';

CREATE TABLE IF NOT EXISTS public.accounts_receivable_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  receivable_id uuid NOT NULL REFERENCES public.accounts_receivable(id) ON DELETE CASCADE,

  amount numeric NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  payment_method text NULL,
  notes text NULL,
  register_id uuid NULL,

  created_by text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ar_payments_receivable
  ON public.accounts_receivable_payments (company_id, receivable_id, payment_date DESC);

COMMENT ON TABLE public.accounts_receivable_payments IS
  'Histórico de recebimentos (parciais ou total) de contas a receber.';

-- Backfill: vendas fiado/boleto sem título correspondente
INSERT INTO public.accounts_receivable (
  company_id, sale_id, amount, received_amount, customer_name, description,
  due_date, payment_status, source, user_id
)
SELECT
  s.company_id,
  s.id,
  s.total,
  0,
  NULLIF(TRIM(COALESCE(s.payment_details->>'customerName', '')), ''),
  'Venda PDV #' || LEFT(s.id::text, 8),
  COALESCE(
    NULLIF(TRIM(COALESCE(s.payment_details->>'dueDate', '')), '')::date,
    (s."timestamp" AT TIME ZONE 'America/Sao_Paulo')::date + 30
  ),
  'pending',
  CASE WHEN s.payment_method = 'boleto' THEN 'sale_boleto' ELSE 'sale_fiado' END,
  s.cashier_id
FROM public.sales s
WHERE s.payment_method IN ('fiado', 'boleto')
  AND NOT EXISTS (
    SELECT 1 FROM public.accounts_receivable ar WHERE ar.sale_id = s.id
  );

-- Marca overdue onde vencido
UPDATE public.accounts_receivable
SET payment_status = 'overdue', updated_at = now()
WHERE payment_status = 'pending'
  AND due_date < (now() AT TIME ZONE 'America/Sao_Paulo')::date;
