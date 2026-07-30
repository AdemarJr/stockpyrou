-- =============================================================================
-- Stockpyrou — Módulo Fiscal NFC-e (Etapa 1: configuração)
-- Rode no Postgres EasyPanel (database stock-pyrou)
-- Ambiente: homologation | production | development (experimental SEFAZ-AM)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fiscal_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  cnpj text NOT NULL,
  ie text NOT NULL,
  razao_social text NOT NULL,
  nome_fantasia text NULL,

  logradouro text NOT NULL DEFAULT '',
  numero text NOT NULL DEFAULT '',
  complemento text NULL,
  bairro text NOT NULL DEFAULT '',
  municipio text NOT NULL DEFAULT '',
  codigo_municipio text NOT NULL DEFAULT '',
  uf text NOT NULL DEFAULT 'AM',
  cep text NOT NULL DEFAULT '',

  -- CRT: 1=Simples Nacional, 2=Simples excesso, 3=Regime Normal
  crt smallint NOT NULL DEFAULT 1
    CHECK (crt = ANY (ARRAY[1, 2, 3])),

  -- development = experimental SEFAZ-AM; homologation; production
  ambiente text NOT NULL DEFAULT 'homologation'
    CHECK (ambiente = ANY (ARRAY[
      'development'::text,
      'homologation'::text,
      'production'::text
    ])),

  serie_nfce integer NOT NULL DEFAULT 1 CHECK (serie_nfce > 0),
  numero_nfce integer NOT NULL DEFAULT 0 CHECK (numero_nfce >= 0),

  csc_id text NULL,
  -- CSC token criptografado (nunca texto puro)
  csc_token_encrypted text NULL,

  enabled boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_config_company
  ON public.fiscal_config (company_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_config_company
  ON public.fiscal_config (company_id);

COMMENT ON TABLE public.fiscal_config IS
  'Configuração fiscal NFC-e por empresa (SEFAZ-AM). CSC criptografado.';

CREATE TABLE IF NOT EXISTS public.fiscal_certificate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  -- Conteúdo A1 (.pfx/.p12) criptografado
  certificate_encrypted bytea NOT NULL,
  -- Senha do certificado criptografada
  password_encrypted text NOT NULL,

  subject_cn text NULL,
  serial_number text NULL,
  valid_from timestamptz NULL,
  valid_until timestamptz NULL,
  fingerprint_sha256 text NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_certificate_company
  ON public.fiscal_certificate (company_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_certificate_company
  ON public.fiscal_certificate (company_id);

COMMENT ON TABLE public.fiscal_certificate IS
  'Certificado digital A1 por empresa. Nunca exponha ao frontend.';

-- Preferência de emissão na venda (além de payment_details.emitNfce)
DO $$
BEGIN
  ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS emit_nfce boolean NOT NULL DEFAULT false;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sales.emit_nfce: %', SQLERRM;
END $$;

COMMENT ON COLUMN public.sales.emit_nfce IS
  'Se true, venda solicitou emissão de NFC-e após confirmação.';
