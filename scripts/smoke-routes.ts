// Wires up both runtimes in-memory and asserts every endpoint is registered,
// routes through to handlers, applies the no-store cache header, and returns
// the correct shape/status.
//
// Fastify: tests only the paths that don't need cache content (4xx/5xx, auth,
// headers, dashboard gating). Module-level cache state can't be mocked under
// ESM without a test seam, and the 200-with-data paths are already covered by
// scripts/smoke.ts hitting the handlers directly.
//
// Hono: full coverage via a fake KV that returns a fixture cache.

import type { CacheData } from '../src/models/types.js';

process.env.ADMIN_API_KEY = 'test-key';

let failures = 0;
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${msg}`);
  }
}

const fixture: CacheData = {
  stations: [
    {
      id: 'aaa1',
      brand: 'EKO',
      name: 'EKO Nicosia',
      location: { address: 'a', area: 'Nicosia', coordinates: { latitude: 35.18, longitude: 33.38 } },
      prices: [{ fuelType: 'Unleaded 95', price: 1.5 }],
    },
  ],
  scrapedAt: '2026-05-13T10:00:00Z',
  fuelTypes: ['Unleaded 95'],
  districts: ['Nicosia'],
};

// ───── Fastify (no cache injected — exercises 4xx/5xx + middleware + routing)
{
  const { buildApp } = await import('../src/app.js');
  const app = await buildApp({ logger: false });

  const health = await app.inject({ method: 'GET', url: '/api/v1/health' });
  assert(health.statusCode === 200, `Fastify /health: 200 (got ${health.statusCode})`);
  assert(health.headers['cache-control'] === 'no-store', `Fastify /health: no-store header (got ${health.headers['cache-control']})`);
  assert(health.json().status === 'ok', 'Fastify /health: status=ok');

  const stations = await app.inject({ method: 'GET', url: '/api/v1/stations' });
  assert(stations.statusCode === 503, `Fastify /stations: 503 with empty cache (got ${stations.statusCode})`);
  assert(stations.headers['cache-control'] === 'no-store', 'Fastify /stations: no-store header even on 503');

  const nearbyBad = await app.inject({ method: 'GET', url: '/api/v1/stations/nearby' });
  assert(nearbyBad.statusCode === 503, `Fastify /stations/nearby: 503 (cache check before param validation) (got ${nearbyBad.statusCode})`);

  const station = await app.inject({ method: 'GET', url: '/api/v1/stations/aaa1' });
  assert(station.statusCode === 503, 'Fastify /stations/:id: 503 with empty cache');

  const cheapest = await app.inject({ method: 'GET', url: '/api/v1/prices/cheapest?fuelType=95' });
  assert(cheapest.statusCode === 503, 'Fastify /prices/cheapest: 503 with empty cache');

  const summary = await app.inject({ method: 'GET', url: '/api/v1/prices/summary' });
  assert(summary.statusCode === 503, 'Fastify /prices/summary: 503 with empty cache');

  const fts = await app.inject({ method: 'GET', url: '/api/v1/meta/fuel-types' });
  assert(fts.statusCode === 503, 'Fastify /meta/fuel-types: 503 with empty cache');
  const ds = await app.inject({ method: 'GET', url: '/api/v1/meta/districts' });
  assert(ds.statusCode === 503, 'Fastify /meta/districts: 503 with empty cache');

  const dashboardOff = await app.inject({ method: 'GET', url: '/' });
  assert(dashboardOff.statusCode === 404, `Fastify /: 404 when DASHBOARD_PASSWORD unset (got ${dashboardOff.statusCode})`);

  const adminNoAuth = await app.inject({ method: 'POST', url: '/api/v1/admin/refresh' });
  assert(adminNoAuth.statusCode === 401, `Fastify admin: 401 without auth (got ${adminNoAuth.statusCode})`);

  const adminBadKey = await app.inject({ method: 'POST', url: '/api/v1/admin/refresh', headers: { 'x-api-key': 'wrong' } });
  assert(adminBadKey.statusCode === 401, 'Fastify admin: 401 with wrong key');
  // Correct key passes auth — what happens after (500 from no real gov site) doesn't matter,
  // we just need to confirm we got past the 401 gate.
  const adminGoodKey = await app.inject({ method: 'POST', url: '/api/v1/admin/refresh', headers: { 'x-api-key': 'test-key' } });
  assert(adminGoodKey.statusCode !== 401, `Fastify admin: correct key passes auth (got ${adminGoodKey.statusCode})`);

  const notFound = await app.inject({ method: 'GET', url: '/no-such-thing' });
  assert(notFound.statusCode === 404, 'Fastify: 404 unknown route');

  await app.close();
  console.log('Fastify routes: OK');
}

// ───── Hono / Workers (with fake KV serving fixture)
{
  const { buildWorkerApp } = await import('../src/worker-app.js');
  const app = buildWorkerApp();

  const kv = {
    get: async (key: string, type?: string) => {
      if (key === 'cache' && type === 'json') return fixture;
      return null;
    },
    put: async () => {},
  };
  const env = {
    KV: kv as unknown as KVNamespace,
    DB: {} as D1Database,
    GOV_URL: 'http://example.com',
    ADMIN_API_KEY: 'test-key',
    DASHBOARD_PASSWORD: '',
    RATE_LIMITER: { limit: async () => ({ success: true }) } as unknown as RateLimit,
    RATE_LIMITER_ADMIN: { limit: async () => ({ success: true }) } as unknown as RateLimit,
  };

  const call = (path: string, init?: RequestInit) =>
    app.fetch(new Request(`http://x${path}`, init), env);

  const health = await call('/api/v1/health');
  assert(health.status === 200, `Hono /health: 200 (got ${health.status})`);
  assert(health.headers.get('cache-control') === 'no-store', `Hono /health: no-store (got ${health.headers.get('cache-control')})`);
  const healthBody = await health.json() as { status: string; cache: { stationCount: number } };
  assert(healthBody.status === 'ok' && healthBody.cache.stationCount === 1, 'Hono /health: cache populated from KV fixture');

  const stations = await call('/api/v1/stations');
  assert(stations.status === 200, `Hono /stations: 200 (got ${stations.status})`);
  const sBody = await stations.json() as { count: number };
  assert(sBody.count === 1, 'Hono /stations: 1 result from KV fixture');
  assert(stations.headers.get('cache-control') === 'no-store', 'Hono /stations: no-store');

  const stationsFiltered = await call('/api/v1/stations?district=Nicosia');
  assert(((await stationsFiltered.json()) as { count: number }).count === 1, 'Hono /stations?district=Nicosia');
  const stationsMiss = await call('/api/v1/stations?district=Paphos');
  assert(((await stationsMiss.json()) as { count: number }).count === 0, 'Hono /stations?district=Paphos: empty');

  const nearby = await call('/api/v1/stations/nearby?lat=35.18&lng=33.38&radius=10');
  assert(nearby.status === 200 && ((await nearby.json()) as { count: number }).count === 1, 'Hono /stations/nearby: hit');
  const nearbyBad = await call('/api/v1/stations/nearby');
  assert(nearbyBad.status === 400, `Hono /stations/nearby: 400 without lat/lng (got ${nearbyBad.status})`);

  const station = await call('/api/v1/stations/aaa1');
  assert(station.status === 200 && ((await station.json()) as { id: string }).id === 'aaa1', 'Hono /stations/:id: hit');
  const station404 = await call('/api/v1/stations/none');
  assert(station404.status === 404, 'Hono /stations/:id: 404 unknown');

  const cheapest = await call('/api/v1/prices/cheapest?fuelType=95');
  assert(cheapest.status === 200, `Hono /prices/cheapest: 200 (got ${cheapest.status})`);
  const cBody = await cheapest.json() as { fuelType: string };
  assert(cBody.fuelType === 'Unleaded 95', 'Hono /prices/cheapest: resolves shorthand');
  const cheapestMissing = await call('/api/v1/prices/cheapest');
  assert(cheapestMissing.status === 400, 'Hono /prices/cheapest: 400 without fuelType');

  const summary = await call('/api/v1/prices/summary');
  assert(summary.status === 200, 'Hono /prices/summary: 200');
  const sumBody = await summary.json() as { byFuelType: unknown[] };
  assert(Array.isArray(sumBody.byFuelType), 'Hono /prices/summary: byFuelType array');

  const fts = await call('/api/v1/meta/fuel-types');
  assert(fts.status === 200 && ((await fts.json()) as { fuelTypes: string[] }).fuelTypes.includes('Unleaded 95'), 'Hono /meta/fuel-types');
  const ds = await call('/api/v1/meta/districts');
  assert(ds.status === 200 && ((await ds.json()) as { districts: string[] }).districts.includes('Nicosia'), 'Hono /meta/districts');

  const adminNoAuth = await call('/api/v1/admin/refresh', { method: 'POST' });
  assert(adminNoAuth.status === 401, `Hono admin: 401 without auth (got ${adminNoAuth.status})`);
  const adminBadKey = await call('/api/v1/admin/refresh', { method: 'POST', headers: { 'x-api-key': 'wrong' } });
  assert(adminBadKey.status === 401, 'Hono admin: 401 with wrong key');
  const adminGoodKey = await call('/api/v1/admin/refresh', { method: 'POST', headers: { 'x-api-key': 'test-key' } });
  assert(adminGoodKey.status !== 401, `Hono admin: correct key passes auth (got ${adminGoodKey.status})`);

  const dashboardOff = await call('/');
  assert(dashboardOff.status === 404, 'Hono /: 404 when DASHBOARD_PASSWORD unset');

  // Dashboard with password set: verify auth gate + security headers on the authed response.
  const envWithDash = { ...env, DASHBOARD_PASSWORD: 'dash-pw' };
  const dashNoAuth = await app.fetch(new Request('http://x/'), envWithDash);
  assert(dashNoAuth.status === 401, 'Hono /: 401 when no creds and dashboard enabled');
  const basicCreds = 'Basic ' + Buffer.from('admin:dash-pw').toString('base64');
  const dashAuthed = await app.fetch(new Request('http://x/', { headers: { Authorization: basicCreds } }), envWithDash);
  assert(dashAuthed.status === 200, `Hono /: 200 with correct basic auth (got ${dashAuthed.status})`);
  assert(dashAuthed.headers.get('x-frame-options') === 'DENY', 'Hono /: X-Frame-Options: DENY');
  assert(dashAuthed.headers.get('x-content-type-options') === 'nosniff', 'Hono /: X-Content-Type-Options: nosniff');
  assert(dashAuthed.headers.get('referrer-policy') === 'no-referrer', 'Hono /: Referrer-Policy: no-referrer');

  console.log('Hono routes: OK');
}

if (failures === 0) console.log('OK — all route smoke tests passed');
else {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
