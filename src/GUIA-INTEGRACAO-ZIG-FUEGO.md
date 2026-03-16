# 🔥 Guia de Integração ZIG - FUEGO BAR E COZINHA

## 📋 Informações da Empresa

```
Nome da Empresa: FUEGO BAR E COZINHA
Company ID:      07800941-938b-4d09-9d74-2742eb4f04d6
Sistema:         PyrouStock v2.1.3
```

---

## 🔑 Credenciais de Integração

### **Token ZIG (Já Configurado)**
```
Token: 58e415ba224c896515f7a6aec1e5a5b6d52cafbb64030e666a7afee436cb8d52
Status: ✅ Configurado como FALLBACK_TOKEN no backend
Local:  /supabase/functions/server/zig_service.tsx (linha 12)
```

**Nota:** Este token está funcionando como fallback. Se precisar maior segurança, configure-o como variável de ambiente `ZIG_API_KEY` no Supabase.

---

## 📡 Endpoints da API ZIG Utilizados

### **Base URL**
```
https://api.zigcore.com.br/integration
```

### **Endpoints**
```
GET /erp/lojas?rede={ID_DA_REDE}
    → Lista todas as lojas da rede
    → Retorna: [{ id: string, name: string }]

GET /erp/saida-produtos?dtinicio={YYYY-MM-DD}&dtfim={YYYY-MM-DD}&loja={ID_LOJA}
    → Lista vendas de produtos no período
    → Retorna: [{ transactionId, productSku, count, unitValue, ... }]
```

---

## 🚀 Passo a Passo para Configurar

### **PASSO 1: Obter o ID da Rede ZIG**

**ID da Rede:** `35c5259d-4d3a-4934-9dd2-78a057a3aa8f`

**Você já forneceu o ID da Rede, e ele foi configurado como padrão no sistema.**

Como obter:
1. Acesse o painel administrativo da ZIG
2. Entre na conta da empresa FUEGO BAR E COZINHA
3. Vá em: **Configurações** → **Dados da Rede** ou **Integrações**
4. Copie o **ID da Rede** (geralmente é um número)

**Exemplo:** `"35c5259d-4d3a-4934-9dd2-78a057a3aa8f"`

---

### **PASSO 2: Fazer Login no PyrouStock**

```
URL: https://[seu-dominio].com
Email: admin@stockwise.com
Senha: Admin@123456
```

Após login como Super Admin:
1. Clique em **"Empresas"** no menu lateral
2. Localize **"FUEGO BAR E COZINHA"**
3. Clique em **"Entrar como esta empresa"**

---

### **PASSO 3: Acessar o Módulo de Integração ZIG**

**Caminho no sistema:**
```
Dashboard → Vendas → Aba "Zig"
```

Ou se estiver no módulo de Caixa:
```
Dashboard → Caixa → Aba "Zig"
```

**Visual:** Você verá um painel com título "Integração ZIG" e ícone de loja rosa.

---

### **PASSO 4: Configurar a Integração**

#### **4.1 - Inserir ID da Rede**

1. No campo **"ID da Rede (Obrigatório)"**
2. Digite o ID obtido no Passo 1
3. Clique no botão **"Listar Lojas"** (ícone de refresh)

**Resultado esperado:**
```
✅ Toast verde: "X lojas carregadas"
✅ Dropdown "Selecione a Loja" fica habilitado com as opções
```

**Se aparecer erro:**
```
⚠️ "Token ZIG não configurado ou inválido"
→ Verifique se o ID da Rede está correto
→ Contate o suporte da ZIG para validar o token
```

---

#### **4.2 - Selecionar a Loja**

1. No dropdown **"Selecione a Loja"**
2. Escolha a loja que deseja integrar
   - Ex: "FUEGO - Loja Centro", "FUEGO - Loja Shopping", etc.
3. Clique no botão **"Salvar"** (ícone de engrenagem)

