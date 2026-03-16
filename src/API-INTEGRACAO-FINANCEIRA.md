# 📡 API de Integração Financeira - PyrouStock

## 🎯 Visão Geral

Esta API permite que sistemas financeiros externos consumam dados do PyrouStock para análises, controle de receitas/custos e gestão financeira empresarial.

---

## 🔐 Autenticação

Todas as requisições devem incluir o header de autenticação:

```
Authorization: Bearer {INTEGRATION_API_KEY}
```

**Formato da API Key**: `pyroustock_integration_{uuid}`

---

## 📍 Base URL

```
https://{projectId}.supabase.co/functions/v1/make-server-8a20b27d
```

**Variáveis:**
- `projectId`: Obtido no Supabase (veja `/utils/supabase/info.tsx`)

---

## 🔑 Endpoints Disponíveis

### 1. **GET** `/integration/sales` - Listagem de Vendas

Retorna todas as vendas realizadas no PDV/Caixa.

**Query Parameters:**
- `companyId` (obrigatório): ID da empresa
- `startDate` (opcional): Data inicial (ISO 8601) - Ex: `2024-01-01T00:00:00Z`
- `endDate` (opcional): Data final (ISO 8601) - Ex: `2024-12-31T23:59:59Z`
- `limit` (opcional): Limite de resultados (padrão: 100, máx: 1000)
- `offset` (opcional): Paginação (padrão: 0)

