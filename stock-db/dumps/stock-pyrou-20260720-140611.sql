--
-- PostgreSQL database dump
--

\restrict w7vipWWesXsBepKVpd6jblJ88GtfW3Q5hCy74aC5qnot2rKQRucDMIexTVgQNX7

-- Dumped from database version 17.10 (Debian 17.10-1.pgdg13+1)
-- Dumped by pg_dump version 17.10 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.zig_processed_transactions DROP CONSTRAINT IF EXISTS zig_processed_transactions_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.zig_configurations DROP CONSTRAINT IF EXISTS zig_configurations_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_companies DROP CONSTRAINT IF EXISTS user_companies_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.user_companies DROP CONSTRAINT IF EXISTS user_companies_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.suppliers DROP CONSTRAINT IF EXISTS suppliers_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_recipe_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stock_entries DROP CONSTRAINT IF EXISTS stock_entries_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stock_entries DROP CONSTRAINT IF EXISTS stock_entries_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.stock_entries DROP CONSTRAINT IF EXISTS stock_entries_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.sale_items DROP CONSTRAINT IF EXISTS sale_items_sale_id_fkey;
ALTER TABLE IF EXISTS ONLY public.sale_items DROP CONSTRAINT IF EXISTS sale_items_recipe_id_fkey;
ALTER TABLE IF EXISTS ONLY public.sale_items DROP CONSTRAINT IF EXISTS sale_items_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.sale_items DROP CONSTRAINT IF EXISTS sale_items_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.recipes DROP CONSTRAINT IF EXISTS recipes_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_recipe_id_fkey;
ALTER TABLE IF EXISTS ONLY public.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.price_history DROP CONSTRAINT IF EXISTS price_history_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.price_history DROP CONSTRAINT IF EXISTS price_history_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.price_history DROP CONSTRAINT IF EXISTS price_history_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.operational_expenses DROP CONSTRAINT IF EXISTS operational_expenses_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.operational_expenses DROP CONSTRAINT IF EXISTS operational_expenses_stock_entry_id_fkey;
ALTER TABLE IF EXISTS ONLY public.operational_expenses DROP CONSTRAINT IF EXISTS operational_expenses_expense_type_id_fkey;
ALTER TABLE IF EXISTS ONLY public.operational_expenses DROP CONSTRAINT IF EXISTS operational_expenses_cost_center_id_fkey;
ALTER TABLE IF EXISTS ONLY public.operational_expenses DROP CONSTRAINT IF EXISTS operational_expenses_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.operational_expense_payments DROP CONSTRAINT IF EXISTS operational_expense_payments_expense_id_fkey;
ALTER TABLE IF EXISTS ONLY public.operational_expense_payments DROP CONSTRAINT IF EXISTS operational_expense_payments_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.sales DROP CONSTRAINT IF EXISTS fk_sales_register;
ALTER TABLE IF EXISTS ONLY public.sales DROP CONSTRAINT IF EXISTS fk_sales_company;
ALTER TABLE IF EXISTS ONLY public.cash_registers DROP CONSTRAINT IF EXISTS fk_cash_registers_company;
ALTER TABLE IF EXISTS ONLY public.cash_movements DROP CONSTRAINT IF EXISTS fk_cash_movements_register;
ALTER TABLE IF EXISTS ONLY public.cash_movements DROP CONSTRAINT IF EXISTS fk_cash_movements_company;
ALTER TABLE IF EXISTS ONLY public.financial_movements DROP CONSTRAINT IF EXISTS financial_movements_supplier_id_fkey;
ALTER TABLE IF EXISTS ONLY public.financial_movements DROP CONSTRAINT IF EXISTS financial_movements_stock_entry_id_fkey;
ALTER TABLE IF EXISTS ONLY public.financial_movements DROP CONSTRAINT IF EXISTS financial_movements_sale_id_fkey;
ALTER TABLE IF EXISTS ONLY public.financial_movements DROP CONSTRAINT IF EXISTS financial_movements_operational_expense_id_fkey;
ALTER TABLE IF EXISTS ONLY public.financial_movements DROP CONSTRAINT IF EXISTS financial_movements_cost_center_id_fkey;
ALTER TABLE IF EXISTS ONLY public.financial_movements DROP CONSTRAINT IF EXISTS financial_movements_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.expense_types DROP CONSTRAINT IF EXISTS expense_types_cost_center_id_fkey;
ALTER TABLE IF EXISTS ONLY public.expense_types DROP CONSTRAINT IF EXISTS expense_types_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.cost_targets DROP CONSTRAINT IF EXISTS cost_targets_product_id_fkey;
ALTER TABLE IF EXISTS ONLY public.cost_targets DROP CONSTRAINT IF EXISTS cost_targets_cost_center_id_fkey;
ALTER TABLE IF EXISTS ONLY public.cost_targets DROP CONSTRAINT IF EXISTS cost_targets_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.cost_centers DROP CONSTRAINT IF EXISTS cost_centers_parent_id_fkey;
ALTER TABLE IF EXISTS ONLY public.cost_centers DROP CONSTRAINT IF EXISTS cost_centers_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.company_credentials DROP CONSTRAINT IF EXISTS company_credentials_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.budgets DROP CONSTRAINT IF EXISTS budgets_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.budget_items DROP CONSTRAINT IF EXISTS budget_items_expense_type_id_fkey;
ALTER TABLE IF EXISTS ONLY public.budget_items DROP CONSTRAINT IF EXISTS budget_items_cost_center_id_fkey;
ALTER TABLE IF EXISTS ONLY public.budget_items DROP CONSTRAINT IF EXISTS budget_items_budget_id_fkey;
ALTER TABLE IF EXISTS ONLY public.app_users DROP CONSTRAINT IF EXISTS app_users_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.alerts DROP CONSTRAINT IF EXISTS alerts_company_id_fkey;
ALTER TABLE IF EXISTS ONLY public.zig_processed_transactions DROP CONSTRAINT IF EXISTS zig_processed_transactions_pkey;
ALTER TABLE IF EXISTS ONLY public.zig_configurations DROP CONSTRAINT IF EXISTS zig_configurations_pkey;
ALTER TABLE IF EXISTS ONLY public.zig_configurations DROP CONSTRAINT IF EXISTS zig_configurations_company_id_key;
ALTER TABLE IF EXISTS ONLY public.user_companies DROP CONSTRAINT IF EXISTS user_companies_pkey;
ALTER TABLE IF EXISTS ONLY public.suppliers DROP CONSTRAINT IF EXISTS suppliers_pkey;
ALTER TABLE IF EXISTS ONLY public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_pkey;
ALTER TABLE IF EXISTS ONLY public.stock_entries DROP CONSTRAINT IF EXISTS stock_entries_pkey;
ALTER TABLE IF EXISTS ONLY public.sales DROP CONSTRAINT IF EXISTS sales_pkey;
ALTER TABLE IF EXISTS ONLY public.sale_items DROP CONSTRAINT IF EXISTS sale_items_pkey;
ALTER TABLE IF EXISTS ONLY public.recipes DROP CONSTRAINT IF EXISTS recipes_pkey;
ALTER TABLE IF EXISTS ONLY public.recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_pkey;
ALTER TABLE IF EXISTS ONLY public.products DROP CONSTRAINT IF EXISTS products_pkey;
ALTER TABLE IF EXISTS ONLY public.price_history DROP CONSTRAINT IF EXISTS price_history_pkey;
ALTER TABLE IF EXISTS ONLY public.operational_expenses DROP CONSTRAINT IF EXISTS operational_expenses_pkey;
ALTER TABLE IF EXISTS ONLY public.operational_expense_payments DROP CONSTRAINT IF EXISTS operational_expense_payments_pkey;
ALTER TABLE IF EXISTS ONLY public.kv_store_8a20b27d DROP CONSTRAINT IF EXISTS kv_store_8a20b27d_pkey;
ALTER TABLE IF EXISTS ONLY public.financial_movements DROP CONSTRAINT IF EXISTS financial_movements_pkey;
ALTER TABLE IF EXISTS ONLY public.expense_types DROP CONSTRAINT IF EXISTS expense_types_pkey;
ALTER TABLE IF EXISTS ONLY public.cost_targets DROP CONSTRAINT IF EXISTS cost_targets_pkey;
ALTER TABLE IF EXISTS ONLY public.cost_centers DROP CONSTRAINT IF EXISTS cost_centers_pkey;
ALTER TABLE IF EXISTS ONLY public.company_credentials DROP CONSTRAINT IF EXISTS company_credentials_pkey;
ALTER TABLE IF EXISTS ONLY public.company_credentials DROP CONSTRAINT IF EXISTS company_credentials_company_id_key;
ALTER TABLE IF EXISTS ONLY public.company_credentials DROP CONSTRAINT IF EXISTS company_credentials_admin_email_key;
ALTER TABLE IF EXISTS ONLY public.companies DROP CONSTRAINT IF EXISTS companies_pkey;
ALTER TABLE IF EXISTS ONLY public.cash_registers DROP CONSTRAINT IF EXISTS cash_registers_pkey;
ALTER TABLE IF EXISTS ONLY public.cash_movements DROP CONSTRAINT IF EXISTS cash_movements_pkey;
ALTER TABLE IF EXISTS ONLY public.budgets DROP CONSTRAINT IF EXISTS budgets_pkey;
ALTER TABLE IF EXISTS ONLY public.budget_items DROP CONSTRAINT IF EXISTS budget_items_pkey;
ALTER TABLE IF EXISTS ONLY public.app_users DROP CONSTRAINT IF EXISTS app_users_pkey;
ALTER TABLE IF EXISTS ONLY public.app_users DROP CONSTRAINT IF EXISTS app_users_email_key;
ALTER TABLE IF EXISTS ONLY public.alerts DROP CONSTRAINT IF EXISTS alerts_pkey;
DROP TABLE IF EXISTS public.zig_processed_transactions;
DROP TABLE IF EXISTS public.zig_configurations;
DROP TABLE IF EXISTS public.user_companies;
DROP TABLE IF EXISTS public.suppliers;
DROP TABLE IF EXISTS public.stock_movements;
DROP TABLE IF EXISTS public.stock_entries;
DROP TABLE IF EXISTS public.sales;
DROP TABLE IF EXISTS public.sale_items;
DROP TABLE IF EXISTS public.recipes;
DROP TABLE IF EXISTS public.recipe_ingredients;
DROP TABLE IF EXISTS public.products;
DROP TABLE IF EXISTS public.price_history;
DROP TABLE IF EXISTS public.operational_expenses;
DROP TABLE IF EXISTS public.operational_expense_payments;
DROP TABLE IF EXISTS public.kv_store_8a20b27d;
DROP TABLE IF EXISTS public.financial_movements;
DROP TABLE IF EXISTS public.expense_types;
DROP TABLE IF EXISTS public.cost_targets;
DROP TABLE IF EXISTS public.cost_centers;
DROP TABLE IF EXISTS public.company_credentials;
DROP TABLE IF EXISTS public.companies;
DROP TABLE IF EXISTS public.cash_registers;
DROP TABLE IF EXISTS public.cash_movements;
DROP TABLE IF EXISTS public.budgets;
DROP TABLE IF EXISTS public.budget_items;
DROP TABLE IF EXISTS public.app_users;
DROP TABLE IF EXISTS public.alerts;
DROP EXTENSION IF EXISTS pgcrypto;
--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    alert_type character varying NOT NULL,
    severity character varying NOT NULL,
    title character varying NOT NULL,
    message text NOT NULL,
    reference_id uuid,
    reference_type character varying,
    is_read boolean DEFAULT false,
    is_resolved boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    resolved_at timestamp with time zone,
    company_id uuid
);