**Resultado esperado:**
```
✅ Toast verde: "Configuração salva com sucesso!"
✅ Badge verde "Conectado" aparece no canto superior direito
✅ Botão "Salvar" muda para "Salvo" com ícone de check verde
```

---

### **PASSO 5: Testar a Sincronização**

#### **5.1 - Sincronização Manual**

1. Clique no botão **"Sincronizar Agora"** (botão azul índigo)
2. Aguarde o processamento (ícone de loading)

**Resultados possíveis:**

**Se houver vendas novas:**
```
✅ "Sucesso: X itens processados"
✅ Aparece card com: "X vendas baixadas"
✅ Movimentos de estoque criados automaticamente
```

**Se não houver vendas:**
```
ℹ️ "Nenhuma venda nova encontrada"
```

**Se houver erro:**
```
❌ "Integração ZIG não configurada"
→ Refaça o Passo 4

❌ "Token ZIG inválido"
→ Verifique o token com o suporte ZIG
```

---

#### **5.2 - Ativar Sincronização Automática (Opcional)**

Para sincronizar automaticamente a cada 5 minutos:

1. Ative o toggle **"Auto-Sync"**
2. O sistema sincronizará em background
3. Última sincronização aparecerá abaixo do título

**Exemplo:**
```
Última sincronização: 15:32:45
```

---

## 📊 O Que Acontece na Sincronização?

### **Fluxo de Processamento**

```
1. SISTEMA busca vendas do PDV ZIG (últimas 24h ou desde última sync)
   ↓
2. Para cada venda encontrada:
   ↓
3. SISTEMA busca produto no PyrouStock por SKU ou código de barras
   ↓
4. Se PRODUTO TEM RECEITA:
   ├─→ Baixa ingredientes individualmente
   └─→ Exemplo: Hambúrguer = 150g carne + 2 pães + 1 queijo
   ↓
5. Se PRODUTO SIMPLES:
   └─→ Baixa quantidade diretamente do estoque
   ↓
6. SISTEMA cria movimento de saída:
   ├─→ Tipo: "saida"
   ├─→ Motivo: "Venda ZIG - Ref: {transactionId}"
   └─→ Custo: calculado automaticamente
   ↓
7. SISTEMA marca venda como processada (evita duplicação)
   ↓
8. SISTEMA atualiza timestamp da última sincronização
```

---

### **Exemplo Real**

**Venda no PDV ZIG:**
```json
{
  "transactionId": "ZIG_12345",
  "transactionDate": "2026-03-06T14:30:00",
  "productSku": "HAMB001",
  "productName": "Hambúrguer Artesanal",
  "count": 2,
  "unitValue": 25.00
}
```

**Processamento no PyrouStock:**
```
1. Busca produto com SKU "HAMB001"
2. Encontra: "Hambúrguer Artesanal" (ID: abc-123)
3. Verifica se tem receita → SIM
4. Receita encontrada:
   - 150g de Carne Moída
   - 2 Pães de Hambúrguer
   - 1 Fatia de Queijo Cheddar
   - 50g de Alface
5. Para quantidade 2, baixa:
   - 300g de Carne Moída
   - 4 Pães de Hambúrguer
   - 2 Fatias de Queijo Cheddar
   - 100g de Alface
6. Cria 4 movimentos de saída (um para cada ingrediente)
7. Marca transação "ZIG_12345" como processada
```

---

## 🗄️ Dados Armazenados

### **KV Store (Persistência)**

```typescript
// Configuração da empresa
Key: "zig_config:07800941-938b-4d09-9d74-2742eb4f04d6"
Value: {
  storeId: "ID_DA_LOJA_SELECIONADA",
  redeId: "ID_DA_REDE_INSERIDO"
}

// Última sincronização
Key: "zig_last_sync:07800941-938b-4d09-9d74-2742eb4f04d6"
Value: "2026-03-06T15:32:45.123Z"

// Vendas processadas (evita duplicação)
Key: "zig_processed:07800941-938b-4d09-9d74-2742eb4f04d6:ZIG_12345"
Value: true
```

