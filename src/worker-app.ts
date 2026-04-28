import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { cache } from 'hono/cache';
import type { Env } from './config.worker.js';
import { stations } from './routes-worker/stations.js';
import { prices } from './routes-worker/prices.js';
import { meta } from './routes-worker/meta.js';
import { health } from './routes-worker/health.js';
import { admin } from './routes-worker/admin.js';
import { history } from './routes-worker/history.js';

export function buildWorkerApp() {
  const app = new Hono<{ Bindings: Env }>();

  // CORS
  app.use('*', cors());

  // Edge cache GET /api/v1/* (skips route handler + KV/D1 on hit).
  app.get(
    '/api/v1/*',
    cache({ cacheName: 'pezines-api', cacheControl: 'public, max-age=300' })
  );

  // Per-IP rate limit on cache misses. Skips admin (auth-gated) and health.
  app.use('/api/v1/*', async (c, next) => {
    const path = c.req.path;
    if (path.startsWith('/api/v1/admin') || path === '/api/v1/health') return next();
    const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
    const { success } = await c.env.RATE_LIMITER.limit({ key: ip });
    if (!success) return c.json({ error: 'Too Many Requests' }, 429);
    return next();
  });

  // Routes
  app.route('/', stations);
  app.route('/', prices);
  app.route('/', meta);
  app.route('/', health);
  app.route('/', admin);
  app.route('/', history);

  // 404
  app.notFound((c) =>
    c.json({ error: 'Not Found', message: 'The requested resource does not exist', statusCode: 404 }, 404)
  );

  // Error handler
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.name ?? 'Error', message: err.message, statusCode: 500 }, 500);
  });

  return app;
}