--
-- Name: app_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    full_name text NOT NULL,
    role text DEFAULT 'user'::text NOT NULL,
    company_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    last_login timestamp with time zone,
    CONSTRAINT app_users_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'user'::text])))
);


--
-- Name: budget_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budget_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    budget_id uuid NOT NULL,
    cost_center_id uuid NOT NULL,
    expense_type_id uuid,
    allocated_amount numeric NOT NULL,
    spent_amount numeric DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT budget_items_allocated_amount_check CHECK ((allocated_amount >= (0)::numeric)),
    CONSTRAINT budget_items_spent_amount_check CHECK ((spent_amount >= (0)::numeric))
);


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    period_type text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    total_budget numeric NOT NULL,
    status text DEFAULT 'draft'::text,
    notes text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT budgets_period_type_check CHECK ((period_type = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text]))),
    CONSTRAINT budgets_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'closed'::text]))),
    CONSTRAINT budgets_total_budget_check CHECK ((total_budget >= (0)::numeric))
);


--
-- Name: cash_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    register_id uuid NOT NULL,
    type text NOT NULL,
    amount numeric NOT NULL,
    reason text,
    performed_by_id text NOT NULL,
    performed_by_name text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cash_movements_type_check CHECK ((type = ANY (ARRAY['withdrawal'::text, 'deposit'::text])))
);


