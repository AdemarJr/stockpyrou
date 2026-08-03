-- =============================================================================
-- Stockpyrou — Homologação e Produção como ambientes de 1ª classe (SEFAZ)
-- Rode no Postgres EasyPanel (database stock-pyrou)
-- =============================================================================
-- - NSU DF-e separado por ambiente (evita misturar cursores ao trocar)
-- - nfe_inbound.ambiente para filtrar notas do ambiente ativo
-- =============================================================================

DO $$
BEGIN
  ALTER TABLE public.fiscal_config
    ADD COLUMN IF NOT EXISTS ult_nsu_dfe_homologation text NOT NULL DEFAULT '0';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'ult_nsu_dfe_homologation: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER TABLE public.fiscal_config
    ADD COLUMN IF NOT EXISTS ult_nsu_dfe_production text NOT NULL DEFAULT '0';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'ult_nsu_dfe_production: %', SQLERRM;
END $$;

-- Migra o NSU legado para o ambiente atual de cada empresa
DO $$
BEGIN
  UPDATE public.fiscal_config
  SET
    ult_nsu_dfe_homologation = CASE
      WHEN COALESCE(ambiente, 'homologation') <> 'production'
        THEN COALESCE(NULLIF(ult_nsu_dfe, ''), '0')
      ELSE ult_nsu_dfe_homologation
    END,
    ult_nsu_dfe_production = CASE
      WHEN COALESCE(ambiente, 'homologation') = 'production'
        THEN COALESCE(NULLIF(ult_nsu_dfe, ''), '0')
      ELSE ult_nsu_dfe_production
    END
  WHERE ult_nsu_dfe IS NOT NULL;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'migrate ult_nsu_dfe: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER TABLE public.nfe_inbound
    ADD COLUMN IF NOT EXISTS ambiente text NOT NULL DEFAULT 'homologation';
EXCEPTION WHEN others THEN
  RAISE NOTICE 'nfe_inbound.ambiente: %', SQLERRM;
END $$;

DO $$
BEGIN
  ALTER TABLE public.nfe_inbound
    DROP CONSTRAINT IF EXISTS nfe_inbound_ambiente_check;
  ALTER TABLE public.nfe_inbound
    ADD CONSTRAINT nfe_inbound_ambiente_check
    CHECK (ambiente = ANY (ARRAY['homologation'::text, 'production'::text]));
EXCEPTION WHEN others THEN
  RAISE NOTICE 'nfe_inbound_ambiente_check: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_nfe_inbound_company_ambiente_status
  ON public.nfe_inbound (company_id, ambiente, status, data_emissao DESC);

COMMENT ON COLUMN public.fiscal_config.ult_nsu_dfe_homologation IS
  'Último NSU DF-e no Ambiente Nacional de homologação';
COMMENT ON COLUMN public.fiscal_config.ult_nsu_dfe_production IS
  'Último NSU DF-e no Ambiente Nacional de produção';
COMMENT ON COLUMN public.nfe_inbound.ambiente IS
  'Ambiente SEFAZ em que a nota foi sincronizada (homologation|production)';
