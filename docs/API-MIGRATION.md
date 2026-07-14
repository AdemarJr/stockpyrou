# Migração: Supabase só como banco + backend próprio

Backend Node em `server/` roda **em paralelo** ao fluxo atual. **Por padrão nada muda** no sistema em produção.

## Arquitetura

```
Frontend (src/)  →  server/ (Node + Hono + pg)  →  PostgreSQL (Supabase)
```

- **Sem** `VITE_USE_OWN_API` → Supabase client + Edge Functions (comportamento atual)
- **Com** `VITE_USE_OWN_API=true` → API em `server/`; Postgres via `DATABASE_URL`

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
# 1. Banco
cp server/.env.example server/.env
# Preencha DATABASE_URL (Supabase → Database → Connection string)

# 2. API
cd server && npm install && npm run dev

# 3. Front (outro terminal)
npm run dev

# 4. .env.local na raiz
VITE_USE_OWN_API=true
VITE_API_URL=/api
```

Login normal; token `custom_` existente funciona na API nova.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev:api` | Só backend (`:3001`) |
| `npm run dev:all` | Backend + frontend |
| `npm run build:api` | Typecheck do server |

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