--
-- Name: cash_registers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_registers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    cashier_id text NOT NULL,
    cashier_name text NOT NULL,
    initial_balance numeric DEFAULT 0 NOT NULL,
    current_balance numeric DEFAULT 0 NOT NULL,
    opened_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    status text DEFAULT 'open'::text NOT NULL,
    closing_notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cash_registers_status_check CHECK ((status = ANY (ARRAY['open'::text, 'closed'::text])))
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    cnpj text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    is_active boolean DEFAULT true,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    status text DEFAULT 'active'::text
);


--
-- Name: company_credentials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    admin_email text NOT NULL,
    admin_password_hash text NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);


--
-- Name: cost_centers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_centers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    code text NOT NULL,
    description text,
    parent_id uuid,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: cost_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_targets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    target_type text NOT NULL,
    cost_center_id uuid,
    product_id uuid,
    target_value numeric NOT NULL,
    current_value numeric DEFAULT 0,
    period_type text NOT NULL,
    start_date date NOT NULL,
    end_date date,
    alert_threshold numeric,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT cost_targets_alert_threshold_check CHECK (((alert_threshold >= (0)::numeric) AND (alert_threshold <= (100)::numeric))),
    CONSTRAINT cost_targets_period_type_check CHECK ((period_type = ANY (ARRAY['daily'::text, 'weekly'::text, 'monthly'::text, 'yearly'::text]))),
    CONSTRAINT cost_targets_target_type_check CHECK ((target_type = ANY (ARRAY['waste_reduction'::text, 'cost_per_product'::text, 'operational_limit'::text, 'profit_margin'::text])))
);


