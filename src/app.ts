import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import compress from '@fastify/compress';

import { errorHandlerPlugin } from './plugins/error-handler.plugin.js';
import { stationRoutes } from './routes/stations.js';
import { priceRoutes } from './routes/prices.js';
import { metaRoutes } from './routes/meta.js';
import { healthRoutes } from './routes/health.js';
import { adminRoutes } from './routes/admin.js';

export async function buildApp() {
  const isProd = process.env.NODE_ENV === 'production';
  const app = Fastify({
    logger: isProd
      ? true
      : {
          transport: {
            target: 'pino-pretty',
            options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
          },
        },
  });

  // Plugins
  await app.register(cors, { origin: true });
  await app.register(compress);
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });
  await app.register(errorHandlerPlugin);

  // Routes
  await app.register(stationRoutes);
  await app.register(priceRoutes);
  await app.register(metaRoutes);
  await app.register(healthRoutes);
  await app.register(adminRoutes);

  return app;
}