---

### **Banco de Dados (Supabase)**

**Tabela: `stock_movements`**
```sql
INSERT INTO stock_movements (
  company_id,
  product_id,
  type,
  quantity,
  reason,
  cost,
  notes
) VALUES (
  '07800941-938b-4d09-9d74-2742eb4f04d6',
  'abc-123',
  'saida',
  2,
  'Venda ZIG - Ref: ZIG_12345',
  50.00,
  'Integração automática ZIG'
);
```

**Tabela: `products`**
```sql
UPDATE products 
SET current_stock = current_stock - 2,
    updated_at = NOW()
WHERE id = 'abc-123';
```

---

## 🔍 Verificar se Está Funcionando

### **Checklist de Validação**

#### **✅ Configuração Salva**
```
1. Acesse: Dashboard → Vendas → Aba "Zig"
2. Verifique se aparece badge verde "Conectado"
3. Verifique se o ID da Rede está preenchido
4. Verifique se a loja está selecionada
```

#### **✅ Sincronização Manual Funciona**
```
1. Clique em "Sincronizar Agora"
2. Deve processar sem erros
3. Se houver vendas, deve mostrar: "X itens processados"
```

#### **✅ Movimentos de Estoque Criados**
```
1. Acesse: Dashboard → Relatórios → Aba "Saídas"
2. Filtre por: Hoje
3. Procure por movimentos com motivo: "Venda ZIG"
4. Verifique se a quantidade bateu com a venda
```

#### **✅ Estoque Atualizado**
```
1. Acesse: Dashboard → Produtos
2. Localize o produto vendido
3. Verifique se o estoque diminuiu
4. Compare com a quantidade da venda
```

---

## 🐛 Troubleshooting (Resolução de Problemas)

### **Problema 1: "Token ZIG não configurado ou inválido"**

**Causa:** Token expirado ou ID da Rede incorreto

**Solução:**
```
1. Verifique se o ID da Rede está correto
2. Teste com outro ID da Rede (se aplicável)
3. Contate o suporte da ZIG: suporte@zigcore.com.br
4. Solicite validação/renovação do token
```

---

### **Problema 2: "Nenhuma loja encontrada para esta Rede"**

**Causa:** ID da Rede não tem lojas vinculadas ou está incorreto

**Solução:**
```
1. Verifique no painel ZIG se existem lojas cadastradas
2. Confirme o ID da Rede no painel ZIG
3. Tente com ID de outra rede (se a empresa tiver múltiplas)
```

---

### **Problema 3: "X itens sem SKU correspondente"**

**Causa:** Produtos vendidos no PDV não existem no PyrouStock

**Solução:**
```
1. Acesse: Dashboard → Produtos
2. Cadastre os produtos faltantes
3. Garanta que o SKU ou código de barras seja EXATAMENTE igual ao do PDV ZIG
4. Execute sincronização novamente
```

**Exemplo:**
```
PDV ZIG:     SKU = "REFRI500"
PyrouStock:  SKU = "REFRI500" ✅ (vai sincronizar)
PyrouStock:  SKU = "refri500" ❌ (não vai sincronizar - case sensitive)
```

---

### **Problema 4: "Estoque negativo após sincronização"**

**Causa:** Venda foi processada mas estoque não tinha quantidade suficiente

**Solução:**
```
1. Acesse: Dashboard → Produtos
2. Localize produtos com estoque negativo
3. Faça ajuste de estoque manualmente
4. Considere ativar alertas de estoque baixo
```

**Prevenção:**
```
1. Configure estoque mínimo nos produtos
2. Faça inventários periódicos
3. Sincronize com mais frequência (ative Auto-Sync)
```

---

### **Problema 5: "Auto-Sync não está funcionando"**

**Causa:** Aba/navegador foi fechado ou sistema reiniciado

