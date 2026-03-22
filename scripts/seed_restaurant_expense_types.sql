-- Insere TODOS os tipos de despesa de restaurante em UM comando (sem inserir um a um).
--
-- Empresa fixa: 2d97925f-1828-4758-8d74-7c16b2335115
-- Centro de custo: primeiro centro ativo dessa empresa (ORDER BY code).
-- Se não inserir nada, crie centros de custo no app ou rode o seed de centros antes.

WITH ctx AS (
  SELECT
    '2d97925f-1828-4758-8d74-7c16b2335115'::uuid AS company_id,
    (
      SELECT cc.id
      FROM public.cost_centers cc
      WHERE cc.company_id = '2d97925f-1828-4758-8d74-7c16b2335115'::uuid
        AND cc.is_active IS NOT DISTINCT FROM true
      ORDER BY cc.code
      LIMIT 1
    ) AS cost_center_id
)
INSERT INTO public.expense_types (
  company_id,
  name,
  category,
  cost_center_id,
  is_recurring,
  recurrence_day,
  is_active
)
SELECT
  ctx.company_id,
  v.name,
  v.category,
  ctx.cost_center_id,
  v.is_recurring,
  CASE WHEN v.is_recurring THEN v.recurrence_day ELSE NULL END,
  true
FROM ctx
CROSS JOIN (
  VALUES
    -- Fixos
    ('Aluguel e IPTU'::text, 'fixo'::text, true, 5),
    ('Folha de pagamento e encargos sociais', 'fixo', true, 5),
    ('Contador e obrigações acessórias', 'fixo', true, 10),
    ('Internet e telefonia', 'fixo', true, 5),
    ('Software, PDV e assinaturas digitais', 'fixo', true, 5),
    ('Seguro patrimonial e RC profissional', 'fixo', true, 15),
    ('Royalties ou taxa de franquia', 'fixo', true, 10),
    ('Alvarás, licenças e taxas municipais', 'fixo', true, 12),
    ('Música ambiente (ECAD / direitos)', 'fixo', true, 10),
    ('Vale-transporte e benefícios obrigatórios', 'fixo', true, 5),
    -- Semi-variáveis
    ('Energia elétrica', 'semi_variavel', true, 10),
    ('Água e esgoto', 'semi_variavel', true, 8),
    ('Gás encanado ou GLP', 'semi_variavel', true, 8),
    ('Manutenção predial e elevadores', 'semi_variavel', false, NULL::int),
    ('Manutenção de equipamentos de cozinha e refrigeração', 'semi_variavel', false, NULL::int),
    ('Marketing e publicidade', 'semi_variavel', false, NULL::int),
    ('Treinamento e capacitação', 'semi_variavel', false, NULL::int),
    -- Variáveis
    ('Insumos e mercadorias (food cost)', 'variavel', false, NULL::int),
    ('Bebidas', 'variavel', false, NULL::int),
    ('Embalagens e descartáveis', 'variavel', false, NULL::int),
    ('Limpeza e higiene', 'variavel', false, NULL::int),
    ('Uniformes e EPIs', 'variavel', false, NULL::int),
    ('Desperdício e perdas operacionais', 'variavel', false, NULL::int),
    ('Taxas de cartão e adquirente', 'variavel', false, NULL::int),
    ('Taxas de delivery e marketplace', 'variavel', false, NULL::int),
    ('Comissões de atendimento e vendas', 'variavel', false, NULL::int),
    ('Combustível e pedágio (entregas)', 'variavel', false, NULL::int),
    ('Pequenos reparos e ferramentas', 'variavel', false, NULL::int)
) AS v(name, category, is_recurring, recurrence_day)
WHERE EXISTS (SELECT 1 FROM public.companies c WHERE c.id = ctx.company_id)
  AND ctx.cost_center_id IS NOT NULL;
