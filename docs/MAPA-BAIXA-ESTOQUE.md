# Mapa: baixa de estoque × Relatório Saídas

Referência para suporte e operação: o que **baixa** `products.current_stock` e como aparece em **Relatórios → Saídas**.

---

## Regra de ouro (baixa alinhada ao produto)

Todas as baixas listadas abaixo usam a RPC **`deduct_stock_once`** (ou balanço com ajuste absoluto), que na **mesma transação** no banco:

1. Reduz `products.current_stock` pela quantidade informada  
2. Insere a linha em `stock_movements` com a **mesma quantidade**

Assim, o **Estoque atual** na lista de produtos e a linha no **Relatório → Saídas** sempre batem.

Implementação no app: [`StockRepository.deductStockOnce`](src/repositories/StockRepository.ts) — usada por baixa manual, PDV manual, PDV Caixa e (no servidor) ZIG.

**Pré-requisito:** função `deduct_stock_once` no Postgres EasyPanel (`stock-pyrou`) — ver `scripts/fix_manual_sale_500.sql`.

---

## Resposta rápida

**Sim.** Quase tudo que aparece em **Relatórios → Saídas** é uma linha em `stock_movements` que **deveria ter reduzido** o estoque do produto (`products.current_stock`).

| Tipo no relatório | Baixa estoque? | Origem típica |
|-------------------|----------------|---------------|
| **Venda** | Sim | PDV manual, Caixa, combos (RPC) |
| **Saída** | Sim | Baixa manual “Uso interno / Ajuste”, alguns fluxos ZIG |
| **Desperdício** | Sim | Baixa manual “Perda / Validade” |
| **Ajuste** (qtd negativa) | Sim | Balanço (contagem menor que o sistema) |

**Exceções** (linha no relatório, mas estoque **não** mudou naquele registro):

- **Backfill** de vendas antigas: só cria movimento `venda` para auditoria; estoque já tinha sido baixado antes.
- **Falha parcial no Caixa**: venda em `sales` sem movimento/estoque atualizado (erro na baixa).
- **Combo/promo**: a baixa é nos **SKUs vinculados**, não no produto “pai” da promoção.

---

## Onde os dados ficam

| O quê | Tabela / campo |
|-------|----------------|
| Estoque atual (lista de produtos) | `products.current_stock` |
| Histórico de baixas / vendas / balanço | `stock_movements` |
| Recebimento de fornecedor | `stock_entries` (só **entradas**) |
| Venda financeira (cupom, caixa) | `sales` (receita; **não substitui** movimentação de estoque) |

---

## Por tela do sistema

### Produtos → Baixa de estoque

| Botão | `movement_type` | Baixa estoque? | No relatório Saídas |
|-------|-----------------|----------------|---------------------|
| **Uso Interno / Ajuste** | `saida` | Sim | Tipo **Saída**, origem **Baixa manual** |
| **Perda / Validade** | `desperdicio` | Sim | Tipo **Desperdício**, origem **Baixa manual** |

- O motivo digitado vai em observação (`notes`); hoje **não** há campo separado “vencimento” vs “quebra” no banco.
- **Promo/combo**: desconta estoque dos itens do combo, não do cadastro promocional.

### Ponto de Venda (Venda / Baixa → manual)

- Função `deduct_stock_once`: **atualiza estoque + cria movimento** na mesma operação.
- Tipo: **`venda`**
- Relatório: **Venda**, origem **PDV (Manual)**

### PDV Caixa

- Grava venda em `sales` **e** faz `updateStock` + movimento **`venda`**.
- Relatório: **Venda**, origem **PDV (Caixa)**

### Integração ZIG

- Confirmação de baixa no servidor (mesmo padrão idempotente de baixa).
- Relatório: origem **Integração (ZIG)** (identificada pelo texto da observação).
- Tipo na linha: em geral **`venda`** ou **`saida`**.

### Balanço de estoque

- Ajusta `current_stock` para a **contagem física**.
- Movimento **`ajuste`**: quantidade = diferença (negativa = saída).
- Relatório Saídas: só se a diferença for **negativa** (Tipo **Ajuste**).
- Diferença **positiva** aparece em **Relatórios → Entradas** (balanço que aumenta estoque).

### Cancelar recebimento

- Reverte estoque da entrada e gera movimento tipo **`saida`** (estorno técnico, não consumo normal).

---

## Como o Relatório → Saídas monta a lista

1. Lê todas as `stock_movements` da empresa (carregadas no app).
2. Aplica o **período** (De / Até + botão **Filtrar período**).
3. Mantém linhas classificadas como **saída** pela regra `isAnyStockOutput`:
   - `saida`, `venda`, `desperdicio`
   - `ajuste` com quantidade **negativa**
   - legado: `entrada` com quantidade **negativa**

Colunas:

- **Tipo**: Saída, Venda, Desperdício, Ajuste
- **Origem**: Baixa manual, PDV (Manual), PDV (Caixa), Integração (ZIG), Balanço
- **Quantidade / Valor (custo)**: quantidade baixada e custo (CMP × qtd quando aplicável)

Filtros da aba:

| Filtro | Inclui |
|--------|--------|
| Todos | Toda saída acima |
| Consumo | `venda` + `saida` (uso/consumo, não desperdício) |
| Saída manual | só `type = saida` |
| Venda PDV | só `type = venda` |
| Desperdício | só `desperdicio` |
| Balanço / ajuste | só `ajuste` (baixa por contagem) |

**Atenção:** “**Saída**” no relatório **não** é só uso interno — é qualquer movimento com tipo `saida`. “**Venda**” é venda registrada como tipo `venda` (PDV, caixa, etc.).

---

## FAQ

### Saída e Venda no relatório baixaram o estoque?

**Sim**, em condições normais. Cada linha reflete uma operação que chama `updateStock(-qtd)` ou `deduct_stock_once` (ou balanço que redefine o saldo).

### Onde vejo uso interno vs perda/validade?

- **Perda / validade** → filtro **Desperdício** ou tipo **Desperdício** na tabela.
- **Uso interno** → filtro **Saída manual** ou tipo **Saída** com origem **Baixa manual** (motivo na observação).

### Entrada de fornecedor aparece em Saídas?

**Não.** Recebimento grava `stock_entries` + movimento `entrada` e **aumenta** estoque. Aparece em **Relatórios → Entradas** e no histórico de recebimento.

### Como conferir no Postgres EasyPanel (exemplo)

```sql
SELECT movement_type, quantity, movement_date, notes
FROM stock_movements
WHERE company_id = '<uuid-empresa>'
  AND product_id = '<uuid-produto>'
  AND movement_date >= '2026-05-21'
  AND movement_date < '2026-05-22'
ORDER BY movement_date DESC;

SELECT name, current_stock FROM products WHERE id = '<uuid-produto>';
```

---

## Arquivos no código (referência técnica)

| Assunto | Arquivo |
|---------|---------|
| Regra “o que é saída no relatório” | `src/utils/stockMovementFilters.ts` (`isAnyStockOutput`) |
| Aba Saídas do relatório | `src/components/reports/OutputsTab.tsx` |
| Baixa manual (uso interno / perda) | `src/components/inventory/StockAdjustmentModal.tsx` |
| Baixa + movimento | `src/services/StockService.ts` (`processStockOutput`) |
| PDV manual | `src/components/sales/POS.tsx` (`deduct_stock_once`) |
| Caixa | `src/components/cashier/CashierPOS.tsx` |
| Balanço | `src/services/StockService.ts` (`setStockBalance`) |
| RPC idempotente | `scripts/fix_manual_sale_500.sql` (`deduct_stock_once`) |
