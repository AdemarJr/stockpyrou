-- =============================================================================
-- Stockpyrou — Contato e logo do emitente (DANFE / cupom fiscal)
-- Rode no Postgres EasyPanel (database stock-pyrou)
-- =============================================================================

DO $$
BEGIN
  ALTER TABLE public.fiscal_config ADD COLUMN IF NOT EXISTS telefone text NULL;
  ALTER TABLE public.fiscal_config ADD COLUMN IF NOT EXISTS email text NULL;
  ALTER TABLE public.fiscal_config ADD COLUMN IF NOT EXISTS logo_url text NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'fiscal_config contact/logo cols: %', SQLERRM;
END $$;

COMMENT ON COLUMN public.fiscal_config.telefone IS 'Telefone/WhatsApp do emitente (impresso no DANFE)';
COMMENT ON COLUMN public.fiscal_config.email IS 'E-mail de contato do emitente (impresso no DANFE)';
COMMENT ON COLUMN public.fiscal_config.logo_url IS 'URL ou data-URI da logo (impressa no cabeçalho do DANFE)';
