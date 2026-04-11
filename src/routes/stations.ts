import type { FastifyInstance } from 'fastify';
import { getCache } from '../services/cache.service.js';
import { findNearby } from '../services/geo.service.js';
import { DEFAULT_NEARBY_RADIUS_KM, MAX_NEARBY_RADIUS_KM } from '../utils/constants.js';

export async function stationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/stations
  app.get('/api/v1/stations', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          fuelType: { type: 'string' },
          district: { type: 'string' },
          brand: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const cache = getCache();
      if (!cache) return reply.status(503).send({ error: 'Data not available yet' });

      const { fuelType, district, brand } = request.query as {
        fuelType?: string;
        district?: string;
        brand?: string;
      };

      let stations = cache.stations;

      if (fuelType) {
        stations = stations.filter((s) =>
          s.prices.some((p) => p.fuelType.toLowerCase().includes(fuelType.toLowerCase()))
        );
      }
      if (district) {
        stations = stations.filter((s) =>
          s.location.area.toLowerCase().includes(district.toLowerCase())
        );
      }
      if (brand) {
        stations = stations.filter((s) =>
          s.brand.toLowerCase().includes(brand.toLowerCase())
        );
      }

      reply.header('Cache-Control', 'public, max-age=900');
      return { count: stations.length, scrapedAt: cache.scrapedAt, stations };
    },
  });

  // GET /api/v1/stations/nearby
  app.get('/api/v1/stations/nearby', {
    schema: {
      querystring: {
        type: 'object',
        required: ['lat', 'lng'],
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' },
          radius: { type: 'number', default: DEFAULT_NEARBY_RADIUS_KM },
          fuelType: { type: 'string' },
          sort: { type: 'string', enum: ['distance', 'price'], default: 'distance' },
        },
      },
    },
    handler: async (request, reply) => {
      const cache = getCache();
      if (!cache) return reply.status(503).send({ error: 'Data not available yet' });

      const { lat, lng, radius, fuelType, sort } = request.query as {
        lat: number;
        lng: number;
        radius?: number;
        fuelType?: string;
        sort?: 'distance' | 'price';
      };

      const effectiveRadius = Math.min(radius ?? DEFAULT_NEARBY_RADIUS_KM, MAX_NEARBY_RADIUS_KM);

      // Resolve fuelType name from shorthand
      let resolvedFuelType: string | undefined;
      if (fuelType) {
        resolvedFuelType = cache.fuelTypes.find((ft) =>
          ft.toLowerCase().includes(fuelType.toLowerCase())
        );
      }

      const results = findNearby(
        cache.stations,
        { latitude: lat, longitude: lng },
        effectiveRadius,
        resolvedFuelType,
        sort ?? 'distance'
      );

      reply.header('Cache-Control', 'public, max-age=900');
      return {
        count: results.length,
        center: { lat, lng },
        radiusKm: effectiveRadius,
        scrapedAt: cache.scrapedAt,
        stations: results,
      };
    },
  });

  // GET /api/v1/stations/:stationId
  app.get('/api/v1/stations/:stationId', {
    schema: {
      params: {
        type: 'object',
        required: ['stationId'],
        properties: {
          stationId: { type: 'string' },
        },
      },
    },
    handler: async (request, reply) => {
      const cache = getCache();
      if (!cache) return reply.status(503).send({ error: 'Data not available yet' });

      const { stationId } = request.params as { stationId: string };
      const station = cache.stations.find((s) => s.id === stationId);

      if (!station) return reply.status(404).send({ error: 'Station not found' });

      reply.header('Cache-Control', 'public, max-age=900');
      return station;
    },
  });
}