--
-- Name: expense_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    category text NOT NULL,
    cost_center_id uuid NOT NULL,
    is_recurring boolean DEFAULT false,
    recurrence_day integer,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT expense_types_category_check CHECK ((category = ANY (ARRAY['fixo'::text, 'variavel'::text, 'semi_variavel'::text]))),
    CONSTRAINT expense_types_recurrence_day_check CHECK (((recurrence_day >= 1) AND (recurrence_day <= 31)))
);


--
-- Name: financial_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financial_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    direction text NOT NULL,
    status text NOT NULL,
    cost_center_id uuid,
    category_code text,
    amount numeric NOT NULL,
    payment_method text,
    competency_date date NOT NULL,
    due_date date,
    cash_date date,
    description text,
    reference_number text,
    sale_id uuid,
    stock_entry_id uuid,
    operational_expense_id uuid,
    supplier_id uuid,
    created_by text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financial_movements_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT financial_movements_direction_check CHECK ((direction = ANY (ARRAY['in'::text, 'out'::text]))),
    CONSTRAINT financial_movements_payment_method_check CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY['money'::text, 'pix'::text, 'credit'::text, 'debit'::text, 'boleto'::text, 'bank_transfer'::text, 'transfer'::text, 'other'::text])))),
    CONSTRAINT financial_movements_status_check CHECK ((status = ANY (ARRAY['previsto'::text, 'realizado'::text, 'cancelado'::text])))
);


--
-- Name: kv_store_8a20b27d; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.kv_store_8a20b27d (
    key text NOT NULL,
    value jsonb NOT NULL
);


--
-- Name: operational_expense_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_expense_payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    expense_id uuid NOT NULL,
    amount numeric NOT NULL,
    payment_date date DEFAULT ((now() AT TIME ZONE 'utc'::text))::date NOT NULL,
    payment_method text,
    notes text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT operational_expense_payments_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: operational_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operational_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    expense_type_id uuid NOT NULL,
    cost_center_id uuid NOT NULL,
    amount numeric NOT NULL,
    description text,
    reference_number text,
    due_date date,
    payment_date date,
    payment_status text DEFAULT 'pending'::text,
    payment_method text,
    supplier_id uuid,
    user_id text NOT NULL,
    attachments jsonb,
    tags text[],
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    payment_terms_type text DEFAULT 'avista'::text,
    invoice_days integer,
    installment_count integer,
    paid_amount numeric DEFAULT 0 NOT NULL,
    stock_entry_id uuid,
    expense_group_id uuid,
    installment_index integer,
    installment_of integer,
    CONSTRAINT operational_expenses_amount_check CHECK ((amount >= (0)::numeric)),
    CONSTRAINT operational_expenses_installment_count_check CHECK (((installment_count IS NULL) OR (installment_count > 0))),
    CONSTRAINT operational_expenses_invoice_days_check CHECK (((invoice_days IS NULL) OR (invoice_days > 0))),
    CONSTRAINT operational_expenses_payment_method_check CHECK (((payment_method IS NULL) OR (payment_method = ANY (ARRAY['money'::text, 'pix'::text, 'credit'::text, 'debit'::text, 'bank_transfer'::text, 'boleto'::text])))),
    CONSTRAINT operational_expenses_payment_status_check CHECK ((payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'overdue'::text, 'cancelled'::text]))),
    CONSTRAINT operational_expenses_payment_terms_type_check CHECK (((payment_terms_type IS NULL) OR (payment_terms_type = ANY (ARRAY['avista'::text, 'faturado'::text, 'parcelado'::text]))))
);


