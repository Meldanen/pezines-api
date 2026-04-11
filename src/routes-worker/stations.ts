import { Hono } from 'hono';
import type { Env } from '../config.worker.js';
import { getCacheKV } from '../services/cache.kv.js';
import { findNearby } from '../services/geo.service.js';
import { DEFAULT_NEARBY_RADIUS_KM, MAX_NEARBY_RADIUS_KM } from '../utils/constants.js';

const stations = new Hono<{ Bindings: Env }>();

// GET /api/v1/stations
stations.get('/api/v1/stations', async (c) => {
  const cache = await getCacheKV(c.env);
  if (!cache) return c.json({ error: 'Data not available yet' }, 503);

  const fuelType = c.req.query('fuelType');
  const district = c.req.query('district');
  const brand = c.req.query('brand');

  let result = cache.stations;

  if (fuelType) {
    result = result.filter((s) =>
      s.prices.some((p) => p.fuelType.toLowerCase().includes(fuelType.toLowerCase()))
    );
  }
  if (district) {
    result = result.filter((s) =>
      s.location.area.toLowerCase().includes(district.toLowerCase())
    );
  }
  if (brand) {
    result = result.filter((s) =>
      s.brand.toLowerCase().includes(brand.toLowerCase())
    );
  }

  c.header('Cache-Control', 'public, max-age=900');
  return c.json({ count: result.length, scrapedAt: cache.scrapedAt, stations: result });
});

// GET /api/v1/stations/nearby
stations.get('/api/v1/stations/nearby', async (c) => {
  const cache = await getCacheKV(c.env);
  if (!cache) return c.json({ error: 'Data not available yet' }, 503);

  const lat = Number(c.req.query('lat'));
  const lng = Number(c.req.query('lng'));
  if (isNaN(lat) || isNaN(lng)) return c.json({ error: 'lat and lng are required' }, 400);

  const radius = Math.min(
    Number(c.req.query('radius')) || DEFAULT_NEARBY_RADIUS_KM,
    MAX_NEARBY_RADIUS_KM
  );
  const fuelType = c.req.query('fuelType');
  const sort = (c.req.query('sort') as 'distance' | 'price') || 'distance';

  let resolvedFuelType: string | undefined;
  if (fuelType) {
    resolvedFuelType = cache.fuelTypes.find((ft) =>
      ft.toLowerCase().includes(fuelType.toLowerCase())
    );
  }

  const results = findNearby(cache.stations, { latitude: lat, longitude: lng }, radius, resolvedFuelType, sort);

  c.header('Cache-Control', 'public, max-age=900');
  return c.json({
    count: results.length,
    center: { lat, lng },
    radiusKm: radius,
    scrapedAt: cache.scrapedAt,
    stations: results,
  });
});

// GET /api/v1/stations/:stationId
stations.get('/api/v1/stations/:stationId', async (c) => {
  const cache = await getCacheKV(c.env);
  if (!cache) return c.json({ error: 'Data not available yet' }, 503);

  const station = cache.stations.find((s) => s.id === c.req.param('stationId'));
  if (!station) return c.json({ error: 'Station not found' }, 404);

  c.header('Cache-Control', 'public, max-age=900');
  return c.json(station);
});

export { stations };
