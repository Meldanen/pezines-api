import { Hono } from 'hono';
import type { Env } from '../config.worker.js';
import { getCacheKV, isCacheStaleKV } from '../services/cache.kv.js';

const health = new Hono<{ Bindings: Env }>();

// GET /api/v1/health
health.get('/api/v1/health', async (c) => {
  const cache = await getCacheKV(c.env);
  return c.json({
    status: 'ok',
    runtime: 'cloudflare-workers',
    cache: {
      populated: cache !== null,
      stationCount: cache?.stations.length ?? 0,
      scrapedAt: cache?.scrapedAt ?? null,
      staleTTL: cache ? isCacheStaleKV(cache) : true,
    },
  });
});

export { health };
