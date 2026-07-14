# Análise de arquitetura — Frontend / Backend / Supabase

## Situação antes desta migração

O PyrouStock usava **três canais** para dados:

1. **Supabase client no browser** (`supabase.from`) — produtos, estoque, fornecedores, custos
2. **Edge Functions** — caixa, auth, ZIG, admin, relatórios
3. **RPC no browser** — `deduct_stock_once`

Risco: chave anon exposta; regras de negócio no cliente.

## Arquitetura alvo

```
┌─────────────────┐     HTTPS + JWT      ┌─────────────────┐     DATABASE_URL    ┌──────────────┐
│  Frontend       │ ───────────────────► │  server/        │ ────────────────► │  PostgreSQL  │
│  (React/Vite)   │                      │  (Node/Hono/pg) │                   │  (Supabase)  │
└─────────────────┘                      └─────────────────┘                   └──────────────┘
```

## O que foi implementado

### Backend (`server/`)

| Área | Rotas |
|------|-------|
| Health | `GET /api/health` |
| Auth | `POST /api/auth/login`, `/init`, `GET /me` |
| Produtos | CRUD `/api/products` |
| Fornecedores | CRUD `/api/suppliers` |
| Estoque | `/api/stock/entries`, `/movements`, `/deduct` |
| Preços | `/api/price-history` |
| Empresas | `/api/companies/me`, `/user/:id`, `/superadmin/all` |
| Caixa | `/api/cashier/open`, `/current`, `/sale`, `/withdrawal`, `/deposit`, `/close`, `/history` |
| Relatórios | `/api/reports/sales`, `/closures` |

### Frontend (dual-mode)

- `VITE_USE_OWN_API` — **false por padrão** (zero mudança)
- Repositories com ramo `if (useOwnApi())` → API; senão → Supabase
- `getBackendUrl()` — URLs de caixa/relatórios/auth compatíveis com Edge

### Tabelas Postgres usadas pelo backend

`products`, `suppliers`, `stock_entries`, `stock_movements`, `price_history`, `companies`, `user_companies`, `app_users`, `cash_registers`, `cash_movements`, `sales`, `kv_store_8a20b27d`

### RPC mantida no banco

`deduct_stock_once` — chamada pelo servidor em `POST /api/stock/deduct`

## Pendente (próximas fases)

| Módulo | Situação atual |
|--------|----------------|
| **Custos** | `CostRepository` ~1100 linhas → Supabase direto |
| **ZIG** | Edge `zig_service.tsx` ~2000 linhas |
| **Admin SaaS** | Edge `/admin/*`, `/users/*` |
| **Integração financeira** | Edge `/integration/*` |

## Garantia de comportamento

- Produção **sem** `VITE_USE_OWN_API` → idêntico ao anterior
- Build front e typecheck server passando
- Migração gradual módulo a módulo

## Como validar

1. Sem flag: login, estoque, caixa, relatórios — fluxo normal
2. Com flag + `server/.env`: mesmos fluxos via `/api`
3. Comparar listagens (produtos, movimentos) entre os dois modos

Ver também: [API-MIGRATION.md](./API-MIGRATION.md)