**Exemplo de Requisição:**
```bash
GET /integration/sales?companyId=abc123&startDate=2024-01-01T00:00:00Z&limit=50
Authorization: Bearer pyroustock_integration_xyz789
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "sale_001",
      "companyId": "abc123",
      "date": "2024-02-27T14:30:00Z",
      "total": 150.50,
      "paymentMethod": "pix",
      "items": [
        {
          "productId": "prod_001",
          "productName": "Cerveja Heineken 350ml",
          "quantity": 5,
          "unitPrice": 8.00,
          "totalPrice": 40.00,
          "costPrice": 5.50,
          "profit": 12.50
        },
        {
          "productId": "prod_002",
          "productName": "Porção Batata Frita",
          "quantity": 2,
          "unitPrice": 25.00,
          "totalPrice": 50.00,
          "costPrice": 12.00,
          "profit": 26.00
        }
      ],
      "totalCost": 51.50,
      "totalProfit": 99.00,
      "profitMargin": 65.8,
      "userId": "user_001",
      "userName": "João Silva",
      "cashierId": "cashier_001",
      "receiptNumber": "00123",
      "whatsappSent": true
    }
  ],
  "pagination": {
    "total": 245,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 2. **GET** `/integration/cashier-closures` - Fechamentos de Caixa

Retorna todos os fechamentos de caixa realizados.

**Query Parameters:**
- `companyId` (obrigatório): ID da empresa
- `startDate` (opcional): Data inicial
- `endDate` (opcional): Data final
- `limit` (opcional): Limite (padrão: 100)
- `offset` (opcional): Paginação (padrão: 0)

**Exemplo de Requisição:**
```bash
GET /integration/cashier-closures?companyId=abc123&startDate=2024-02-01T00:00:00Z
Authorization: Bearer pyroustock_integration_xyz789
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "closure_001",
      "companyId": "abc123",
      "openDate": "2024-02-27T08:00:00Z",
      "closeDate": "2024-02-27T22:30:00Z",
      "duration": "14h 30m",
      "openingBalance": 200.00,
      "closingBalance": 1450.75,
      "totalSales": 2850.50,
      "totalExpected": 3050.50,
      "totalCounted": 3045.00,
      "difference": -5.50,
      "withdrawals": [
        {
          "id": "withdrawal_001",
          "amount": 500.00,
          "reason": "Pagamento fornecedor",
          "date": "2024-02-27T15:00:00Z",
          "userId": "user_001"
        }
      ],
      "reinforcements": [
        {
          "id": "reinforce_001",
          "amount": 300.00,
          "reason": "Troco",
          "date": "2024-02-27T12:00:00Z",
          "userId": "user_001"
        }
      ],
      "paymentBreakdown": {
        "money": 1200.00,
        "pix": 950.50,
        "credit": 550.00,
        "debit": 150.00
      },
      "openedBy": "user_001",
      "closedBy": "user_001",
      "userName": "João Silva",
      "notes": "Caixa tranquilo, boa movimentação"
    }
  ],
  "pagination": {
    "total": 45,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### 3. **GET** `/integration/products` - Catálogo de Produtos

Retorna todos os produtos cadastrados com informações financeiras.

**Query Parameters:**
- `companyId` (obrigatório): ID da empresa
- `category` (opcional): Filtrar por categoria
- `limit` (opcional): Limite (padrão: 100)
- `offset` (opcional): Paginação (padrão: 0)

**Exemplo de Requisição:**
```bash
GET /integration/products?companyId=abc123&category=bebida
Authorization: Bearer pyroustock_integration_xyz789
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "prod_001",
      "companyId": "abc123",
      "name": "Cerveja Heineken 350ml",
      "category": "bebida",
      "measurementUnit": "un",
      "currentStock": 120,
      "minStock": 50,
      "safetyStock": 80,
      "averageCost": 5.50,
      "sellingPrice": 8.00,
      "profitMargin": 45.45,
      "stockValue": 660.00,
      "potentialRevenue": 960.00,
      "potentialProfit": 300.00,
      "isPerishable": false,
      "barcode": "7891234567890",
      "supplierId": "sup_001",
      "supplierName": "Distribuidora ABC",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-02-25T14:30:00Z"
    }
  ],
  "pagination": {
    "total": 87,
    "limit": 100,
    "offset": 0,
    "hasMore": false
  }
}
```

---

### 4. **GET** `/integration/stock-movements` - Movimentações de Estoque

Retorna todas as movimentações de estoque (entradas, saídas, ajustes, desperdícios).

**Query Parameters:**
- `companyId` (obrigatório): ID da empresa
- `type` (opcional): Filtrar por tipo (`entrada`, `saida`, `ajuste`, `desperdicio`)
- `startDate` (opcional): Data inicial
- `endDate` (opcional): Data final
- `limit` (opcional): Limite (padrão: 100)
- `offset` (opcional): Paginação (padrão: 0)

**Exemplo de Requisição:**
```bash
GET /integration/stock-movements?companyId=abc123&type=entrada&startDate=2024-02-01T00:00:00Z
Authorization: Bearer pyroustock_integration_xyz789
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "movement_001",
      "companyId": "abc123",
      "productId": "prod_001",
      "productName": "Cerveja Heineken 350ml",
      "type": "entrada",
      "quantity": 100,
      "unitCost": 5.50,
      "totalCost": 550.00,
      "reason": "Compra fornecedor",
      "date": "2024-02-20T10:00:00Z",
      "userId": "user_001",
      "userName": "João Silva",
      "supplierId": "sup_001",
      "supplierName": "Distribuidora ABC",
      "invoiceNumber": "NF-12345",
      "batchNumber": "LOTE-202402",
      "expirationDate": null,
      "notes": "Entrega conforme pedido"
    },
    {
      "id": "movement_002",
      "companyId": "abc123",
      "productId": "prod_003",
      "productName": "Alface Americana",
      "type": "desperdicio",
      "quantity": 5,
      "unitCost": 3.50,
      "totalCost": 17.50,
      "reason": "vencimento",
      "wasteReason": "vencimento",
      "date": "2024-02-25T18:00:00Z",
      "userId": "user_002",
      "userName": "Maria Santos",
      "notes": "Validade vencida"
    }
  ],
  "pagination": {
    "total": 340,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### 5. **GET** `/integration/suppliers` - Fornecedores

Retorna todos os fornecedores cadastrados.

**Query Parameters:**
- `companyId` (obrigatório): ID da empresa

**Exemplo de Requisição:**
```bash
GET /integration/suppliers?companyId=abc123
Authorization: Bearer pyroustock_integration_xyz789
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "sup_001",
      "companyId": "abc123",
      "name": "Distribuidora ABC",
      "contact": "João Fornecedor",
      "email": "contato@distribuidoraabc.com.br",
      "phone": "+5511987654321",
      "rating": 4.5,
      "reliability": 95,
      "totalPurchases": 15,
      "totalValue": 8250.00,
      "lastPurchaseDate": "2024-02-20T10:00:00Z",
      "createdAt": "2024-01-10T08:00:00Z"
    }
  ]
}
```

---

### 6. **GET** `/integration/dashboard-metrics` - Métricas do Dashboard

Retorna métricas consolidadas para análise financeira rápida.

**Query Parameters:**
- `companyId` (obrigatório): ID da empresa
- `period` (opcional): Período (`today`, `week`, `month`, `year`) - padrão: `month`

**Exemplo de Requisição:**
```bash
GET /integration/dashboard-metrics?companyId=abc123&period=month
Authorization: Bearer pyroustock_integration_xyz789
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "startDate": "2024-02-01T00:00:00Z",
    "endDate": "2024-02-29T23:59:59Z",
    "totalStockValue": 45230.50,
    "potentialSalesValue": 68540.00,
    "potentialProfit": 23309.50,
    "profitMarginPercentage": 34.0,
    "totalSales": 45670.00,
    "totalSalesCount": 234,
    "averageTicket": 195.17,
    "totalCost": 28930.50,
    "totalProfit": 16739.50,
    "totalWaste": 450.80,
    "wastePercentage": 0.99,
    "lowStockItems": 12,
    "expiringItems": 5,
    "topSellingProducts": [
      {
        "productId": "prod_001",
        "productName": "Cerveja Heineken 350ml",
        "quantitySold": 450,
        "revenue": 3600.00,
        "profit": 1125.00
      }
    ],
    "salesByPaymentMethod": {
      "money": 12450.00,
      "pix": 18920.00,
      "credit": 11300.00,
      "debit": 3000.00
    },
    "salesByCategory": {
      "bebida": 25340.00,
      "alimento": 15230.00,
      "descartavel": 5100.00
    }
  }
}
```

---

### 7. **GET** `/integration/accounts-payable` - Contas a Pagar

Retorna as contas a pagar (compras de fornecedores pendentes).

**Query Parameters:**
- `companyId` (obrigatório): ID da empresa
- `status` (opcional): Filtrar por status (`pending`, `paid`, `overdue`)
- `startDate` (opcional): Data inicial
- `endDate` (opcional): Data final

**Exemplo de Requisição:**
```bash
GET /integration/accounts-payable?companyId=abc123&status=pending
Authorization: Bearer pyroustock_integration_xyz789
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "entry_001",
      "companyId": "abc123",
      "supplierId": "sup_001",
      "supplierName": "Distribuidora ABC",
      "invoiceNumber": "NF-12345",
      "totalAmount": 550.00,
      "dueDate": "2024-03-15T00:00:00Z",
      "status": "pending",
      "daysUntilDue": 17,
      "entryDate": "2024-02-20T10:00:00Z",
      "items": [
        {
          "productId": "prod_001",
          "productName": "Cerveja Heineken 350ml",
          "quantity": 100,
          "unitPrice": 5.50,
          "totalPrice": 550.00
        }
      ]
    }
  ],
  "summary": {
    "totalPending": 3250.00,
    "totalOverdue": 0.00,
    "totalPaid": 12450.00,
    "count": {
      "pending": 6,
      "overdue": 0,
      "paid": 45
    }
  }
}
```

---

## 🔒 Gerenciamento de API Keys

### **POST** `/integration/generate-key` - Gerar Nova API Key

Gera uma nova chave de integração para a empresa.

**Autenticação:** Token de usuário admin da empresa

**Request Body:**
```json
{
  "companyId": "abc123",
  "name": "Integração Sistema Financeiro XYZ",
  "permissions": ["read_sales", "read_cashier", "read_products", "read_movements"]
}
```

**Resposta (201 Created):**
```json
{
  "success": true,
  "apiKey": "pyroustock_integration_a1b2c3d4e5f6",
  "name": "Integração Sistema Financeiro XYZ",
  "companyId": "abc123",
  "permissions": ["read_sales", "read_cashier", "read_products", "read_movements"],
  "createdAt": "2024-02-27T15:00:00Z",
  "expiresAt": null,
  "warning": "⚠️ Guarde esta chave em local seguro. Ela não será exibida novamente!"
}
```

---

### **GET** `/integration/keys` - Listar API Keys

Lista todas as chaves de integração da empresa.

**Query Parameters:**
- `companyId` (obrigatório): ID da empresa

**Resposta (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "key_001",
      "name": "Integração Sistema Financeiro XYZ",
      "keyPreview": "pyroustock_integration_a1b2...c3d4",
      "permissions": ["read_sales", "read_cashier", "read_products"],
      "createdAt": "2024-02-27T15:00:00Z",
      "lastUsedAt": "2024-02-27T20:30:00Z",
      "status": "active"
    }
  ]
}
```

