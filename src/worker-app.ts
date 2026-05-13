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
    c.header('Cache-Control', 'no-store');
    // Defense against clickjacking the authenticated /admin/refresh button.
    c.header('X-Frame-Options', 'DENY');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    return c.html(DASHBOARD_HTML);
  });

  // Tell the mobile app's HTTP layer not to silently cache — clients should manage caching deliberately.
  app.use('/api/v1/*', async (c, next) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });

  // Per-IP rate limit.
  //  - /api/v1/admin/*  → tight bucket (5/min) for brute-force protection on ADMIN_API_KEY
  //  - /api/v1/health   → unrestricted (used by uptime checks)
  //  - everything else  → 60/min
  app.use('/api/v1/*', async (c, next) => {
    const path = c.req.path;
    if (path === '/api/v1/health') return next();
    const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
    const limiter = path.startsWith('/api/v1/admin') ? c.env.RATE_LIMITER_ADMIN : c.env.RATE_LIMITER;
    const { success } = await limiter.limit({ key: ip });
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

  // Error handler — log full error server-side, return generic message to client.
  app.onError((err, c) => {
    console.error('[onError]', err);
    return c.json({ error: 'Internal Server Error', statusCode: 500 }, 500);
  });

  return app;
}
