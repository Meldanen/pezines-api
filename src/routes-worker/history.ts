import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../config.worker.js';
import { getStationHistory, getAverageHistory, getSnapshots } from '../services/history.d1.js';

const history = new Hono<{ Bindings: Env }>();

// Parse a positive-integer `limit` query param. Returns:
//   - { value: n } for a valid integer >= 1
//   - { value: undefined } if not supplied
//   - { error } for anything else (negative, zero, NaN, non-integer)
function parseLimit(c: Context): { value?: number; error?: string } {
  const raw = c.req.query('limit');
  if (raw === undefined || raw === '') return { value: undefined };
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    return { error: 'limit must be a positive integer' };
  }
  return { value: n };
}

// GET /api/v1/history/station/:stationId
history.get('/api/v1/history/station/:stationId', async (c) => {
  const stationId = c.req.param('stationId');
  const limit = parseLimit(c);
  if (limit.error) return c.json({ error: limit.error }, 400);

  const rows = await getStationHistory(c.env.DB, stationId, {
    fuelType: c.req.query('fuelType'),
    from: c.req.query('from'),
    to: c.req.query('to'),
    limit: limit.value,
  });

  return c.json({ stationId, count: rows.length, history: rows });
});

// GET /api/v1/history/average
history.get('/api/v1/history/average', async (c) => {
  const limit = parseLimit(c);
  if (limit.error) return c.json({ error: limit.error }, 400);

  const rows = await getAverageHistory(c.env.DB, {
    fuelType: c.req.query('fuelType'),
    from: c.req.query('from'),
    to: c.req.query('to'),
    limit: limit.value,
  });

  return c.json({ count: rows.length, history: rows });
});

// GET /api/v1/history/snapshots
history.get('/api/v1/history/snapshots', async (c) => {
  const limit = parseLimit(c);
  if (limit.error) return c.json({ error: limit.error }, 400);

  const rows = await getSnapshots(c.env.DB, limit.value);

  return c.json({ count: rows.length, snapshots: rows });
});

export { history };
