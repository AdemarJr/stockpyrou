# Arquitetura: backend próprio (stockpyrou-api) + Postgres (EasyPanel)

O Supabase foi **removido** do frontend. Todo acesso a dados passa pela API própria em **`stockpyrou-api`** (repo separado), que fala com um Postgres hospedado no EasyPanel.

Repo API: https://github.com/AdemarJr/stockpyrou-api

## Arquitetura

```
Frontend (src/)  →  stockpyrou-api (Node + Hono + pg)  →  PostgreSQL (EasyPanel)
```

- O frontend chama exclusivamente `getApiBaseUrl()` (`src/lib/apiConfig.ts`), configurável via `VITE_API_URL`.
- Autenticação usa apenas o token custom (`Authorization: Bearer <token>` + `X-Custom-Token: <token>`) contra `/api/auth/*`. Não há mais `supabase.auth`, `publicAnonKey` nem `onAuthStateChange`.
- Não existe mais modo dual (`useOwnApi()` foi removido); os repositórios (`ProductRepository`, `StockRepository`, `SupplierRepository`, `PriceHistoryRepository`, `CompanyRepository`, `CostRepository`, etc.) chamam diretamente as respectivas classes `*Api`.

## Módulos

| Módulo | Frontend | API |
|--------|----------|-----|
| Produtos | `ProductRepository` | `/api/products` |
| Fornecedores | `SupplierRepository` | `/api/suppliers` |
| Estoque | `StockRepository` | `/api/stock/*` |
| Histórico de preços | `PriceHistoryRepository` | `/api/price-history` |
| Empresas | `CompanyRepository` | `/api/companies/*` |
| Auth (login/me/init) | `AuthContext` | `/api/auth/*` |
| Caixa / PDV | Cashier, POS | `/api/cashier/*` |
| Relatórios vendas/fechamentos | `Reports` | `/api/reports/*` |
| Custos (centros de custo, tipos de despesa, analytics) | `CostRepository` | `/api/costs/*` |
| ZIG (config, preview, confirm, comparativo) | `ZigSalesBaixa`, `ZigIntegrationSettings`, `ZigSaidaComparisonCard` | `/api/zig/*` |
| Admin SaaS / usuários | `AdminSaaS`, `UserManagement` | `/api/admin/*`, `/api/users/*` |

## Rodar localmente

```bash
# 1. Backend
cd stockpyrou-api
cp .env.example .env   # DATABASE_URL do Postgres (EasyPanel) + FRONTEND_URL
npm install && npm run dev

# 2. Front (outro terminal, na raiz do stockpyrou)
npm run dev

# 3. .env.local na raiz do front
VITE_API_URL=/api
# ou URL do Railway: https://seu-servico.up.railway.app/api
```

## Scripts (se `stockpyrou-api/` estiver ao lado / dentro do monorepo)

| Comando | Descrição |
|---------|-----------|
| `npm run dev:api` | Só backend (`:3001`) |
| `npm run dev:all` | Backend + frontend |
| `npm run build:api` | Typecheck da API |

## Deploy

- **Frontend**: build estático (Vite) com `VITE_API_URL` apontando para a API em produção.
- **API**: deploy do repo `AdemarJr/stockpyrou-api` no Railway. Variáveis obrigatórias: `DATABASE_URL` (Postgres EasyPanel) e `FRONTEND_URL` (CORS).

## Segurança (produção)

- `DATABASE_URL` só no servidor (nunca exposto ao frontend)
- CORS restrito ao domínio do front via `FRONTEND_URL`
- Sem chaves anônimas públicas: toda rota autenticada exige o token custom do usuário
