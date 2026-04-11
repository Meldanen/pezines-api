import { Hono } from 'hono';
import type { Env } from '../config.worker.js';
import { getCacheKV } from '../services/cache.kv.js';
import { DEFAULT_CHEAPEST_LIMIT, MAX_CHEAPEST_LIMIT } from '../utils/constants.js';
import type { PriceSummaryItem, DistrictSummaryItem } from '../models/types.js';

const prices = new Hono<{ Bindings: Env }>();

// GET /api/v1/prices/cheapest
prices.get('/api/v1/prices/cheapest', async (c) => {
  const cache = await getCacheKV(c.env);
  if (!cache) return c.json({ error: 'Data not available yet' }, 503);

  const fuelType = c.req.query('fuelType');
  if (!fuelType) return c.json({ error: 'fuelType is required' }, 400);

  const limit = Number(c.req.query('limit')) || DEFAULT_CHEAPEST_LIMIT;
  const district = c.req.query('district');

  const resolvedFuelType = cache.fuelTypes.find((ft) =>
    ft.toLowerCase().includes(fuelType.toLowerCase())
  );

  if (!resolvedFuelType) {
    return c.json({ error: 'Unknown fuel type', available: cache.fuelTypes }, 400);
  }

  let filtered = cache.stations.filter((s) =>
    s.prices.some((p) => p.fuelType === resolvedFuelType)
  );

  if (district) {
    filtered = filtered.filter((s) =>
      s.location.area.toLowerCase().includes(district.toLowerCase())
    );
  }

  const sorted = filtered
    .map((s) => ({
      ...s,
      price: s.prices.find((p) => p.fuelType === resolvedFuelType)!.price,
    }))
    .sort((a, b) => a.price - b.price)
    .slice(0, Math.min(limit, MAX_CHEAPEST_LIMIT));

  c.header('Cache-Control', 'public, max-age=900');
  return c.json({
    fuelType: resolvedFuelType,
    count: sorted.length,
    scrapedAt: cache.scrapedAt,
    stations: sorted,
  });
});

// GET /api/v1/prices/summary
prices.get('/api/v1/prices/summary', async (c) => {
  const cache = await getCacheKV(c.env);
  if (!cache) return c.json({ error: 'Data not available yet' }, 503);

  const byFuelType: PriceSummaryItem[] = [];
  const byDistrict: DistrictSummaryItem[] = [];

  for (const ft of cache.fuelTypes) {
    const allPrices = cache.stations
      .flatMap((s) => s.prices.filter((p) => p.fuelType === ft).map((p) => p.price));

    if (allPrices.length === 0) continue;

    byFuelType.push({
      fuelType: ft,
      avg: Math.round((allPrices.reduce((a, b) => a + b, 0) / allPrices.length) * 1000) / 1000,
      min: Math.min(...allPrices),
      max: Math.max(...allPrices),
      stationCount: allPrices.length,
    });

    for (const district of cache.districts) {
      const distPrices = cache.stations
        .filter((s) => s.location.area === district)
        .flatMap((s) => s.prices.filter((p) => p.fuelType === ft).map((p) => p.price));

      if (distPrices.length === 0) continue;

      byDistrict.push({
        fuelType: ft,
        district,
        avg: Math.round((distPrices.reduce((a, b) => a + b, 0) / distPrices.length) * 1000) / 1000,
        min: Math.min(...distPrices),
        max: Math.max(...distPrices),
        stationCount: distPrices.length,
      });
    }
  }

  c.header('Cache-Control', 'public, max-age=900');
  return c.json({ scrapedAt: cache.scrapedAt, byFuelType, byDistrict });
});

export { prices };
