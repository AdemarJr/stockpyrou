# stockpyrou-server

API Node (Hono + `pg`) usando Supabase **somente como Postgres**.

## Railway

1. New Project → Deploy from GitHub → repo `stockpyrou`
2. **Root Directory:** `server`
3. Variables:

```bash
DATABASE_URL=postgresql://postgres.fnkshezgoggtupqqcsoa:SUA_SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres
FRONTEND_URL=https://stockpyrou.com.br
```

4. Generate Domain (Settings → Networking)
5. Health check: `GET /api/health`

Não versione `server/.env` (já está no `.gitignore`).

## Local

```bash
cp .env.example .env   # preencha DATABASE_URL
npm install
npm run dev            # :3001
```
