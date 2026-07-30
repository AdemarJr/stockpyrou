# Arquitetura — Frontend / API / Postgres (EasyPanel)

## Arquitetura atual

```
┌─────────────────┐     HTTPS + JWT      ┌─────────────────┐     DATABASE_URL    ┌──────────────────┐
│  Frontend       │ ───────────────────► │  stockpyrou-api │ ────────────────► │  PostgreSQL      │
│  (React/Vite)   │                      │  (Node/Hono/pg) │                   │  EasyPanel       │
└─────────────────┘                      └─────────────────┘                   │  stock-pyrou     │
                                                                               └──────────────────┘
```

- Front: `VITE_API_URL` → Railway `stockpyrou-api`
- API: `DATABASE_URL` → Postgres EasyPanel database **`stock-pyrou`**
- Auth: token custom (`Authorization` + `X-Custom-Token`) em `/api/auth/*`

## Backend (`stockpyrou-api`)

| Área | Rotas |
|------|-------|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/login`, `/init`, `GET /me` |
| Produtos | CRUD `/api/products` |
| Fornecedores | CRUD `/api/suppliers` |
| Clientes | CRUD `/api/customers` |
| Estoque | `/api/stock/entries`, `/movements`, `/deduct` |
| Preços | `/api/price-history` |
| Empresas | `/api/companies/*` |
| Caixa | `/api/cashier/*` |
| Relatórios | `/api/reports/*` |
| Custos / Receber | `/api/costs/*`, `/api/receivables/*` |
| Fiscal NFC-e | `/api/fiscal/*` |
| ZIG | `/api/zig/*` |
| Admin / users | `/api/admin/*`, `/api/users/*` |

## Tabelas principais

`products`, `suppliers`, `customers`, `stock_entries`, `stock_movements`, `price_history`, `companies`, `user_companies`, `app_users`, `cash_registers`, `cash_movements`, `sales`, `accounts_receivable`, `fiscal_config`, `nfce`, `kv_store_8a20b27d`

RPC de baixa: `deduct_stock_once` — chamada pelo servidor em `POST /api/stock/deduct`.

## Env

**API (Railway / local `.env`):**

```bash
DATABASE_URL=postgresql://pyrouwebdb:SENHA_ENCODED@easypanel.pyrou.com.br:5432/stock-pyrou?sslmode=disable
FRONTEND_URL=https://stockpyrou.com.br
```

**Front (build):**

```bash
VITE_API_URL=https://stockpyrou-api-production.up.railway.app/api
```

Ver também: [API-MIGRATION.md](./API-MIGRATION.md)
