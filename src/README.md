# 🗄️ Atualização do Banco de Dados - PyrouStock

## 📋 O Que Este Script Faz

O arquivo `database-schema-complete.sql` garante que seu banco de dados Supabase possui todas as tabelas e colunas necessárias para o PyrouStock funcionar completamente.

**Segurança:**
- ✅ NÃO deleta nenhum dado existente
- ✅ NÃO modifica dados existentes
- ✅ Apenas ADICIONA o que está faltando
- ✅ Pode ser executado múltiplas vezes sem problemas (idempotente)

---

## 🚀 Como Executar

### 1. Acesse o Supabase
- Vá para: https://app.supabase.com
- Selecione seu projeto do PyrouStock
- Clique em **SQL Editor** (no menu lateral esquerdo)

### 2. Execute o Script
- Clique em **New Query**
- Copie TODO o conteúdo do arquivo `database-schema-complete.sql`
- Cole no editor
- Clique em **RUN** (botão verde no canto inferior direito)

### 3. Verifique
Você verá uma mensagem de sucesso e uma tabela mostrando todas as colunas da tabela `products`.

---

## 📊 Tabelas Atualizadas

O script atualiza/cria as seguintes tabelas:

### 1. **companies** (Empresas)
- Informações das empresas cadastradas
- Colunas: id, name, cnpj, email, status, created_at, updated_at

### 2. **products** (Produtos)
- Catálogo de produtos
- Colunas principais adicionadas:
  - `barcode` - Código de barras para scanner
  - `sale_price` - Preço de venda
  - `safety_stock` - Estoque de segurança
  - `image_url` - URL da foto do produto
  - `description` - Descrição (inclui validade em JSON)
  - `status` - Status ativo/inativo

### 3. **suppliers** (Fornecedores)
- Cadastro de fornecedores
- Colunas: id, company_id, name, contact, email, phone, rating, reliability

### 4. **stock_entries** (Entradas de Estoque)
- Registro de compras/entradas
- Colunas: id, company_id, product_id, supplier_id, quantity, unit_price, total_price, batch_number, expiration_date

### 5. **stock_movements** (Movimentações)
- Histórico de movimentações de estoque
- Tipos: entrada, saida, ajuste, desperdicio
- Colunas: id, company_id, product_id, type, quantity, reason, waste_reason, cost, date, user_id

### 6. **price_history** (Histórico de Preços)
- Histórico de preços de compra
- Colunas: id, company_id, product_id, supplier_id, price, quantity, date, invoice_number

### 7. **user_companies** (Usuários e Empresas)
- Relacionamento entre usuários e empresas
- Colunas: id, user_id, company_id, role

---

## 🔍 Colunas Críticas Adicionadas

### Tabela `products`:

| Coluna | Tipo | Descrição | Por Que é Importante |
|--------|------|-----------|---------------------|
| `barcode` | TEXT | Código de barras | Scanner QR/Barcode no PDV |
| `sale_price` | NUMERIC | Preço de venda | PDV e relatórios de margem |
| `safety_stock` | NUMERIC | Estoque de segurança | Alertas de reposição |
| `image_url` | TEXT | URL da foto | Interface visual do produto |
| `description` | TEXT | Descrição/validade | Gestão de produtos perecíveis |
| `status` | TEXT | ativo/inativo | Controle de produtos ativos |

---

## 🎯 Funcionalidades Liberadas

Após executar este script, você terá acesso completo a:

✅ **Cadastro de Produtos** com código de barras  
✅ **Scanner QR/Barcode** no PDV  
✅ **Módulo de Caixa/PDV** completo  
✅ **Gestão de Estoque** com segurança  
✅ **Histórico de Preços** e fornecedores  
✅ **Movimentações** completas de estoque  
✅ **Relatórios** com todas as informações  

---

## ⚙️ Índices Criados

Para otimizar o desempenho, o script cria os seguintes índices:

**Products:**
- idx_products_company_id
- idx_products_barcode
- idx_products_name
- idx_products_category
- idx_products_status

**Stock Movements:**
- idx_stock_movements_company_id
- idx_stock_movements_product_id
- idx_stock_movements_type
- idx_stock_movements_date

**E mais 10+ índices em outras tabelas**

---

## 🔧 Solução de Problemas

### Erro: "permission denied"
- Você precisa ser **admin** do projeto no Supabase
- Peça acesso ao proprietário do projeto

### Erro: "syntax error"
- Verifique se copiou TODO o conteúdo do arquivo
- Não cole apenas parte do script

### Erro: "relation already exists"
- Isso é normal! O script verifica antes de criar
- Continue a execução, ele vai apenas adicionar o que falta

---

## 📝 Notas Técnicas

### O Script Usa:

1. **DO $$ BEGIN ... END $$** - Blocos PL/pgSQL para lógica condicional
2. **IF NOT EXISTS** - Verifica antes de criar/adicionar
3. **CREATE INDEX IF NOT EXISTS** - Cria índices apenas se não existirem
4. **ALTER TABLE ADD COLUMN IF NOT EXISTS** - Adiciona colunas apenas se faltarem

### Compatibilidade:

- ✅ PostgreSQL 13+
- ✅ Supabase (todas as versões)
- ✅ Execução múltipla (pode rodar várias vezes)

---

## ✅ Checklist Pós-Execução

Após executar o script:

- [ ] Mensagem de sucesso apareceu
- [ ] Tabela com colunas do `products` foi exibida
- [ ] Voltar ao PyrouStock
- [ ] Recarregar a página (F5)
- [ ] Testar cadastro de produto
- [ ] Testar scanner de barcode
- [ ] Verificar se PDV está acessível

---

## 🎉 Pronto!

Seu banco de dados agora está 100% compatível com todas as funcionalidades do PyrouStock, incluindo:
- ✅ Cadastro completo de produtos
- ✅ Módulo de Caixa/PDV
- ✅ Scanner de código de barras
- ✅ Gestão de estoque
- ✅ Relatórios completos

**Nenhum dado foi perdido ou modificado!** 🛡️