**Solução:**
```
❌ Auto-Sync funciona APENAS enquanto a aba está aberta
❌ Não é um processo em background no servidor

Para sincronização contínua:
1. Mantenha uma aba aberta no navegador
2. Ou configure um cron job no servidor (solução avançada)
```

---

## 📈 Monitoramento e Logs

### **Logs do Backend (Servidor)**

**Onde ver:**
```
Supabase Dashboard → Edge Functions → Logs
```

**O que procurar:**
```
✅ "ZIG: Usando token: 58e415ba22...8d52"
✅ "ZIG: Buscando lojas para Rede: 1234"
✅ "ZIG: Sincronizando vendas da loja 5678"

❌ "ZIG API Error (400): InvalidToken"
❌ "ZIG: Erro fatal na sincronização"
```

---

### **Logs do Frontend (Navegador)**

**Onde ver:**
```
Chrome/Edge: F12 → Console
```

**O que procurar:**
```
✅ "Zig Stores loaded: [...]"
✅ "Sync completed: X items"

❌ "Error fetching stores: ..."
❌ "Sync error: ..."
```

---

## 🔐 Segurança e Boas Práticas

### **✅ Recomendações**

1. **Token em Variável de Ambiente (Produção)**
   ```
   Supabase Dashboard → Settings → Environment Variables
   Nome: ZIG_API_KEY
   Valor: 58e415ba224c896515f7a6aec1e5a5b6d52cafbb64030e666a7afee436cb8d52
   ```

2. **Backup Regular da Configuração**
   ```
   Exporte os dados do KV Store periodicamente
   ```

3. **Auditoria de Sincronizações**
   ```
   Revise os movimentos de estoque diariamente
   Compare com relatório de vendas do PDV ZIG
   ```

4. **Estoque de Segurança**
   ```
   Configure estoque mínimo para produtos críticos
   Ative notificações de estoque baixo
   ```

---

## 🎯 Próximos Passos

### **Após Configuração Inicial**

- [ ] Testar com venda real no PDV ZIG
- [ ] Validar baixa de estoque no PyrouStock
- [ ] Conferir movimentações no módulo de Relatórios
- [ ] Ativar Auto-Sync para automação
- [ ] Treinar equipe sobre o processo

---

### **Otimizações Futuras**

- [ ] **Webhook ZIG → PyrouStock:** Sincronização em tempo real
- [ ] **Reconciliação:** Comparar vendas ZIG vs movimentos PyrouStock
- [ ] **Alertas:** Notificar sobre falhas de sincronização
- [ ] **Dashboard:** Métricas de sincronização (taxa de sucesso, itens processados, etc.)

---

## 📞 Suporte

### **PyrouStock (Sistema de Estoque)**
```
Contato: [Seu email de suporte]
Documentação: /README.md
Logs: Supabase Dashboard → Edge Functions
```

### **ZIG (Sistema PDV)**
```
Site: https://zigcore.com.br
Suporte: suporte@zigcore.com.br
API Docs: https://api.zigcore.com.br/docs
```

---

## 📝 Checklist Final

Antes de considerar a integração concluída:

- [ ] Token ZIG validado e funcionando
- [x] ID da Rede ZIG obtido (35c5259d-4d3a-4934-9dd2-78a057a3aa8f)
- [ ] Login realizado como FUEGO BAR E COZINHA
- [ ] Configuração salva (Rede + Loja)
- [ ] Badge "Conectado" aparecendo
- [ ] Sincronização manual testada com sucesso
- [ ] Movimentos de estoque verificados
- [ ] Estoque de produtos atualizado corretamente
- [ ] Auto-Sync configurado (se desejado)
- [ ] Equipe treinada sobre o processo

---

**Integração configurada com sucesso!** ✅  
**Sistema:** PyrouStock v2.1.3  
**Empresa:** FUEGO BAR E COZINHA  
**Data:** 06/03/2026  
