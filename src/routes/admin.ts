import type { FastifyInstance } from 'fastify';
import { config } from '../config.js';
import { refreshCache } from '../services/cache.service.js';

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/admin/refresh
  app.post('/api/v1/admin/refresh', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-api-key'],
        properties: {
          'x-api-key': { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const apiKey = (request.headers as Record<string, string>)['x-api-key'];

      if (apiKey !== config.ADMIN_API_KEY) {
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
