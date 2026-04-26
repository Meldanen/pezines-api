import { Hono } from 'hono';
import { cors } from 'hono/cors';
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
