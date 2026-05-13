import { Hono } from 'hono';
import type { Env } from '../config.worker.js';
import { getCacheKV } from '../services/cache.kv.js';
import { getStation, listStations, nearbyStations } from '../handlers/stations.js';

const stations = new Hono<{ Bindings: Env }>();

// GET /api/v1/stations
stations.get('/api/v1/stations', async (c) => {
  const cache = await getCacheKV(c.env);
  const r = listStations(cache, {
    fuelType: c.req.query('fuelType'),
    district: c.req.query('district'),
    brand: c.req.query('brand'),
  });
  return c.json(r.body, r.status);
});

// GET /api/v1/stations/nearby
stations.get('/api/v1/stations/nearby', async (c) => {
  const cache = await getCacheKV(c.env);
  const latRaw = c.req.query('lat');
  const lngRaw = c.req.query('lng');
  const radiusRaw = c.req.query('radius');
  const sort = c.req.query('sort');
  const r = nearbyStations(cache, {
    lat: latRaw !== undefined ? Number(latRaw) : undefined,
    lng: lngRaw !== undefined ? Number(lngRaw) : undefined,
    radius: radiusRaw !== undefined ? Number(radiusRaw) : undefined,
    fuelType: c.req.query('fuelType'),
    sort: sort === 'price' || sort === 'distance' ? sort : undefined,
  });
  return c.json(r.body, r.status);
});

// GET /api/v1/stations/:stationId
stations.get('/api/v1/stations/:stationId', async (c) => {
  const cache = await getCacheKV(c.env);
  const r = getStation(cache, c.req.param('stationId'));
  return c.json(r.body, r.status);
});

export { stations };
