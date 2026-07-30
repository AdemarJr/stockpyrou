-- =============================================================================
-- Integração financeira: source idempotente + views DRE + payment_method fiado
-- =============================================================================

-- 1) Coluna source (idempotência)
ALTER TABLE public.financial_movements
  ADD COLUMN IF NOT EXISTS source text;

-- Backfill source a partir de FKs existentes
UPDATE public.financial_movements
SET source = CASE
  WHEN sale_id IS NOT NULL THEN 'sale:' || sale_id::text
  WHEN operational_expense_id IS NOT NULL AND status = 'previsto' THEN 'expense:' || operational_expense_id::text
  WHEN operational_expense_id IS NOT NULL AND status = 'realizado' THEN 'expense_paid:' || operational_expense_id::text
  WHEN stock_entry_id IS NOT NULL THEN 'stock_entry:' || stock_entry_id::text
  ELSE 'legacy:' || id::text
END
WHERE source IS NULL;

-- Dedup por company_id+source (mantém o mais recente)
WITH d AS (
  SELECT id,
    row_number() OVER (
      PARTITION BY company_id, source
      ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC
    ) AS rn
  FROM public.financial_movements
  WHERE source IS NOT NULL
)
DELETE FROM public.financial_movements fm
USING d
WHERE fm.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_movements_company_source_unique
  ON public.financial_movements(company_id, source)
  WHERE source IS NOT NULL;

-- 2) Permitir fiado no payment_method
DO $$
BEGIN
  ALTER TABLE public.financial_movements DROP CONSTRAINT IF EXISTS financial_movements_payment_method_check;
  ALTER TABLE public.financial_movements
    ADD CONSTRAINT financial_movements_payment_method_check
    CHECK (
      payment_method IS NULL OR payment_method = ANY (ARRAY[
        'money'::text, 'pix'::text, 'credit'::text, 'debit'::text,
        'boleto'::text, 'bank_transfer'::text, 'transfer'::text, 'other'::text,
        'fiado'::text
      ])
    );
EXCEPTION WHEN others THEN
  RAISE NOTICE 'payment_method check: %', SQLERRM;
END $$;

-- 3) Views DRE
CREATE OR REPLACE VIEW public.v_sales_revenue_month AS
SELECT
  company_id,
  to_char(("timestamp" AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM') AS month,
  SUM(CASE WHEN payment_method IN ('money','pix','credit','debit','bank_transfer') THEN total::numeric ELSE 0 END) AS revenue_realized,
  SUM(CASE WHEN payment_method IN ('fiado','boleto') THEN total::numeric ELSE 0 END) AS revenue_fiado_competency,
  SUM(total::numeric) AS revenue_total_competency
FROM public.sales
GROUP BY company_id, to_char(("timestamp" AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM');

CREATE OR REPLACE VIEW public.v_cogs_month AS
SELECT
  company_id,
  to_char((COALESCE(movement_date, created_at) AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM') AS month,
  COALESCE(SUM(
    CASE
      WHEN total_value IS NOT NULL THEN total_value::numeric
      ELSE (COALESCE(unit_cost,0)::numeric * COALESCE(quantity,0)::numeric)
    END
  ), 0) AS cogs
FROM public.stock_movements
WHERE COALESCE(type, movement_type) = 'venda'
GROUP BY company_id, to_char((COALESCE(movement_date, created_at) AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM');

CREATE OR REPLACE VIEW public.v_gross_profit_month AS
SELECT
  COALESCE(r.company_id, c.company_id) AS company_id,
  COALESCE(r.month, c.month) AS month,
  COALESCE(r.revenue_total_competency, 0) AS revenue,
  COALESCE(c.cogs, 0) AS cogs,
  (COALESCE(r.revenue_total_competency, 0) - COALESCE(c.cogs, 0)) AS gross_profit
FROM public.v_sales_revenue_month r
FULL JOIN public.v_cogs_month c
  ON c.company_id = r.company_id AND c.month = r.month;

CREATE OR REPLACE VIEW public.v_cost_center_summary AS
SELECT
  cc.company_id,
  cc.id AS cost_center_id,
  cc.name AS cost_center_name,
  cc.code AS cost_center_code,
  COALESCE(SUM(oe.amount::numeric), 0) AS total_expenses,
  COALESCE(SUM(CASE WHEN oe.payment_status = 'paid' THEN oe.amount::numeric ELSE 0 END), 0) AS total_spent,
  COALESCE(SUM(CASE WHEN oe.payment_status = 'paid' THEN COALESCE(oe.paid_amount, oe.amount)::numeric ELSE 0 END), 0) AS total_paid,
  COALESCE(SUM(CASE WHEN oe.payment_status IN ('pending','overdue') THEN (oe.amount::numeric - COALESCE(oe.paid_amount, 0)::numeric) ELSE 0 END), 0) AS total_pending,
  COALESCE(SUM(CASE WHEN oe.payment_status = 'overdue' THEN (oe.amount::numeric - COALESCE(oe.paid_amount, 0)::numeric) ELSE 0 END), 0) AS total_overdue
FROM public.cost_centers cc
LEFT JOIN public.operational_expenses oe
  ON oe.company_id = cc.company_id
 AND oe.cost_center_id = cc.id
 AND COALESCE(oe.payment_status, '') <> 'cancelled'
WHERE cc.is_active = true
GROUP BY cc.company_id, cc.id, cc.name, cc.code;

-- Análises (fallback simples se não existirem)
CREATE OR REPLACE VIEW public.v_product_cost_analysis AS
SELECT
  p.company_id,
  p.id AS product_id,
  p.name AS product_name,
  p.category AS product_category,
  COALESCE(p.current_stock, 0)::numeric AS current_stock,
  COALESCE(p.cost_price, 0)::numeric AS unit_cost,
  (COALESCE(p.current_stock, 0)::numeric * COALESCE(p.cost_price, 0)::numeric) AS inventory_value,
  0::numeric AS total_sold_quantity,
  0::numeric AS total_sales_value
FROM public.products p;

CREATE OR REPLACE VIEW public.v_waste_analysis AS
SELECT
  sm.company_id,
  to_char((COALESCE(sm.movement_date, sm.created_at) AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-01')::date AS month,
  COUNT(*)::int AS waste_events,
  COALESCE(SUM(sm.quantity), 0)::numeric AS total_quantity_wasted,
  COALESCE(SUM(COALESCE(sm.total_value, sm.quantity * COALESCE(sm.unit_cost, 0))), 0)::numeric AS total_waste_cost,
  COALESCE(sm.waste_reason, sm.reason, 'outro') AS waste_reason,
  COALESCE(p.category, 'outro') AS product_category
FROM public.stock_movements sm
LEFT JOIN public.products p ON p.id = sm.product_id
WHERE COALESCE(sm.type, sm.movement_type) IN ('desperdicio', 'waste')
GROUP BY sm.company_id,
  to_char((COALESCE(sm.movement_date, sm.created_at) AT TIME ZONE 'America/Sao_Paulo')::date, 'YYYY-MM-01'),
  COALESCE(sm.waste_reason, sm.reason, 'outro'),
  COALESCE(p.category, 'outro');