---

### **DELETE** `/integration/keys/:keyId` - Revogar API Key

Revoga uma chave de integração.

**Resposta (200 OK):**
```json
{
  "success": true,
  "message": "API Key revogada com sucesso"
}
```

---

## 📊 Webhooks (Opcional - Futuro)

Para receber notificações em tempo real quando eventos ocorrerem no PyrouStock:

### Eventos Disponíveis:
- `sale.created` - Nova venda realizada
- `cashier.opened` - Caixa aberto
- `cashier.closed` - Caixa fechado
- `product.low_stock` - Produto com estoque baixo
- `stock.movement` - Nova movimentação de estoque

**Configuração:**
```bash
POST /integration/webhooks
{
  "companyId": "abc123",
  "url": "https://seu-sistema-financeiro.com/webhooks/pyroustock",
  "events": ["sale.created", "cashier.closed"],
  "secret": "seu_secret_para_validacao"
}
```

---

## ⚠️ Códigos de Erro

| Código | Descrição |
|--------|-----------|
| 200 | Sucesso |
| 201 | Recurso criado com sucesso |
| 400 | Requisição inválida |
| 401 | Não autenticado (API Key inválida) |
| 403 | Sem permissão para acessar este recurso |
| 404 | Recurso não encontrado |
| 429 | Limite de requisições excedido |
| 500 | Erro interno do servidor |

