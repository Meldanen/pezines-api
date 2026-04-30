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
import { DASHBOARD_HTML } from './ui/dashboard.js';
import { checkBasicAuth } from './utils/auth.js';
import { config } from './config.js';

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

  // Dashboard. Disabled (404) unless DASHBOARD_PASSWORD is set; otherwise basic-auth gated.
  // compress: false — fastify/compress mis-encodes static HTML strings.
  app.get('/', { compress: false } as never, async (req, reply) => {
    const pw = config.DASHBOARD_PASSWORD;
    if (!pw) return reply.callNotFound();
    if (!checkBasicAuth(req.headers.authorization, pw)) {
      return reply
        .code(401)
        .header('WWW-Authenticate', 'Basic realm="pezines"')
        .send('Authentication required');
    }
    reply.type('text/html; charset=utf-8').send(DASHBOARD_HTML);
  });

  return app;
}
