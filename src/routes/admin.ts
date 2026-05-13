import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { refreshCache } from '../services/cache.service.js';
import { checkBasicAuth, timingSafeEqual } from '../utils/auth.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/admin/refresh
  app.post('/api/v1/admin/refresh', {
    handler: async (request, reply) => {
      const apiKeyHeader = request.headers['x-api-key'];
      const apiKey = (Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader) ?? '';
      const dashPw = config.DASHBOARD_PASSWORD;
      const authed =
        timingSafeEqual(apiKey, config.ADMIN_API_KEY) ||
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
        request.log.error(err, '[admin/refresh] cache refresh failed');
        return reply.status(500).send({ error: 'Refresh failed' });
      }
    },
  });
}
