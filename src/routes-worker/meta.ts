import { Hono } from 'hono';
import type { Env } from '../config.worker.js';
import { getCacheKV } from '../services/cache.kv.js';
import { metaDistricts, metaFuelTypes } from '../handlers/meta.js';

const meta = new Hono<{ Bindings: Env }>();

// GET /api/v1/meta/fuel-types
meta.get('/api/v1/meta/fuel-types', async (c) => {
  const r = metaFuelTypes(await getCacheKV(c.env));
  return c.json(r.body, r.status);
});

// GET /api/v1/meta/districts
meta.get('/api/v1/meta/districts', async (c) => {
  const r = metaDistricts(await getCacheKV(c.env));
  return c.json(r.body, r.status);
});

export { meta };
