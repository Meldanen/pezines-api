import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './config.worker.js';
import { stations } from './routes-worker/stations.js';
import { prices } from './routes-worker/prices.js';
import { meta } from './routes-worker/meta.js';
import { health } from './routes-worker/health.js';
import { admin } from './routes-worker/admin.js';
import { history } from './routes-worker/history.js';
import { DASHBOARD_HTML } from './ui/dashboard.js';
import { checkBasicAuth } from './utils/auth.js';

export function buildWorkerApp() {
  const app = new Hono<{ Bindings: Env }>();

  // CORS
  app.use('*', cors());

  // Dashboard. Disabled (404) unless DASHBOARD_PASSWORD is set; otherwise basic-auth gated.
  app.get('/', (c) => {
    const pw = c.env.DASHBOARD_PASSWORD;
    if (!pw) return c.notFound();
    if (!checkBasicAuth(c.req.header('Authorization'), pw)) {
      return new Response('Authentication required', {
        status: 401,
        headers: { 'WWW-Authenticate': 'Basic realm="pezines"' },
      });
    }
    return c.html(DASHBOARD_HTML);
  });

  // Tell the mobile app's HTTP layer not to silently cache — clients should manage caching deliberately.
  app.use('/api/v1/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });

  // Per-IP rate limit. Skips admin (auth-gated) and health.
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
