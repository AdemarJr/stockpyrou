import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { getPool } from './db/pool.js';
import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';

const app = new Hono();

const frontendUrl = process.env.FRONTEND_URL?.trim() || 'http://localhost:3000';

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return frontendUrl;
      if (origin === frontendUrl) return origin;
      if (origin.startsWith('http://localhost:')) return origin;
      return frontendUrl;
    },
    allowMethods: ['GET', 'HEAD', 'PUT', 'POST', 'DELETE', 'PATCH', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'X-Custom-Token',
      'X-Company-Id',
    ],
  }),
);

app.get('/api/health', async (c) => {
  try {
    await getPool().query('SELECT 1');
    return c.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return c.json({ status: 'degraded', database: 'disconnected', error: message }, 503);
  }
});

app.route('/api/auth', authRoutes);
app.route('/api/products', productsRoutes);

const port = Number(process.env.PORT) || 3001;

console.log(`[stockpyrou-server] listening on http://localhost:${port}`);

serve({ fetch: app.fetch, port });
