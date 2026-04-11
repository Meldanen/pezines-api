import type { FastifyInstance } from 'fastify';
import { getCache } from '../services/cache.service.js';

export async function metaRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/meta/fuel-types
  app.get('/api/v1/meta/fuel-types', {
    handler: async (_request, reply) => {
      const cache = getCache();
      if (!cache) return reply.status(503).send({ error: 'Data not available yet' });

      reply.header('Cache-Control', 'public, max-age=3600');
      return { fuelTypes: cache.fuelTypes };
    },
  });

  // GET /api/v1/meta/districts
  app.get('/api/v1/meta/districts', {
    handler: async (_request, reply) => {
      const cache = getCache();
      if (!cache) return reply.status(503).send({ error: 'Data not available yet' });

      reply.header('Cache-Control', 'public, max-age=3600');
      return { districts: cache.districts };
    },
  });
}
