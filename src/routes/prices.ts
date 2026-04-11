import type { FastifyInstance } from 'fastify';
import { getCache } from '../services/cache.service.js';
import { DEFAULT_CHEAPEST_LIMIT, MAX_CHEAPEST_LIMIT } from '../utils/constants.js';
import type { PriceSummaryItem, DistrictSummaryItem } from '../models/types.js';

export async function priceRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/prices/cheapest
  app.get('/api/v1/prices/cheapest', {
    schema: {
      querystring: {
        type: 'object',
        required: ['fuelType'],
        properties: {
          fuelType: { type: 'string' },
          limit: { type: 'integer', default: DEFAULT_CHEAPEST_LIMIT },
          district: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const cache = getCache();
      if (!cache) return reply.status(503).send({ error: 'Data not available yet' });

      const { fuelType, limit, district } = request.query as {
        fuelType: string;
        limit?: number;
        district?: string;
      };

      const resolvedFuelType = cache.fuelTypes.find((ft) =>
        ft.toLowerCase().includes(fuelType.toLowerCase())
      );

      if (!resolvedFuelType) {
        return reply.status(400).send({
          error: 'Unknown fuel type',
          available: cache.fuelTypes,
        });
      }

      let stations = cache.stations.filter((s) =>
        s.prices.some((p) => p.fuelType === resolvedFuelType)
      );

      if (district) {
        stations = stations.filter((s) =>
          s.location.area.toLowerCase().includes(district.toLowerCase())
        );
      }

      const sorted = stations
        .map((s) => ({
          ...s,
          price: s.prices.find((p) => p.fuelType === resolvedFuelType)!.price,
        }))
        .sort((a, b) => a.price - b.price)
        .slice(0, Math.min(limit ?? DEFAULT_CHEAPEST_LIMIT, MAX_CHEAPEST_LIMIT));

      reply.header('Cache-Control', 'public, max-age=900');
      return {
        fuelType: resolvedFuelType,
        count: sorted.length,
        scrapedAt: cache.scrapedAt,
        stations: sorted,
      };
    },
  });

  // GET /api/v1/prices/summary
  app.get('/api/v1/prices/summary', {
    handler: async (request, reply) => {
      const cache = getCache();
      if (!cache) return reply.status(503).send({ error: 'Data not available yet' });

      const byFuelType: PriceSummaryItem[] = [];
      const byDistrict: DistrictSummaryItem[] = [];

      for (const fuelType of cache.fuelTypes) {
        const prices = cache.stations
          .flatMap((s) => s.prices.filter((p) => p.fuelType === fuelType).map((p) => p.price));

        if (prices.length === 0) continue;

        byFuelType.push({
          fuelType,
          avg: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 1000) / 1000,
          min: Math.min(...prices),
          max: Math.max(...prices),
          stationCount: prices.length,
        });

        // Per-district breakdown
        for (const district of cache.districts) {
          const distPrices = cache.stations
            .filter((s) => s.location.area === district)
            .flatMap((s) => s.prices.filter((p) => p.fuelType === fuelType).map((p) => p.price));

          if (distPrices.length === 0) continue;

          byDistrict.push({
            fuelType,
            district,
            avg: Math.round((distPrices.reduce((a, b) => a + b, 0) / distPrices.length) * 1000) / 1000,
            min: Math.min(...distPrices),
            max: Math.max(...distPrices),
            stationCount: distPrices.length,
          });
        }
      }

      reply.header('Cache-Control', 'public, max-age=900');
      return { scrapedAt: cache.scrapedAt, byFuelType, byDistrict };
    },
  });
}