--
-- Name: price_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.price_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    supplier_id uuid,
    price numeric NOT NULL,
    price_type character varying NOT NULL,
    change_percentage numeric,
    effective_date timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    company_id uuid,
    date timestamp with time zone DEFAULT now(),
    invoice_number text
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    category character varying,
    unit character varying NOT NULL,
    supplier_id uuid,
    min_stock numeric DEFAULT 0,
    current_stock numeric DEFAULT 0,
    cost_price numeric,
    sale_price numeric,
    description text,
    image_url text,
    status character varying DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    company_id uuid,
    barcode text,
    safety_stock numeric DEFAULT 0
);


--
-- Name: recipe_ingredients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipe_ingredients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipe_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity numeric NOT NULL,
    unit character varying NOT NULL,
    cost numeric DEFAULT 0,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    company_id uuid NOT NULL
);


--
-- Name: recipes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.recipes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    description text,
    category character varying,
    serving_size character varying,
    prep_time integer,
    total_cost numeric DEFAULT 0,
    sale_price numeric,
    profit_margin numeric,
    image_url text,
    instructions text,
    status character varying DEFAULT 'active'::character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    company_id uuid NOT NULL
);


--
-- Name: sale_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sale_id uuid NOT NULL,
    company_id uuid NOT NULL,
    product_id uuid,
    recipe_id uuid,
    quantity numeric NOT NULL,
    unit_price numeric NOT NULL,
    total_price numeric NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: sales; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sales (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    register_id uuid NOT NULL,
    cashier_id text NOT NULL,
    cashier_name text NOT NULL,
    total numeric NOT NULL,
    payment_method text NOT NULL,
    payment_details jsonb,
    items jsonb NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT sales_payment_method_check CHECK ((payment_method = ANY (ARRAY['money'::text, 'pix'::text, 'credit'::text, 'debit'::text])))
);


--
-- Name: stock_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    supplier_id uuid,
    quantity numeric NOT NULL,
    unit_cost numeric NOT NULL,
    total_cost numeric NOT NULL,
    batch_number character varying,
    expiry_date date,
    entry_date timestamp with time zone DEFAULT now(),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    company_id uuid,
    expiration_date timestamp with time zone,
    user_id text
);


--
-- Name: stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    movement_type character varying NOT NULL,
    quantity numeric NOT NULL,
    unit_cost numeric,
    total_value numeric,
    reference_id uuid,
    notes text,
    movement_date timestamp with time zone DEFAULT now(),
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    company_id uuid,
    sale_id uuid,
    recipe_id uuid,
    type text DEFAULT 'ajuste'::text,
    reason text,
    waste_reason text,
    cost numeric,
    batch_number text,
    date timestamp with time zone DEFAULT now(),
    user_id text,
    source text
);


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying NOT NULL,
    contact character varying,
    email character varying,
    phone character varying,
    rating numeric,
    reliability integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    company_id uuid,
    CONSTRAINT suppliers_rating_check CHECK (((rating >= (0)::numeric) AND (rating <= (5)::numeric))),
    CONSTRAINT suppliers_reliability_check CHECK (((reliability >= 0) AND (reliability <= 100)))
);


--
-- Name: user_companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    role text DEFAULT 'admin'::text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);


--
-- Name: zig_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zig_configurations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    store_id text NOT NULL,
    rede_id text,
    last_sync timestamp with time zone,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: zig_processed_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.zig_processed_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    transaction_id text NOT NULL,
    processed_at timestamp with time zone DEFAULT now()
);


