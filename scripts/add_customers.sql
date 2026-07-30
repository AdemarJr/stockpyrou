-- =============================================================================
-- Stockpyrou — Cadastro de Clientes
-- Rode no Postgres EasyPanel (database stock-pyrou)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  name text NOT NULL,
  -- document_digits: só números (11 CPF / 14 CNPJ)
  document_digits text NOT NULL,
  document_type text NOT NULL
    CHECK (document_type = ANY (ARRAY['cpf'::text, 'cnpj'::text])),

  email text NULL,
  phone text NULL,
  notes text NULL,
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_company_document
  ON public.customers (company_id, document_digits);

CREATE INDEX IF NOT EXISTS idx_customers_company_name
  ON public.customers (company_id, name);

CREATE INDEX IF NOT EXISTS idx_customers_company_active
  ON public.customers (company_id, is_active)
  WHERE is_active = true;

COMMENT ON TABLE public.customers IS
  'Clientes da empresa. Nome + CPF/CNPJ obrigatórios para fiado e documentos fiscais.';

-- Vínculo opcional na venda
DO $$
BEGIN
  ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS customer_id uuid NULL REFERENCES public.customers(id) ON DELETE SET NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sales.customer_id: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_sales_customer
  ON public.sales (company_id, customer_id)
  WHERE customer_id IS NOT NULL;

COMMENT ON COLUMN public.sales.customer_id IS
  'Cliente vinculado à venda (fiado / NFC-e / cupom).';
