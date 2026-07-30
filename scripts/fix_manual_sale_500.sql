-- =============================================================================
-- Fix venda manual: client_request_id + deduct_stock_once
-- =============================================================================

-- 1) Idempotência de vendas
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS client_request_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_company_client_request_unique
  ON public.sales(company_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

-- 2) Idempotência de baixas
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS source text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stock_movements_company_source_unique
  ON public.stock_movements(company_id, source);

-- 3) Função atômica de baixa
CREATE OR REPLACE FUNCTION public.deduct_stock_once(
  p_company_id uuid,
  p_product_id uuid,
  p_qty numeric,
  p_source text,
  p_notes text DEFAULT NULL,
  p_movement_type text DEFAULT 'venda',
  p_movement_date timestamptz DEFAULT now()
)
RETURNS TABLE (
  applied boolean,
  movement_id uuid,
  new_stock numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cost numeric;
  v_prev numeric;
  v_new numeric;
  v_mid uuid;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'p_qty must be > 0';
  END IF;
  IF p_source IS NULL OR btrim(p_source) = '' THEN
    RAISE EXCEPTION 'p_source is required (idempotency key)';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtext('stockpyrou:deduct_stock_once:v2:' || p_company_id::text || ':' || p_source)
  );

  SELECT sm.id INTO v_mid
  FROM public.stock_movements sm
  WHERE sm.company_id = p_company_id
    AND sm.source = p_source
  LIMIT 1;

  SELECT p.current_stock::numeric,
         COALESCE(NULLIF(p.cost_price, 0)::numeric, NULLIF(p.average_cost, 0)::numeric, 0)
    INTO v_prev, v_cost
  FROM public.products p
  WHERE p.id = p_product_id AND p.company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found for company';
  END IF;

  IF v_mid IS NOT NULL THEN
    RETURN QUERY
      SELECT
        false AS applied,
        v_mid AS movement_id,
        v_prev AS new_stock;
    RETURN;
  END IF;

  v_new := v_prev - p_qty;

  INSERT INTO public.stock_movements (
    company_id,
    product_id,
    movement_type,
    quantity,
    unit_cost,
    total_value,
    notes,
    movement_date,
    type,
    source,
    created_at
  )
  VALUES (
    p_company_id,
    p_product_id,
    p_movement_type,
    p_qty,
    v_cost,
    v_cost * p_qty,
    p_notes,
    p_movement_date,
    p_movement_type,
    p_source,
    now()
  )
  RETURNING id INTO v_mid;

  UPDATE public.products
    SET current_stock = v_new,
        updated_at = now()
    WHERE id = p_product_id AND company_id = p_company_id;

  RETURN QUERY
    SELECT
      true AS applied,
      v_mid AS movement_id,
      v_new AS new_stock;
END;
$$;