--
-- Data for Name: alerts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.alerts (id, alert_type, severity, title, message, reference_id, reference_type, is_read, is_resolved, created_at, resolved_at, company_id) FROM stdin;
\.


--
-- Data for Name: app_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.app_users (id, email, password_hash, full_name, role, company_id, is_active, created_at, updated_at, last_login) FROM stdin;
\.


--
-- Data for Name: budget_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.budget_items (id, budget_id, cost_center_id, expense_type_id, allocated_amount, spent_amount, notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: budgets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.budgets (id, company_id, name, period_type, start_date, end_date, total_budget, status, notes, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cash_movements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cash_movements (id, company_id, register_id, type, amount, reason, performed_by_id, performed_by_name, "timestamp", created_at) FROM stdin;
\.


--
-- Data for Name: cash_registers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cash_registers (id, company_id, cashier_id, cashier_name, initial_balance, current_balance, opened_at, closed_at, status, closing_notes, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: companies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.companies (id, name, cnpj, created_at, is_active, updated_at, status) FROM stdin;
\.


--
-- Data for Name: company_credentials; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.company_credentials (id, company_id, admin_email, admin_password_hash, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cost_centers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cost_centers (id, company_id, name, code, description, parent_id, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cost_targets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cost_targets (id, company_id, target_type, cost_center_id, product_id, target_value, current_value, period_type, start_date, end_date, alert_threshold, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: expense_types; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expense_types (id, company_id, name, category, cost_center_id, is_recurring, recurrence_day, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: financial_movements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.financial_movements (id, company_id, direction, status, cost_center_id, category_code, amount, payment_method, competency_date, due_date, cash_date, description, reference_number, sale_id, stock_entry_id, operational_expense_id, supplier_id, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: kv_store_8a20b27d; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.kv_store_8a20b27d (key, value) FROM stdin;
\.


--
-- Data for Name: operational_expense_payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.operational_expense_payments (id, company_id, expense_id, amount, payment_date, payment_method, notes, created_by, created_at) FROM stdin;
\.


--
-- Data for Name: operational_expenses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.operational_expenses (id, company_id, expense_type_id, cost_center_id, amount, description, reference_number, due_date, payment_date, payment_status, payment_method, supplier_id, user_id, attachments, tags, notes, created_at, updated_at, payment_terms_type, invoice_days, installment_count, paid_amount, stock_entry_id, expense_group_id, installment_index, installment_of) FROM stdin;
\.


--
-- Data for Name: price_history; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.price_history (id, product_id, supplier_id, price, price_type, change_percentage, effective_date, created_at, company_id, date, invoice_number) FROM stdin;
\.


--
-- Data for Name: products; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.products (id, name, category, unit, supplier_id, min_stock, current_stock, cost_price, sale_price, description, image_url, status, created_at, updated_at, company_id, barcode, safety_stock) FROM stdin;
\.


--
-- Data for Name: recipe_ingredients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recipe_ingredients (id, recipe_id, product_id, quantity, unit, cost, notes, created_at, updated_at, company_id) FROM stdin;
\.


--
-- Data for Name: recipes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.recipes (id, name, description, category, serving_size, prep_time, total_cost, sale_price, profit_margin, image_url, instructions, status, created_at, updated_at, company_id) FROM stdin;
\.


--
-- Data for Name: sale_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sale_items (id, sale_id, company_id, product_id, recipe_id, quantity, unit_price, total_price, created_at) FROM stdin;
\.


--
-- Data for Name: sales; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sales (id, company_id, register_id, cashier_id, cashier_name, total, payment_method, payment_details, items, "timestamp", created_at) FROM stdin;
\.


--
-- Data for Name: stock_entries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_entries (id, product_id, supplier_id, quantity, unit_cost, total_cost, batch_number, expiry_date, entry_date, notes, created_at, updated_at, company_id, expiration_date, user_id) FROM stdin;
\.


--
-- Data for Name: stock_movements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.stock_movements (id, product_id, movement_type, quantity, unit_cost, total_value, reference_id, notes, movement_date, created_by, created_at, company_id, sale_id, recipe_id, type, reason, waste_reason, cost, batch_number, date, user_id, source) FROM stdin;
\.


--
-- Data for Name: suppliers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.suppliers (id, name, contact, email, phone, rating, reliability, created_at, updated_at, company_id) FROM stdin;
\.


--
-- Data for Name: user_companies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_companies (id, user_id, company_id, role, created_at) FROM stdin;
\.


--
-- Data for Name: zig_configurations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.zig_configurations (id, company_id, store_id, rede_id, last_sync, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: zig_processed_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.zig_processed_transactions (id, company_id, transaction_id, processed_at) FROM stdin;
\.


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: app_users app_users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_email_key UNIQUE (email);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);


--
-- Name: budget_items budget_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: cash_movements cash_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT cash_movements_pkey PRIMARY KEY (id);


--
-- Name: cash_registers cash_registers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT cash_registers_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_credentials company_credentials_admin_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_credentials
    ADD CONSTRAINT company_credentials_admin_email_key UNIQUE (admin_email);


--
-- Name: company_credentials company_credentials_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_credentials
    ADD CONSTRAINT company_credentials_company_id_key UNIQUE (company_id);


--
-- Name: company_credentials company_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_credentials
    ADD CONSTRAINT company_credentials_pkey PRIMARY KEY (id);


--
-- Name: cost_centers cost_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_pkey PRIMARY KEY (id);


--
-- Name: cost_targets cost_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_targets
    ADD CONSTRAINT cost_targets_pkey PRIMARY KEY (id);


--
-- Name: expense_types expense_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_types
    ADD CONSTRAINT expense_types_pkey PRIMARY KEY (id);


--
-- Name: financial_movements financial_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_movements
    ADD CONSTRAINT financial_movements_pkey PRIMARY KEY (id);


--
-- Name: kv_store_8a20b27d kv_store_8a20b27d_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.kv_store_8a20b27d
    ADD CONSTRAINT kv_store_8a20b27d_pkey PRIMARY KEY (key);


--
-- Name: operational_expense_payments operational_expense_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_expense_payments
    ADD CONSTRAINT operational_expense_payments_pkey PRIMARY KEY (id);


--
-- Name: operational_expenses operational_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_expenses
    ADD CONSTRAINT operational_expenses_pkey PRIMARY KEY (id);


--
-- Name: price_history price_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: recipe_ingredients recipe_ingredients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_pkey PRIMARY KEY (id);


--
-- Name: recipes recipes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_pkey PRIMARY KEY (id);


--
-- Name: sale_items sale_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_pkey PRIMARY KEY (id);


--
-- Name: sales sales_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);


--
-- Name: stock_entries stock_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT stock_entries_pkey PRIMARY KEY (id);


--
-- Name: stock_movements stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: user_companies user_companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_companies
    ADD CONSTRAINT user_companies_pkey PRIMARY KEY (id);


--
-- Name: zig_configurations zig_configurations_company_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zig_configurations
    ADD CONSTRAINT zig_configurations_company_id_key UNIQUE (company_id);


--
-- Name: zig_configurations zig_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zig_configurations
    ADD CONSTRAINT zig_configurations_pkey PRIMARY KEY (id);


--
-- Name: zig_processed_transactions zig_processed_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zig_processed_transactions
    ADD CONSTRAINT zig_processed_transactions_pkey PRIMARY KEY (id);


--
-- Name: alerts alerts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: app_users app_users_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: budget_items budget_items_budget_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.budgets(id);


--
-- Name: budget_items budget_items_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);


--
-- Name: budget_items budget_items_expense_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budget_items
    ADD CONSTRAINT budget_items_expense_type_id_fkey FOREIGN KEY (expense_type_id) REFERENCES public.expense_types(id);


--
-- Name: budgets budgets_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: company_credentials company_credentials_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_credentials
    ADD CONSTRAINT company_credentials_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: cost_centers cost_centers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: cost_centers cost_centers_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.cost_centers(id);


--
-- Name: cost_targets cost_targets_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_targets
    ADD CONSTRAINT cost_targets_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: cost_targets cost_targets_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_targets
    ADD CONSTRAINT cost_targets_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);


--
-- Name: cost_targets cost_targets_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_targets
    ADD CONSTRAINT cost_targets_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: expense_types expense_types_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_types
    ADD CONSTRAINT expense_types_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: expense_types expense_types_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_types
    ADD CONSTRAINT expense_types_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);


--
-- Name: financial_movements financial_movements_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_movements
    ADD CONSTRAINT financial_movements_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: financial_movements financial_movements_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_movements
    ADD CONSTRAINT financial_movements_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);


--
-- Name: financial_movements financial_movements_operational_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_movements
    ADD CONSTRAINT financial_movements_operational_expense_id_fkey FOREIGN KEY (operational_expense_id) REFERENCES public.operational_expenses(id);


--
-- Name: financial_movements financial_movements_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_movements
    ADD CONSTRAINT financial_movements_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- Name: financial_movements financial_movements_stock_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_movements
    ADD CONSTRAINT financial_movements_stock_entry_id_fkey FOREIGN KEY (stock_entry_id) REFERENCES public.stock_entries(id);


--
-- Name: financial_movements financial_movements_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financial_movements
    ADD CONSTRAINT financial_movements_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: cash_movements fk_cash_movements_company; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT fk_cash_movements_company FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: cash_movements fk_cash_movements_register; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_movements
    ADD CONSTRAINT fk_cash_movements_register FOREIGN KEY (register_id) REFERENCES public.cash_registers(id);


--
-- Name: cash_registers fk_cash_registers_company; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_registers
    ADD CONSTRAINT fk_cash_registers_company FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: sales fk_sales_company; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT fk_sales_company FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: sales fk_sales_register; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sales
    ADD CONSTRAINT fk_sales_register FOREIGN KEY (register_id) REFERENCES public.cash_registers(id);


--
-- Name: operational_expense_payments operational_expense_payments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_expense_payments
    ADD CONSTRAINT operational_expense_payments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: operational_expense_payments operational_expense_payments_expense_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_expense_payments
    ADD CONSTRAINT operational_expense_payments_expense_id_fkey FOREIGN KEY (expense_id) REFERENCES public.operational_expenses(id);


--
-- Name: operational_expenses operational_expenses_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_expenses
    ADD CONSTRAINT operational_expenses_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: operational_expenses operational_expenses_cost_center_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_expenses
    ADD CONSTRAINT operational_expenses_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);


--
-- Name: operational_expenses operational_expenses_expense_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_expenses
    ADD CONSTRAINT operational_expenses_expense_type_id_fkey FOREIGN KEY (expense_type_id) REFERENCES public.expense_types(id);


--
-- Name: operational_expenses operational_expenses_stock_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_expenses
    ADD CONSTRAINT operational_expenses_stock_entry_id_fkey FOREIGN KEY (stock_entry_id) REFERENCES public.stock_entries(id);


--
-- Name: operational_expenses operational_expenses_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operational_expenses
    ADD CONSTRAINT operational_expenses_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: price_history price_history_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: price_history price_history_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: price_history price_history_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.price_history
    ADD CONSTRAINT price_history_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: products products_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: products products_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: recipe_ingredients recipe_ingredients_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: recipe_ingredients recipe_ingredients_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: recipe_ingredients recipe_ingredients_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipe_ingredients
    ADD CONSTRAINT recipe_ingredients_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id);


--
-- Name: recipes recipes_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.recipes
    ADD CONSTRAINT recipes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: sale_items sale_items_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: sale_items sale_items_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: sale_items sale_items_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id);


--
-- Name: sale_items sale_items_sale_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_items
    ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id);


--
-- Name: stock_entries stock_entries_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT stock_entries_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: stock_entries stock_entries_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT stock_entries_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_entries stock_entries_supplier_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_entries
    ADD CONSTRAINT stock_entries_supplier_id_fkey FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: stock_movements stock_movements_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: stock_movements stock_movements_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: stock_movements stock_movements_recipe_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_movements
    ADD CONSTRAINT stock_movements_recipe_id_fkey FOREIGN KEY (recipe_id) REFERENCES public.recipes(id);


--
-- Name: suppliers suppliers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: user_companies user_companies_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_companies
    ADD CONSTRAINT user_companies_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: user_companies user_companies_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_companies
    ADD CONSTRAINT user_companies_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_users(id);


--
-- Name: zig_configurations zig_configurations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zig_configurations
    ADD CONSTRAINT zig_configurations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: zig_processed_transactions zig_processed_transactions_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.zig_processed_transactions
    ADD CONSTRAINT zig_processed_transactions_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- PostgreSQL database dump complete
--

\unrestrict w7vipWWesXsBepKVpd6jblJ88GtfW3Q5hCy74aC5qnot2rKQRucDMIexTVgQNX7

