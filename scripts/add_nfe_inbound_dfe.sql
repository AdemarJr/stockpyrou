-- =============================================================================
-- Stockpyrou — NF-e de entrada via SEFAZ (Distribuição DF-e)
-- Rode no Postgres EasyPanel (database stock-pyrou)
-- =============================================================================

DO $$
BEGIN
  ALTER TABLE public.fiscal_config
    ADD COLUMN IF NOT EXISTS ult_nsu_dfe text NOT NULL DEFAULT '0';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'fiscal_config.ult_nsu_dfe: %', SQLERRM;
END $$;

CREATE TABLE IF NOT EXISTS public.nfe_inbound (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  chave_acesso text NOT NULL,
  nsu text NULL,
  schema_type text NULL,
  numero integer NULL,
  serie integer NULL,
  modelo text NULL DEFAULT '55',
  emit_cnpj text NULL,
  emit_nome text NULL,
  dest_cnpj text NULL,
  data_emissao timestamptz NULL,
  valor_total numeric(14, 2) NULL DEFAULT 0,
  xml_resumo text NULL,
  xml_completo text NULL,
  items_json jsonb NULL,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status = ANY (ARRAY[
      'PENDING'::text,
      'READY'::text,
      'IMPORTED'::text,
      'IGNORED'::text,
      'ERROR'::text
    ])),
  manifest_status text NULL,
  error_message text NULL,
  imported_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_nfe_inbound_chave UNIQUE (company_id, chave_acesso)
);

CREATE INDEX IF NOT EXISTS idx_nfe_inbound_company_status
  ON public.nfe_inbound (company_id, status, data_emissao DESC);

CREATE INDEX IF NOT EXISTS idx_nfe_inbound_nsu
  ON public.nfe_inbound (company_id, nsu);

COMMENT ON TABLE public.nfe_inbound IS
  'NF-e destinadas à empresa (modelo 55) obtidas via NFeDistribuicaoDFe';
COMMENT ON COLUMN public.fiscal_config.ult_nsu_dfe IS
  'Último NSU consumido na distribuição DF-e (15 dígitos)';
