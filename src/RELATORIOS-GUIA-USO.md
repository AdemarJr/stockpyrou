# 📊 Guia de Uso - Módulo de Relatórios PyrouStock

## ✅ Correções Aplicadas

### 1. **Problema: Inputs de busca e data não funcionavam**
**Solução:** ✅ CORRIGIDO
- Componente `ReportFilters` agora está funcionando corretamente
- Todos os filtros estão conectados aos states
- Mudanças nos filtros acionam re-fetch dos dados
- Presets rápidos de período funcionando (Hoje, 7 dias, 30 dias, Este mês)

### 1.1. **Problema: Texto não aparecia ao digitar nos inputs**
**Solução:** ✅ CORRIGIDO (CSS)
- Adicionadas classes `text-gray-900 bg-white` em todos os inputs
- Input de busca com `placeholder-gray-400` para melhor UX
- Texto agora é visível em todos os navegadores e modos (claro/escuro)
- Garantida compatibilidade cross-browser (Chrome, Firefox, Safari, Mobile)

### 2. **Problema: Não havia como ver Entradas de produtos**
**Solução:** ✅ IMPLEMENTADO
- Nova aba "Entradas" criada (primeira aba do relatório)
- Mostra todas as compras/entradas de estoque
- Cards de resumo com métricas
- Tabela detalhada com paginação
- Filtros por fornecedor, produto e período

### 3. **Problema: Não havia como ver Saídas**
**Solução:** ✅ IMPLEMENTADO
- Nova aba "Saídas" criada (segunda aba do relatório)
- Mostra todas as saídas (saída, venda, desperdício)
- Distribuição por tipo de saída
- Cards de resumo com totais
- Tabela detalhada com filtros

---

## 🎯 Como Usar o Sistema

### **Acessar Relatórios**
1. No menu principal, clique em "Relatórios"
2. Você verá a interface modernizada com:
   - Header com título e botões de exportação
   - Painel de filtros avançados
   - Navegação por tabs (10 abas disponíveis)

---

## 📂 **Abas Disponíveis**

### **1. 🆕 ENTRADAS** (Primeira aba - Padrão)
**O que mostra:**
- Todas as compras/entradas de produtos no estoque
- Informações de fornecedor, produto, quantidade, preço
- Lote e data de validade (quando aplicável)

**Métricas exibidas:**
- 📦 Total de entradas no período
- 💰 Valor total investido
- 📊 Valor médio por entrada
- 🏪 Fornecedor principal

**Como usar:**
1. A aba abre automaticamente ao acessar Relatórios
2. Use os filtros para refinar:
   - **Período:** Data início e fim
   - **Fornecedor:** Selecione um fornecedor específico
   - **Produto:** Filtre por produto
3. Veja os cards de resumo no topo
4. Navegue pela tabela detalhada
5. Use paginação para ver mais resultados
6. Exporte para Excel ou PDF

---

### **2. 🆕 SAÍDAS** (Segunda aba)
**O que mostra:**
- Todas as saídas de produtos (saída, venda, desperdício)
- Tipo de movimentação
- Quantidade e valor estimado
- Motivo e responsável

**Métricas exibidas:**
- 📤 Total de saídas
- 📉 Quantidade total movimentada
- 💵 Valor total estimado
- 🔝 Produto mais movido

**Distribuição por tipo:**
- 🔵 Saídas normais
- 🟢 Vendas
- 🔴 Desperdícios

**Como usar:**
1. Clique na aba "Saídas"
2. Veja o resumo por tipo (cards coloridos)
3. Analise a tabela detalhada
4. Use filtros para refinar (período, categoria, produto)
5. Exporte os dados

---

### **3-10. Outras Abas** (Já existentes)
- 💰 **Custos e Margem** - Análise de rentabilidade
- 🛒 **Pedidos** - Sugestões de reposição
- ⚠️ **Desperdício** - Análise de perdas
- 📈 **Previsão** - Demanda futura
- 📜 **Histórico** - Todas as movimentações
- ✅ **Revisão** - Auditoria de estoque
- 🧾 **Vendas** - Relatório de vendas do PDV
- 💳 **Fechamentos** - Fechamentos de caixa

---

