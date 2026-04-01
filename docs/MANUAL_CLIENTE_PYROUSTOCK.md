# Manual do cliente — PyrouStock

Guia prático para começar a usar o sistema no dia a dia. O menu lateral pode variar conforme o **perfil de permissões** do seu usuário (nem todos veem todas as telas).

---

## 1. Primeiro acesso

1. **Entrar** com e-mail e senha fornecidos pela sua empresa.
2. **Selecionar a empresa** (se aparecer mais de uma).
3. Você cai no **Dashboard** (visão geral) ou na última tela em que estava.

**Dica:** No menu superior aparece o seu nome. No canto superior esquerdo (desktop), você pode **recolher/expandir** o menu lateral e **trocar a empresa** clicando no nome da empresa.

---

## 2. Ordem sugerida no primeiro dia

Siga esta ordem para cadastrar a base antes de vender e analisar custos:

| Passo | Onde no sistema | O que fazer |
|------|-----------------|-------------|
| 1 | **Fornecedores** | Cadastre quem vende para você (opcional, mas ajuda em compras e custos). |
| 2 | **Produtos** | Cadastre itens e preços (custo, venda, unidade, estoque mínimo). |
| 3 | **Recebimento** | Registre as primeiras entradas de mercadoria (compra → aumenta estoque). |
| 4 | **Venda / Baixa** ou **PDV** | Teste uma venda ou baixa de estoque. |
| 5 | **Custos** (se habilitado) | Configure centros de custo se necessário e lance despesas. |
| 6 | **Relatórios** | Consulte movimentações e totais. |

Se você integra **ZIG** (vendas de outro sistema), a configuração fica em **Venda / Baixa** → integração ZIG (após produtos e loja cadastrados).

---

## 3. Módulos do menu

### Dashboard

- Visão geral: **valor de estoque**, **margem potencial**, **desperdício** (se houver lançamentos), **produtos com estoque baixo**, gráficos de distribuição.
- Use para acompanhar o dia a dia sem abrir cada cadastro.

### Produtos

- Lista de todos os itens com estoque, custo e preço de venda.
- **Novo produto** (cadastro rápido ou completo).
- **Importação em massa** (arquivo), quando disponível.
- **Duplicar** produto para criar variações parecidas.
- **Ajuste de estoque** e **balanço** podem ser acessados a partir do fluxo de estoque (Recebimento / Balanço).

### Recebimento (entradas de estoque)

- Registra **compras**: produto, quantidade, custo unitário, fornecedor, lote, validade (quando aplicável).
- Atualiza o **estoque** e o **custo médio** do produto.
- Pode usar **leitor de código de barras** na entrada, se disponível no dispositivo.

### Balanço

- Ajusta a **quantidade física** contada em relação ao sistema.
- Use para inventário ou correções (com cuidado e, se possível, com permissão).

### Venda / Baixa (PDV interno)

- Carrinho de **venda** ou **baixa** (consumo interno, etc., conforme fluxo da empresa).
- Pode trabalhar com **produtos** e **receitas** (quando a receita baixa ingredientes automaticamente).
- **Integração ZIG** (quando configurada): conferir vendas do ZIG e dar baixa no estoque alinhada aos produtos cadastrados.

### PDV (caixa)

- Ponto de venda com **caixa** (abertura, vendas, fechamento).
- Fluxo típico: abrir caixa → registrar vendas → fechar ao fim do turno.

### Fornecedores

- Cadastro de **fornecedores** (nome, contato, etc.).
- Usado em **Recebimento** e pode ser vinculado a **Custos** (despesas).

### Relatórios

- Filtros por período, produtos, movimentações.
- Use para conferência, auditoria simples e exportação quando disponível.

### Custos

Área financeira operacional (quando a permissão existir):

- **Visão geral** e **centros de custo** (inicialização de centros padrão, se existir o botão).
- **Despesas**: títulos a pagar, vencimento, **pagamento parcial** ou total, vínculo opcional com **entrada de estoque** (compra).
- **Orçamentos**, **comissões** (conforme configuração), **análises**, **metas**.

**Integração com estoque:** no cadastro da despesa pode haver campo para **vincular à entrada de estoque** (compra). No dashboard de custos podem aparecer **valor estimado em estoque** e **compras do mês** (somando entradas).

### Usuários

- Apenas perfis com permissão de gestão.
- **Convite**, cadastro e permissões de acesso por função.

---

## 4. Atalhos e conforto

| Recurso | Como usar |
|--------|-----------|
| **Busca rápida** | **Ctrl+K** (Windows/Linux) ou **Cmd+K** (Mac) abre a busca rápida, quando disponível. |
| **Tema claro/escuro** | Botão no rodapé do menu lateral (desktop) ou no topo (mobile). |
| **PWA** | O sistema pode ser instalado como app no celular/desktop (depende do navegador). |
| **URL** | A página atual pode ficar salva na barra de endereço (`?page=...`), útil para favoritar uma seção. |

---

## 5. Boas práticas

- **Cadastre produtos antes** de grandes vendas ou integrações, para o estoque e a baixa baterem com o que você vende.
- **Receitas** (receita com ingredientes): útil quando a venda é de um item (ex.: prato) e a baixa é de **insumos** (ingredientes).
- **Custos:** ao pagar uma **despesa de compra**, vincule à **entrada de estoque** correspondente quando a empresa quiser rastrear financeiro × compra física.
- **Permissões:** se não enxergar um menu, é o administrador da empresa que precisa liberar o perfil.

---

## 6. Problemas comuns

| Situação | O que verificar |
|----------|-----------------|
| Não vejo o menu **Custos** ou **Relatórios** | Permissão do usuário; falar com o administrador. |
| Erro ao baixar estoque ZIG | Produto não cadastrado ou SKU diferente; usar mapeamento na integração e conferir limites de data da API ZIG. |
| **Pagamento parcial** de despesa com erro | Colunas do banco no Supabase precisam estar criadas (script SQL fornecido pela equipe técnica). |

---

## 7. Suporte

Dúvidas de **negócio** (como lançar na sua operação): fale com o **responsável pela sua empresa** no PyrouStock.

Dúvidas de **acesso, senha ou bug**: abra chamado com quem **presta o suporte técnico** do contrato (equipe que implantou o sistema).

---

*Documento gerado para clientes finais do PyrouStock. Ajuste nomes de telas se a sua implantação usar rótulos personalizados.*
