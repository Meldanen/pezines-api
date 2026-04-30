import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { refreshCache } from '../services/cache.service.js';
import { checkBasicAuth } from '../utils/auth.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/admin/refresh
  app.post('/api/v1/admin/refresh', {
    handler: async (request, reply) => {
      const apiKey = (request.headers as Record<string, string>)['x-api-key'];
      const dashPw = config.DASHBOARD_PASSWORD;
      const authed =
        apiKey === config.ADMIN_API_KEY ||
        (!!dashPw && checkBasicAuth(request.headers.authorization, dashPw));

      if (!authed) {
        return reply.status(401).send({ error: 'Invalid API key' });
      }

      try {
        const data = await refreshCache();
        return {
          message: 'Cache refreshed successfully',
          stationCount: data.stations.length,
          scrapedAt: data.scrapedAt,
        };
      } catch (err) {
        return reply.status(500).send({
          error: 'Refresh failed',
          message: (err as Error).message,
        });
      }
    },
  });
}
