-- =============================================================================
-- Stockpyrou — NF-e de saída (modelo 55): numeração + flag na venda
-- Rode no Postgres EasyPanel (database stock-pyrou)
-- Reutiliza a tabela nfce com modelo='55' para persistência.
-- =============================================================================

DO $$
BEGIN
  ALTER TABLE public.fiscal_config
    ADD COLUMN IF NOT EXISTS serie_nfe integer NOT NULL DEFAULT 1
      CHECK (serie_nfe > 0);
  ALTER TABLE public.fiscal_config
    ADD COLUMN IF NOT EXISTS numero_nfe integer NOT NULL DEFAULT 0
      CHECK (numero_nfe >= 0);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'fiscal_config serie/numero_nfe: %', SQLERRM;
END $$;

COMMENT ON COLUMN public.fiscal_config.serie_nfe IS 'Série da NF-e modelo 55';
COMMENT ON COLUMN public.fiscal_config.numero_nfe IS 'Último número NF-e reservado (próximo = +1)';

DO $$
BEGIN
  ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS emit_nfe boolean NOT NULL DEFAULT false;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'sales.emit_nfe: %', SQLERRM;
END $$;

COMMENT ON COLUMN public.sales.emit_nfe IS
  'Venda marcada para emitir NF-e (modelo 55) após o checkout';

-- Uma nota autorizada (NFC-e ou NF-e) por venda continua válida pela uq_nfce_sale_authorized
CREATE INDEX IF NOT EXISTS idx_nfce_modelo
  ON public.nfce (company_id, modelo, status);
