-- Responsável técnico (software house) — NT 2018.005 / rejeição 972 (SEFAZ-AM)
ALTER TABLE public.fiscal_config
  ADD COLUMN IF NOT EXISTS resp_tec_cnpj text NULL,
  ADD COLUMN IF NOT EXISTS resp_tec_contato text NULL,
  ADD COLUMN IF NOT EXISTS resp_tec_email text NULL,
  ADD COLUMN IF NOT EXISTS resp_tec_fone text NULL,
  ADD COLUMN IF NOT EXISTS resp_tec_id_csrt text NULL,
  ADD COLUMN IF NOT EXISTS resp_tec_csrt_encrypted text NULL;

COMMENT ON COLUMN public.fiscal_config.resp_tec_cnpj IS
  'CNPJ do responsável técnico (software house), grupo infRespTec';
