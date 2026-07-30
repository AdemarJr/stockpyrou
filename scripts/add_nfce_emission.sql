-- =============================================================================
-- Stockpyrou — NFC-e emissão + campos fiscais produto + endereço cliente
-- Rode no Postgres EasyPanel (database stock-pyrou)
-- =============================================================================

-- Endereço do cliente (destinatário NFC-e / cupom)
DO $$
BEGIN
  ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS logradouro text NULL;
  ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS numero text NULL;
  ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS complemento text NULL;
  ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS bairro text NULL;
  ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS municipio text NULL;
  ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS codigo_municipio text NULL;
  ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS uf text NULL;
  ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS cep text NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'customers address cols: %', SQLERRM;
END $$;

-- Campos fiscais do produto
DO $$
BEGIN
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ncm text NULL;
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cest text NULL;
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cfop text NULL;
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS csosn text NULL;
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cst text NULL;
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS origem smallint NULL DEFAULT 0;
  ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unidade_tributavel text NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'products fiscal cols: %', SQLERRM;
END $$;

CREATE TABLE IF NOT EXISTS public.nfce (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sale_id uuid NULL REFERENCES public.sales(id) ON DELETE SET NULL,
  customer_id uuid NULL REFERENCES public.customers(id) ON DELETE SET NULL,

  chave_acesso text NULL,
  numero integer NOT NULL,
  serie integer NOT NULL DEFAULT 1,
  modelo text NOT NULL DEFAULT '65',
  ambiente text NOT NULL DEFAULT 'homologation',
  tipo_emissao smallint NOT NULL DEFAULT 1,

  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status = ANY (ARRAY[
      'DRAFT'::text, 'GENERATED'::text, 'SIGNED'::text, 'SENT'::text,
      'PROCESSING'::text, 'AUTHORIZED'::text, 'REJECTED'::text,
      'CANCEL_REQUESTED'::text, 'CANCELLED'::text, 'CONTINGENCY'::text,
      'PENDING_CONTINGENCY'::text, 'ERROR'::text
    ])),

  xml_original text NULL,
  xml_assinado text NULL,
  xml_autorizado text NULL,
  xml_resposta text NULL,
  qr_code_url text NULL,

  protocolo text NULL,
  recibo text NULL,
  codigo_status text NULL,
  motivo_status text NULL,

  data_emissao timestamptz NOT NULL DEFAULT now(),
  data_autorizacao timestamptz NULL,

  danfe_html text NULL,

  idempotency_key text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nfce_sale_authorized
  ON public.nfce (company_id, sale_id)
  WHERE sale_id IS NOT NULL AND status = 'AUTHORIZED';

CREATE UNIQUE INDEX IF NOT EXISTS uq_nfce_idempotency
  ON public.nfce (company_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_nfce_chave
  ON public.nfce (chave_acesso)
  WHERE chave_acesso IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_nfce_company_status
  ON public.nfce (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nfce_company_sale
  ON public.nfce (company_id, sale_id);

CREATE TABLE IF NOT EXISTS public.nfce_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nfce_id uuid NOT NULL REFERENCES public.nfce(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NULL,
  item_number integer NOT NULL,
  description text NOT NULL,
  ncm text NULL,
  cfop text NULL,
  csosn text NULL,
  cst text NULL,
  origem smallint NOT NULL DEFAULT 0,
  unidade text NOT NULL DEFAULT 'UN',
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  total numeric NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nfce_item_nfce ON public.nfce_item (nfce_id);

CREATE TABLE IF NOT EXISTS public.nfce_payment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nfce_id uuid NOT NULL REFERENCES public.nfce(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  t_pag text NOT NULL,
  v_pag numeric NOT NULL,
  description text NULL
);

CREATE TABLE IF NOT EXISTS public.nfce_event (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nfce_id uuid NOT NULL REFERENCES public.nfce(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo_evento text NOT NULL,
  sequencia integer NOT NULL DEFAULT 1,
  xml_evento text NULL,
  xml_retorno text NULL,
  protocolo text NULL,
  status text NOT NULL DEFAULT 'SENT',
  justification text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fiscal_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nfce_id uuid NULL REFERENCES public.nfce(id) ON DELETE SET NULL,
  operation text NOT NULL,
  request_xml text NULL,
  response_xml text NULL,
  http_status integer NULL,
  sefaz_status_code text NULL,
  sefaz_message text NULL,
  error_message text NULL,
  duration_ms integer NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_logs_company
  ON public.fiscal_logs (company_id, created_at DESC);

COMMENT ON TABLE public.nfce IS 'NFC-e modelo 65 — emissão SEFAZ-AM';
