import { Hono } from 'hono';
import type { Env } from '../config.worker.js';
import { getStationHistory, getAverageHistory, getSnapshots } from '../services/history.d1.js';

const history = new Hono<{ Bindings: Env }>();

// GET /api/v1/history/station/:stationId
history.get('/api/v1/history/station/:stationId', async (c) => {
  const stationId = c.req.param('stationId');
  const fuelType = c.req.query('fuelType');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const limit = Number(c.req.query('limit')) || undefined;

  const rows = await getStationHistory(c.env.DB, stationId, { fuelType, from, to, limit });

  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({ stationId, count: rows.length, history: rows });
});

// GET /api/v1/history/average
history.get('/api/v1/history/average', async (c) => {
  const fuelType = c.req.query('fuelType');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const limit = Number(c.req.query('limit')) || undefined;

  const rows = await getAverageHistory(c.env.DB, { fuelType, from, to, limit });

  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({ count: rows.length, history: rows });
});

// GET /api/v1/history/snapshots
history.get('/api/v1/history/snapshots', async (c) => {
  const limit = Number(c.req.query('limit')) || undefined;

  const rows = await getSnapshots(c.env.DB, limit);

  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({ count: rows.length, snapshots: rows });
});

export { history };
