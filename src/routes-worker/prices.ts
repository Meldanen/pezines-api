import { Hono } from 'hono';
import type { Env } from '../config.worker.js';
import { getCacheKV } from '../services/cache.kv.js';
import { cheapestPrices, pricesSummary } from '../handlers/prices.js';

const prices = new Hono<{ Bindings: Env }>();

// GET /api/v1/prices/cheapest
prices.get('/api/v1/prices/cheapest', async (c) => {
  const cache = await getCacheKV(c.env);
  const limitRaw = c.req.query('limit');
  const r = cheapestPrices(cache, {
    fuelType: c.req.query('fuelType'),
    district: c.req.query('district'),
    limit: limitRaw !== undefined ? Number(limitRaw) : undefined,
  });
  return c.json(r.body, r.status);
});

// GET /api/v1/prices/summary
prices.get('/api/v1/prices/summary', async (c) => {
  const cache = await getCacheKV(c.env);
  const r = pricesSummary(cache);
  return c.json(r.body, r.status);
});

export { prices };
