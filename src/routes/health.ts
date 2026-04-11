import type { FastifyInstance } from 'fastify';
import { getCache, isCacheStale } from '../services/cache.service.js';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  const startTime = Date.now();

  // GET /api/v1/health
  app.get('/api/v1/health', {
    handler: async () => {
      const cache = getCache();
      return {
        status: 'ok',
        uptime: Math.round((Date.now() - startTime) / 1000),
        cache: {
          populated: cache !== null,
          stationCount: cache?.stations.length ?? 0,
          scrapedAt: cache?.scrapedAt ?? null,
          staleTTL: isCacheStale(),
        },
      };
    },
  });
}
