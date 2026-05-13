import type { FastifyInstance } from 'fastify';
import { getCache } from '../services/cache.service.js';
import { metaDistricts, metaFuelTypes } from '../handlers/meta.js';

export async function metaRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/meta/fuel-types
  app.get('/api/v1/meta/fuel-types', async (_request, reply) => {
    const r = metaFuelTypes(getCache());
    return reply.status(r.status).send(r.body);
  });

  // GET /api/v1/meta/districts
  app.get('/api/v1/meta/districts', async (_request, reply) => {
    const r = metaDistricts(getCache());
    return reply.status(r.status).send(r.body);
  });
}