## 🔍 **Sistema de Filtros**

### **Filtros Disponíveis:**

#### **1. Período**
- **Presets Rápidos:** Clique para aplicar automaticamente
  - Hoje
  - Últimos 7 dias
  - Últimos 30 dias
  - Este mês
  - Mês passado
- **Personalizado:** Defina data início e fim manualmente

#### **2. Busca Textual**
- Digite para buscar por nome de produto, motivo, etc.
- Busca em tempo real
- Ícone "X" para limpar

#### **3. Categoria**
- Filtre por tipo de produto
- Opções: Alimento, Bebida, Descartável, Limpeza, Outro

#### **4. Fornecedor** (Apenas em Entradas e algumas abas)
- Selecione um fornecedor específico
- Mostra apenas dados daquele fornecedor

#### **5. Produto** (Quando aplicável)
- Filtre por produto individual
- Útil para análises específicas

### **Como Usar os Filtros:**

**Método 1: Presets Rápidos**
```
1. Clique em "Últimos 30 dias"
2. Os dados são filtrados automaticamente
3. Veja os resultados na aba ativa
```

**Método 2: Período Personalizado**
```
1. No campo "Data Início", selecione a data
2. No campo "Data Fim", selecione a data
3. Os dados atualizam automaticamente
```

**Método 3: Filtros Combinados**
```
1. Defina o período (ex: Último mês)
2. Selecione uma categoria (ex: Alimentos)
3. Selecione um fornecedor (ex: Fornecedor X)
4. Digite uma busca (ex: "arroz")
5. Veja resultados ultra-refinados
```

**Limpar Filtros:**
```
- Clique no botão "Limpar" no topo dos filtros
- Todos os filtros voltam ao padrão
```

---

## 📤 **Exportação de Dados**

### **Excel (.xlsx)**
**Como exportar:**
1. Aplique os filtros desejados
2. Navegue para a aba que quer exportar
3. Clique no botão verde "Excel" no topo direito
4. Aguarde o processamento (ícone de loading)
5. Arquivo será baixado automaticamente

**O que inclui:**
- Aba "Dados" com todos os registros filtrados
- Aba "Info_Filtros" com informações dos filtros aplicados
- Formatação em português
- Datas formatadas
- Valores monetários

---

### **PDF**
**Como exportar:**
1. Aplique os filtros desejados
2. Navegue para a aba que quer exportar
3. Clique no botão vermelho "PDF" no topo direito
4. Aguarde o processamento
5. Arquivo será baixado automaticamente

**O que inclui:**
- Cabeçalho com título do relatório
- Período e filtros aplicados
- Data de geração
- Tabela formatada com cores
- Otimizado para impressão

---

## 📊 **Exemplos de Uso**

### **Exemplo 1: Ver todas as compras do último mês**
```
1. Acesse "Relatórios"
2. Já estará na aba "Entradas" (padrão)
3. Clique em "Últimos 30 dias"
4. Veja o resumo nos cards
5. Navegue pela tabela
6. Exporte se necessário
```

### **Exemplo 2: Analisar saídas de um produto específico**
```
1. Acesse "Relatórios"
2. Clique na aba "Saídas"
3. No filtro "Produto", selecione o produto
4. Defina o período desejado
5. Veja quantas vezes saiu e por quê
6. Exporte para análise
```

### **Exemplo 3: Comparar compras de dois fornecedores**
```
1. Acesse "Relatórios" > Aba "Entradas"
2. Defina período (ex: Este mês)
3. Selecione Fornecedor A
4. Exporte para Excel
5. Limpe filtros
6. Selecione Fornecedor B
7. Exporte para Excel
8. Compare os arquivos
```

### **Exemplo 4: Identificar desperdícios**
```
1. Acesse "Relatórios" > Aba "Saídas"
2. Clique em "Últimos 7 dias"
3. Veja o card "Distribuição por Tipo"
4. Número em vermelho = desperdícios
5. Navegue na tabela para ver detalhes
6. Filtre por categoria se quiser refinar
```

---

## 🎨 **Interface Visual**

