# 🎯 Guia Rápido: Baixa Automática de Estoque via ZIG

## 📌 Resumo
A integração ZIG **já está funcionando** e dá baixa automática no estoque quando você sincroniza as vendas do PDV.

---

## ✅ Como Usar a Baixa Automática

### **1. Cadastre Produtos com SKU Correto**

⚠️ **CRÍTICO:** O SKU/código de barras no PyrouStock deve ser **EXATAMENTE IGUAL** ao do PDV Zig.

```
✅ PDV Zig: "HAMB001" → PyrouStock: "HAMB001" (funciona)
❌ PDV Zig: "HAMB001" → PyrouStock: "hamb001" (NÃO funciona)
❌ PDV Zig: "HAMB001" → PyrouStock: "HAMBURGUER" (NÃO funciona)
```

**Como cadastrar:**
1. Dashboard → Produtos → Novo Produto
2. Preencha o campo **"SKU"** ou **"Código de Barras"** com o mesmo valor do PDV Zig
3. Salve o produto

---

### **2. Configure a Integração ZIG** (Se ainda não fez)

1. Dashboard → Vendas → Aba **"Zig"**
2. **ID da Rede:** `35c5259d-4d3a-4934-9dd2-78a057a3aa8f`
3. Clique em **"Listar Lojas"**
4. Selecione a loja desejada
5. Clique em **"Salvar"**
6. Aguarde o badge verde **"Conectado"** aparecer

---

### **3. Sincronize as Vendas**

**Opção A: Sincronização Manual**
1. Clique no botão **"Sincronizar Agora"** (botão azul índigo)
2. Aguarde o processamento
3. Resultado aparecerá: **"X vendas baixadas"**

**Opção B: Sincronização Automática**
1. Ative o toggle **"Auto-Sync"**
2. O sistema sincronizará a cada **5 minutos** automaticamente
3. ⚠️ **Atenção:** Funciona apenas enquanto a aba do navegador estiver aberta

---

## 🔄 O Que Acontece na Sincronização?

### **Produto SEM Receita (Produto Simples)**
```
Vendeu 3 Cervejas no PDV Zig
         ↓
Sistema busca "CERVEJA" no PyrouStock por SKU
         ↓
Baixa 3 unidades do estoque
         ↓
Cria movimento: "Venda ZIG - Ref: ZIG_12345"
```

### **Produto COM Receita (Produto Composto)**
```
Vendeu 2 Hambúrgueres no PDV Zig
         ↓
Sistema busca "HAMBURGUER" no PyrouStock
         ↓
Encontra receita com ingredientes:
  - 150g Carne Moída
  - 2 Pães
  - 1 Queijo
         ↓
Para quantidade 2, baixa automaticamente:
  - 300g Carne Moída
  - 4 Pães
  - 2 Queijos
         ↓
Cria 3 movimentos separados (um para cada ingrediente)
```

---

## 📊 Como Verificar se Funcionou

### **Verificar Movimentos de Estoque**
1. Dashboard → **Relatórios** → Aba **"Saídas"**
2. Filtre por **Hoje** ou **Últimos 7 dias**
3. Procure movimentos com motivo: **"Venda ZIG"**
4. Verifique a quantidade e o produto

### **Verificar Estoque Atualizado**
1. Dashboard → **Produtos**
2. Localize o produto vendido
3. Confira se o **Estoque Atual** diminuiu corretamente

---

## ⚠️ Problemas Comuns

### **"X itens sem SKU correspondente"**

**Causa:** Produtos vendidos no PDV não existem no PyrouStock com o mesmo SKU.

**Solução:**
1. Anote os SKUs que falharam
2. Cadastre os produtos no PyrouStock com o SKU correto
3. Sincronize novamente

---

### **"Estoque negativo após sincronização"**

**Causa:** Venda foi processada mas não havia estoque suficiente.

**Solução:**
1. Acesse Produtos
2. Faça ajuste de estoque manual
3. Configure **Estoque Mínimo** para evitar no futuro

---

### **"Nenhuma venda nova encontrada"**

**Causa:** Não houve vendas no PDV desde a última sincronização.

**Isso é normal!** Significa que está tudo sincronizado.

---

## 🎯 Checklist de Validação

Após sincronizar, verifique:

- [ ] Movimentos de estoque criados com motivo "Venda ZIG"
- [ ] Estoque dos produtos diminuiu corretamente
- [ ] Quantidade baixada bate com a venda do PDV
- [ ] Se produto tem receita, ingredientes foram baixados
- [ ] Nenhum erro apareceu durante a sincronização

---

## 📈 Dicas de Uso

✅ **Sincronize diariamente** (no mínimo)  
✅ **Ative Auto-Sync** para sincronização contínua  
✅ **Confira movimentos** semanalmente  
✅ **Mantenha SKUs padronizados** entre PDV e PyrouStock  
✅ **Configure estoque mínimo** para evitar rupturas  

---

## 🆘 Suporte

Se precisar de ajuda:
1. Verifique este guia primeiro
2. Confira os logs no console do navegador (F12)
3. Anote a mensagem de erro exata
4. Entre em contato com o suporte técnico

---

**Última atualização:** 07/03/2026  
**Sistema:** PyrouStock v2.1.3  
**Empresa:** FUEGO BAR E COZINHA