**Exemplo de Resposta de Erro:**
```json
{
  "success": false,
  "error": "Invalid API Key",
  "code": "INVALID_API_KEY",
  "message": "A chave de API fornecida é inválida ou foi revogada"
}
```

---

## 🚀 Rate Limits

- **100 requisições por minuto** por API Key
- **5.000 requisições por hora** por API Key
- **50.000 requisições por dia** por API Key

---

## 📝 Notas para Implementação

### Para a IA do Sistema Financeiro:

1. **Autenticação**: Sempre inclua o header `Authorization: Bearer {API_KEY}`
2. **Paginação**: Use `limit` e `offset` para grandes volumes de dados
3. **Filtros de Data**: Use formato ISO 8601 (ex: `2024-02-27T15:30:00Z`)
4. **Tratamento de Erros**: Sempre verifique o campo `success` na resposta
5. **Retry Logic**: Implemente retry com backoff exponencial para erros 5xx
6. **Cache**: Considere cachear dados de produtos/fornecedores (baixa frequência de mudança)
7. **Sincronização**: Vendas e fechamentos devem ser sincronizados frequentemente (a cada 5-15 min)

### Exemplo de Integração (Pseudocódigo):

```javascript
// 1. Gerar API Key (uma única vez, manualmente)
const apiKey = "pyroustock_integration_xyz789";

// 2. Buscar vendas do dia
async function syncSalesToday() {
  const today = new Date().toISOString().split('T')[0];
  const response = await fetch(
    `${BASE_URL}/integration/sales?companyId=abc123&startDate=${today}T00:00:00Z`,
    {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    }
  );
  
  const { success, data } = await response.json();
  
  if (success) {
    // Processar vendas no sistema financeiro
    data.forEach(sale => {
      createRevenueEntry({
        date: sale.date,
        amount: sale.total,
        category: 'Vendas',
        description: `Venda #${sale.receiptNumber}`,
        profit: sale.totalProfit
      });
    });
  }
}

// 3. Buscar fechamentos de caixa
async function syncCashierClosures() {
  const response = await fetch(
    `${BASE_URL}/integration/cashier-closures?companyId=abc123`,
    {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    }
  );
  
  const { success, data } = await response.json();
  
  if (success) {
    data.forEach(closure => {
      // Registrar fechamento no sistema financeiro
      createCashFlowEntry({
        date: closure.closeDate,
        cashSales: closure.paymentBreakdown.money,
        pixSales: closure.paymentBreakdown.pix,
        cardSales: closure.paymentBreakdown.credit + closure.paymentBreakdown.debit,
        withdrawals: closure.withdrawals.reduce((sum, w) => sum + w.amount, 0)
      });
    });
  }
}

// 4. Executar sincronização a cada 15 minutos
setInterval(() => {
  syncSalesToday();
  syncCashierClosures();
}, 15 * 60 * 1000);
```

---

## 🎯 Próximos Passos para Implementação

1. ✅ Documentação criada
2. ⏳ Implementar endpoints no backend
3. ⏳ Criar sistema de API Keys
4. ⏳ Testar integração
5. ⏳ (Opcional) Implementar webhooks

---

## 📧 Suporte

Para dúvidas sobre a integração, consulte a documentação completa do PyrouStock ou entre em contato com o suporte técnico.

**Versão da API:** v1.0.0  
**Última atualização:** 27 de Fevereiro de 2024
