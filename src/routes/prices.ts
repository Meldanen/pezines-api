import type { FastifyInstance } from 'fastify';
import { getCache } from '../services/cache.service.js';
import { cheapestPrices, pricesSummary } from '../handlers/prices.js';

export async function priceRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/prices/cheapest
  app.get('/api/v1/prices/cheapest', async (request, reply) => {
    const q = request.query as { fuelType?: string; limit?: string; district?: string };
    const r = cheapestPrices(getCache(), {
      fuelType: q.fuelType,
      district: q.district,
      limit: q.limit !== undefined ? Number(q.limit) : undefined,
    });
    return reply.status(r.status).send(r.body);
  });

  // GET /api/v1/prices/summary
  app.get('/api/v1/prices/summary', async (_request, reply) => {
    const r = pricesSummary(getCache());
    return reply.status(r.status).send(r.body);
  });
}
