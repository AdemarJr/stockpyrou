# API própria (Supabase só como banco)

Backend Node em `server/` roda **em paralelo** ao fluxo atual (Supabase client + Edge Functions).

## Comportamento padrão (produção / sem config)

- `VITE_USE_OWN_API` **não definido** ou `false`
- O sistema continua usando **Supabase direto** e **Edge Functions**
- Nenhuma funcionalidade muda

## Ativar a API nova (testes locais)

1. Copie `server/.env.example` → `server/.env` e preencha `DATABASE_URL` (Postgres do Supabase).

2. Instale e suba a API:

```bash
cd server && npm install && npm run dev
```

3. Em outro terminal, suba o front (proxy `/api` → `:3001`):

```bash
npm run dev
```

4. Opcional — ativar só produtos via API:

```env
# .env.local
VITE_USE_OWN_API=true
VITE_API_URL=/api
```

5. Faça login **normalmente** (Edge/Supabase). O token `custom_` existente funciona na API nova.

## Módulos migrados (dual-mode)

| Módulo | Repository | Rotas API |
|--------|------------|-----------|
| Produtos | `ProductRepository` | `GET/POST/PUT/PATCH/DELETE /api/products` |

Próximos candidatos: `StockRepository`, `SupplierRepository`, caixa (`/cashier/*`), custos.

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev:api` | Só o backend (`:3001`) |
| `npm run dev:all` | Backend + frontend |
| `npm run build:api` | Typecheck do server |
