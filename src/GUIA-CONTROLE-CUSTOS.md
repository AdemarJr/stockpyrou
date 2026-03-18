# 📊 Guia do Módulo de Controle de Custos - PyrouStock

## 🎯 Visão Geral

O módulo de Controle de Custos do PyrouStock permite gerenciar todas as despesas operacionais, criar orçamentos, definir metas e analisar a rentabilidade do negócio.

## 📋 Funcionalidades Principais

### 1. **Centros de Custo**
Organize suas despesas em categorias personalizadas:
- Operacional
- Estoque
- Marketing
- Administrativo
- Recursos Humanos
- Infraestrutura

**Como usar:**
1. Acesse "Custos" > Aba "Visão Geral"
2. Clique em "Novo Centro"
3. Preencha código, nome e descrição
4. Os centros podem ter hierarquia (centros pais/filhos)

### 2. **Despesas Operacionais**
Registre todas as despesas da empresa:

**Tipos de Despesa:**
- **Fixas**: Aluguel, salários, seguros
- **Variáveis**: Comissões, materiais de consumo
- **Semi-variáveis**: Energia, telefone

**Campos principais:**
- Centro de custo
- Tipo de despesa
- Valor
- Data de vencimento
- Número de referência (NF, recibo)
- Status de pagamento (Pendente, Pago, Atrasado, Cancelado)

**Fluxo:**
1. Acesse "Custos" > Aba "Despesas"
2. Clique em "Nova Despesa"
3. Selecione centro de custo e tipo
4. Informe valor e data de vencimento
5. Adicione descrição e número de referência
6. Salve a despesa
7. Marque como "Pago" quando efetuar o pagamento

### 3. **Orçamentos**
Planeje e controle seus gastos:

**Tipos de período:**
- Mensal
- Trimestral
- Anual

**Status:**
- Rascunho: Em elaboração
- Ativo: Em vigência
- Fechado: Período encerrado

**Como criar:**
1. Acesse "Custos" > Aba "Orçamentos"
2. Defina período e valor total
3. Aloque valores por centro de custo
4. Ative o orçamento
5. Sistema mostra % de utilização em tempo real

**Alertas automáticos:**
- 90%+ do orçamento → Alerta médio
- 100%+ do orçamento → Alerta crítico

### 4. **Análises e Dashboards**
Visualize seus custos com gráficos e métricas:

**Métricas principais:**
- Despesas do mês
- Pagamentos pendentes
- Pagamentos atrasados
- Utilização do orçamento

**Gráficos disponíveis:**
- Despesas por centro de custo (barras)
- Top 10 produtos por valor em estoque (pizza)
- Evolução do desperdício (linha)
- Análise de rentabilidade por produto

**Análises especiais:**
- CMV (Custo de Mercadoria Vendida)
- Ponto de equilíbrio (Break-even)
- Margem de lucro por produto
- Tendências de custo

### 5. **Metas de Custo**
Defina objetivos e acompanhe progresso:

**Tipos de meta:**
- Redução de desperdício
- Custo por produto
- Limite operacional
- Margem de lucro

**Configuração:**
- Valor alvo
- Período (diário, semanal, mensal, anual)
- Limite de alerta (%)
- Centro de custo ou produto específico

## 🔧 Configuração Inicial

### Passo 1: Inicializar Centros de Custo
1. Acesse "Custos"
2. Clique em "Inicializar Centros de Custo"
3. Sistema cria 6 centros padrão automaticamente

### Passo 2: Criar Tipos de Despesa
1. Crie tipos personalizados conforme seu negócio
2. Associe cada tipo a um centro de custo
3. Defina se é fixo, variável ou semi-variável

### Passo 3: Registrar Despesas
- Comece registrando despesas recorrentes (aluguel, salários)
- Configure recorrências para despesas mensais
- Adicione números de referência para rastreabilidade

### Passo 4: Criar Primeiro Orçamento
- Defina período (recomendado: começar com mensal)
- Estime gastos por centro de custo
- Ative o orçamento para monitoramento

## 📊 Estrutura do Banco de Dados

### Tabelas principais:
- `cost_centers` - Centros de custo
- `expense_types` - Tipos de despesa
- `operational_expenses` - Despesas registradas
- `budgets` - Orçamentos
- `budget_items` - Itens do orçamento (por centro)
- `cost_targets` - Metas de custo

### Views de análise:
- `v_cost_center_summary` - Resumo por centro
- `v_budget_analysis` - Análise de orçamentos
- `v_product_cost_analysis` - Rentabilidade de produtos
- `v_waste_analysis` - Análise de desperdício

### Funções SQL:
- `calculate_cmv()` - Calcula CMV do período
- `calculate_breakeven()` - Calcula ponto de equilíbrio
- `initialize_cost_centers()` - Cria centros padrão

## 🔄 Integrações

### Com Estoque:
- Custos de entrada automáticos
- Custo médio ponderado (CMP)
- Rastreamento de desperdício

### Com Vendas:
- CMV por venda
- Margem de lucro real
- Análise de rentabilidade

### Com Fornecedores:
- Vincule despesas a fornecedores
- Histórico de compras
- Análise de custos por fornecedor

## 📈 Boas Práticas

### Registro de Despesas:
1. ✅ Registre TODAS as despesas, inclusive pequenas
2. ✅ Use categorização consistente
3. ✅ Adicione números de referência (NF, recibos)
4. ✅ Marque pagamentos assim que efetuados
5. ✅ Revise despesas atrasadas semanalmente

### Orçamentos:
1. ✅ Base-se em histórico real
2. ✅ Inclua margem de segurança (10-15%)
3. ✅ Revise mensalmente
4. ✅ Ajuste conforme necessário
5. ✅ Compare orçado vs realizado

### Análises:
1. ✅ Analise tendências, não apenas valores absolutos
2. ✅ Compare períodos similares (mês a mês, ano a ano)
3. ✅ Identifique outliers e investigue
4. ✅ Use dashboards para decisões rápidas
5. ✅ Gere relatórios para reuniões gerenciais

## 🎯 KPIs Importantes

### Operacionais:
- **Despesas Mensais** - Total gasto no mês
- **Taxa de Desperdício** - % do estoque desperdiçado
- **Custo por Venda** - CMV médio

### Financeiros:
- **Margem de Lucro** - % de lucro sobre vendas
- **ROI** - Retorno sobre investimento
- **Ponto de Equilíbrio** - Vendas necessárias para cobrir custos

### De Controle:
- **Aderência ao Orçamento** - % utilizado do orçamento
- **Despesas em Atraso** - Valor de contas não pagas
- **Variação de Custos** - Comparação mês a mês

## 🚨 Alertas Automáticos

O sistema gera alertas automaticamente para:
- ⚠️ Orçamento utilizado acima de 90%
- 🔴 Orçamento excedido
- ⏰ Pagamentos próximos do vencimento
- ❗ Pagamentos atrasados
- 📊 Metas não atingidas

## 🔐 Permissões

Para acessar Controle de Custos:
- Usuário precisa ter permissão `canViewReports`
- Gerentes e Admins têm acesso completo
- Superadmin vê todos os custos de todas as empresas

## 📞 Suporte

Em caso de dúvidas:
1. Consulte este guia
2. Verifique a documentação da API
3. Entre em contato com suporte técnico

---

**Última atualização:** Março 2026  
**Versão do módulo:** 1.0.0
