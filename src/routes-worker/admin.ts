import { Hono } from 'hono';
import type { Env } from '../config.worker.js';
import { refreshCacheKV } from '../services/cache.kv.js';
import { checkBasicAuth } from '../utils/auth.js';

const admin = new Hono<{ Bindings: Env }>();

// POST /api/v1/admin/refresh
admin.post('/api/v1/admin/refresh', async (c) => {
  const apiKey = c.req.header('x-api-key');
  const dashPw = c.env.DASHBOARD_PASSWORD;
  const authed =
    apiKey === c.env.ADMIN_API_KEY ||
    (!!dashPw && checkBasicAuth(c.req.header('Authorization'), dashPw));

  if (!authed) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  try {
    const data = await refreshCacheKV(c.env);
    return c.json({
      message: 'Cache refreshed successfully',
      stationCount: data.stations.length,
      scrapedAt: data.scrapedAt,
    });
  } catch (err) {
    return c.json({
      error: 'Refresh failed',
      message: (err as Error).message,
    }, 500);
  }
});

export { admin };
