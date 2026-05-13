import type { FastifyInstance } from 'fastify';
import { getCache } from '../services/cache.service.js';
import { getStation, listStations, nearbyStations } from '../handlers/stations.js';

export async function stationRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/v1/stations
  app.get('/api/v1/stations', async (request, reply) => {
    const q = request.query as { fuelType?: string; district?: string; brand?: string };
    const r = listStations(getCache(), {
      fuelType: q.fuelType,
      district: q.district,
      brand: q.brand,
    });
    return reply.status(r.status).send(r.body);
  });

  // GET /api/v1/stations/nearby
  app.get('/api/v1/stations/nearby', async (request, reply) => {
    const q = request.query as {
      lat?: string;
      lng?: string;
      radius?: string;
      fuelType?: string;
      sort?: string;
    };
    const sort = q.sort === 'price' || q.sort === 'distance' ? q.sort : undefined;
    const r = nearbyStations(getCache(), {
      lat: q.lat !== undefined ? Number(q.lat) : undefined,
      lng: q.lng !== undefined ? Number(q.lng) : undefined,
      radius: q.radius !== undefined ? Number(q.radius) : undefined,
      fuelType: q.fuelType,
      sort,
    });
    return reply.status(r.status).send(r.body);
  });

  // GET /api/v1/stations/:stationId
  app.get('/api/v1/stations/:stationId', async (request, reply) => {
    const { stationId } = request.params as { stationId: string };
    const r = getStation(getCache(), stationId);
    return reply.status(r.status).send(r.body);
  });
}