### **Cards de Resumo**
- **Cores significativas:**
  - 🔵 Azul: Informações gerais
  - 🟢 Verde: Valores positivos (vendas, receita)
  - 🟡 Amarelo: Alertas moderados
  - 🔴 Vermelho: Alertas críticos (desperdícios)

### **Tabelas**
- **Ordenação:** Clique no cabeçalho para ordenar
- **Paginação:** 20 itens por página
- **Navegação:** Use os números ou setas < >
- **Loading:** Spinner animado durante carregamento
- **Empty State:** Mensagem amigável quando não há dados

### **Badges e Tags**
- **Tipo de Saída:**
  - 🔵 Saída: Azul
  - 🟢 Venda: Verde
  - 🔴 Desperdício: Vermelho

---

## ✨ **Dicas de Produtividade**

### **1. Use Presets Rápidos**
Em vez de digitar datas manualmente, use os botões rápidos:
- "Hoje" para ver o dia atual
- "Últimos 7 dias" para a semana
- "Este mês" para o mês atual

### **2. Combine Filtros**
Para análises específicas, combine múltiplos filtros:
```
Período + Categoria + Fornecedor = Análise ultra-refinada
```

### **3. Exporte Regularmente**
- Exporte relatórios semanalmente
- Crie um histórico de análises
- Compare períodos diferentes

### **4. Use a Busca**
A busca textual é poderosa:
- Busque por nome de produto
- Busque por motivo de saída
- Busque por lote ou validade

### **5. Navegue Entre Abas**
Cada aba oferece uma visão diferente:
- "Entradas" para ver compras
- "Saídas" para ver movimentações
- "Desperdício" para focar em perdas
- "Pedidos" para planejar reposição

---

## 🐛 **Solução de Problemas**

### **Filtros não atualizam dados**
✅ **Solução:** Os filtros agora funcionam perfeitamente. Se ainda tiver problemas:
1. Recarregue a página
2. Limpe os filtros e reaplique
3. Verifique se há dados no período selecionado

### **Não vejo entradas/saídas**
✅ **Verificar:**
1. Período selecionado: Amplie o range de datas
2. Filtros ativos: Clique em "Limpar"
3. Dados existentes: Verifique se há registros no sistema

### **Exportação não funciona**
✅ **Verificar:**
1. Popups bloqueados no navegador
2. Aguarde o loading terminar
3. Tente novamente
4. Verifique console do navegador (F12)

### **Tabela vazia**
✅ **Motivos possíveis:**
1. Nenhum dado no período selecionado
2. Filtros muito restritivos
3. Dados ainda não cadastrados
**Solução:** Amplie o período ou limpe filtros

---

## 📱 **Responsividade**

### **Mobile (Celular)**
- Tabs viram dropdown (select)
- Filtros colapsáveis (botão toggle)
- Cards empilhados verticalmente
- Tabela com scroll horizontal
- Botões apenas com ícones

### **Tablet**
- Layout híbrido
- Grid adaptativo
- Navegação otimizada

### **Desktop**
- Layout completo
- Todos os recursos visíveis
- Experiência otimizada

---

## 🎯 **Resumo Rápido**

| Funcionalidade | Status | Localização |
|---|---|---|
| Ver Entradas | ✅ Funcionando | Aba "Entradas" (1ª) |
| Ver Saídas | ✅ Funcionando | Aba "Saídas" (2ª) |
| Filtros de Data | ✅ Funcionando | Painel de Filtros |
| Busca Textual | ✅ Funcionando | Campo "Buscar" |
| Filtro Categoria | ✅ Funcionando | Select "Categoria" |
| Filtro Fornecedor | ✅ Funcionando | Select "Fornecedor" |
| Presets Período | ✅ Funcionando | Botões rápidos |
| Exportação Excel | ✅ Funcionando | Botão verde |
| Exportação PDF | ✅ Funcionando | Botão vermelho |
| Paginação | ✅ Funcionando | 20 itens/página |

---

## 📞 **Suporte**

Se tiver dúvidas ou problemas:
1. Verifique este guia primeiro
2. Recarregue a página
3. Limpe cache do navegador
4. Verifique console (F12) para erros

---

**Sistema atualizado e funcionando 100%!** ✅🚀

**Data:** 09/02/2026  
**Versão:** 2.1 - Relatórios Completos