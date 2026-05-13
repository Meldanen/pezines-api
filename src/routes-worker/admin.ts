import { Hono } from 'hono';
import type { Env } from '../config.worker.js';
import { refreshCacheKV } from '../services/cache.kv.js';
import { savePriceSnapshot } from '../services/history.d1.js';
import { checkBasicAuth, timingSafeEqual } from '../utils/auth.js';

const admin = new Hono<{ Bindings: Env }>();

// POST /api/v1/admin/refresh
admin.post('/api/v1/admin/refresh', async (c) => {
  const apiKey = c.req.header('x-api-key') ?? '';
  const dashPw = c.env.DASHBOARD_PASSWORD;
  const authed =
    timingSafeEqual(apiKey, c.env.ADMIN_API_KEY) ||
    (!!dashPw && checkBasicAuth(c.req.header('Authorization'), dashPw));

  if (!authed) {
    return c.json({ error: 'Invalid API key' }, 401);
  }

  try {
    const { data, fresh } = await refreshCacheKV(c.env);
    let snapshotSaved = false;
    if (fresh) {
      try {
        await savePriceSnapshot(c.env.DB, data);
        snapshotSaved = true;
      } catch (err) {
        console.error('[admin/refresh] D1 snapshot failed:', err);
      }
    }
    return c.json({
      message: fresh ? 'Cache refreshed successfully' : 'Scrape failed; kept stale cache',
      fresh,
      stationCount: data.stations.length,
      scrapedAt: data.scrapedAt,
      snapshotSaved,
    });
  } catch (err) {
    console.error('[admin/refresh] cache refresh failed:', err);
    return c.json({ error: 'Refresh failed' }, 500);
  }
});

export { admin };
