import { Hono } from 'hono';
import type { Env } from '../config.worker.js';
import { getCacheKV } from '../services/cache.kv.js';

const meta = new Hono<{ Bindings: Env }>();

// GET /api/v1/meta/fuel-types
meta.get('/api/v1/meta/fuel-types', async (c) => {
  const cache = await getCacheKV(c.env);
  if (!cache) return c.json({ error: 'Data not available yet' }, 503);

  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({ fuelTypes: cache.fuelTypes });
});

// GET /api/v1/meta/districts
meta.get('/api/v1/meta/districts', async (c) => {
  const cache = await getCacheKV(c.env);
  if (!cache) return c.json({ error: 'Data not available yet' }, 503);

  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({ districts: cache.districts });
});

export { meta };
