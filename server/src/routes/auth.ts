import { Hono } from 'hono';
import { verifyRequestToken } from '../auth/verify-token.js';

const authRoutes = new Hono();

function extractToken(c: { req: { header: (name: string) => string | undefined } }): string | null {
  const custom = c.req.header('X-Custom-Token');
  if (custom?.trim()) return custom.trim();
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return null;
}

authRoutes.get('/me', async (c) => {
  const auth = await verifyRequestToken(extractToken(c));
  if (!auth) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  return c.json({ user: auth });
});

export default authRoutes;
