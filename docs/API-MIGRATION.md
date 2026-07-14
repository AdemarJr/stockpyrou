# Migração: Supabase só como banco + backend próprio

Backend Node em **`stockpyrou-api`** (repo separado) roda **em paralelo** ao fluxo atual. **Por padrão nada muda** no sistema em produção.

Repo API: https://github.com/AdemarJr/stockpyrou-api

## Arquitetura

```
Frontend (src/)  →  stockpyrou-api (Node + Hono + pg)  →  PostgreSQL (Supabase)
```

- **Sem** `VITE_USE_OWN_API` → Supabase client + Edge Functions (comportamento atual)
- **Com** `VITE_USE_OWN_API=true` → API em `stockpyrou-api`; Postgres via `DATABASE_URL`

## Módulos migrados (dual-mode)

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

## Ainda na Edge Function (quando flag ativa)

Estes continuam na Edge até próxima fase:

- **ZIG** (`/zig/*`)
- **Admin SaaS** (`/admin/*`, `/users/*`)
- **Custos** (`CostRepository` → Supabase direto)
- Integrações financeiras documentadas em `API-INTEGRACAO-FINANCEIRA.md`

## Ativar localmente

```bash
# 1. Clone / pasta stockpyrou-api
cd stockpyrou-api
cp .env.example .env   # DATABASE_URL do Supabase
npm install && npm run dev

# 2. Front (outro terminal, na raiz do stockpyrou)
npm run dev

# 3. .env.local na raiz do front
VITE_USE_OWN_API=true
VITE_API_URL=/api
# ou URL do Railway: https://seu-servico.up.railway.app/api
```

Login normal; token `custom_` existente funciona na API nova.

## Scripts (se `stockpyrou-api/` estiver ao lado / dentro do monorepo)

| Comando | Descrição |
|---------|-----------|
| `npm run dev:api` | Só backend (`:3001`) |
| `npm run dev:all` | Backend + frontend |
| `npm run build:api` | Typecheck da API |

## Railway

Deploy do repo **`AdemarJr/stockpyrou-api`** (raiz do repo). Variáveis: `DATABASE_URL`, `FRONTEND_URL`.

## Próximas fases

1. Custos (`CostRepository` → `/api/costs/*`)
2. ZIG (`zig_service.tsx` → `/api/zig/*`)
3. Admin / usuários (`/api/admin/*`, `/api/users/*`)
4. Remover `@supabase/supabase-js` do frontend
5. Desligar Edge Functions

## Segurança (produção com API própria)

- `DATABASE_URL` só no servidor
- Bloquear PostgREST anon quando API estiver 100% ativa
- CORS restrito ao domínio do front
