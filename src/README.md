# Atualização do banco — PyrouStock (EasyPanel)

Scripts em `scripts/` e `stock-db/` atualizam o Postgres **EasyPanel** (database **`stock-pyrou`**).

**Segurança:**
- Não deleta dados existentes (exceto onde o script documentar o contrário)
- Preferir `IF NOT EXISTS` / idempotente
- Pode ser executado mais de uma vez quando o script for idempotente

---

## Como executar

### Opção A — pgAdmin (EasyPanel)

1. Conecte no host Postgres do EasyPanel
2. Selecione o database **`stock-pyrou`**
3. Query Tool → abra o `.sql` → Execute (F5)

### Opção B — psql

```bash
PGPASSWORD='...' psql \
  -h easypanel.pyrou.com.br \
  -p 5432 \
  -U pyrouwebdb \
  -d stock-pyrou \
  -f scripts/NOME_DO_SCRIPT.sql
```

### API

A API (`stockpyrou-api`) usa:

```bash
DATABASE_URL=postgresql://pyrouwebdb:SENHA_ENCODED@easypanel.pyrou.com.br:5432/stock-pyrou?sslmode=disable
```

Front aponta para a API via `VITE_API_URL` (Railway).

Scripts úteis recentes: `scripts/add_nfce_emission.sql`, `scripts/add_customers.sql`, `scripts/add_fiscal_config.sql`, `scripts/fix_manual_sale_500.sql`.
