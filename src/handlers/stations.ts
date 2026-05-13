import { findNearby } from '../services/geo.service.js';
import { DEFAULT_NEARBY_RADIUS_KM, MAX_NEARBY_RADIUS_KM } from '../utils/constants.js';
import type { CacheData, Station, StationWithDistance } from '../models/types.js';
import type { ErrorBody, HandlerResponse } from './types.js';

const dataNotAvailable: HandlerResponse<ErrorBody> = {
  status: 503,
  body: { error: 'Data not available yet' },
};

function includesCI(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export interface ListStationsParams {
  fuelType?: string;
  district?: string;
  brand?: string;
}

export interface ListStationsBody {
  count: number;
  scrapedAt: string;
  stations: Station[];
}

export function listStations(
  cache: CacheData | null,
  params: ListStationsParams
): HandlerResponse<ListStationsBody | ErrorBody> {
  if (!cache) return dataNotAvailable;

  let stations = cache.stations;
  if (params.fuelType) {
    stations = stations.filter((s) => s.prices.some((p) => includesCI(p.fuelType, params.fuelType!)));
  }
  if (params.district) {
    stations = stations.filter((s) => includesCI(s.location.area, params.district!));
  }
  if (params.brand) {
    stations = stations.filter((s) => includesCI(s.brand, params.brand!));
  }

  return {
    status: 200,
    body: { count: stations.length, scrapedAt: cache.scrapedAt, stations },
  };
}

export interface NearbyStationsParams {
  lat?: number;
  lng?: number;
  radius?: number;
  fuelType?: string;
  sort?: 'distance' | 'price';
}

export interface NearbyStationsBody {
  count: number;
  center: { lat: number; lng: number };
  radiusKm: number;
  scrapedAt: string;
  stations: StationWithDistance[];
}

export function nearbyStations(
  cache: CacheData | null,
  params: NearbyStationsParams
): HandlerResponse<NearbyStationsBody | ErrorBody> {
  if (!cache) return dataNotAvailable;

  const { lat, lng } = params;
  if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { status: 400, body: { error: 'lat and lng are required' } };
  }

  const radius = Math.min(params.radius ?? DEFAULT_NEARBY_RADIUS_KM, MAX_NEARBY_RADIUS_KM);
  const sort = params.sort ?? 'distance';

  const resolvedFuelType = params.fuelType
    ? cache.fuelTypes.find((ft) => includesCI(ft, params.fuelType!))
    : undefined;

  const results = findNearby(
    cache.stations,
    { latitude: lat, longitude: lng },
    radius,
    resolvedFuelType,
    sort
  );

  return {
    status: 200,
    body: {
      count: results.length,
      center: { lat, lng },
      radiusKm: radius,
      scrapedAt: cache.scrapedAt,
      stations: results,
    },
  };
}

export function getStation(
  cache: CacheData | null,
  stationId: string
): HandlerResponse<Station | ErrorBody> {
  if (!cache) return dataNotAvailable;
  const station = cache.stations.find((s) => s.id === stationId);
  if (!station) return { status: 404, body: { error: 'Station not found' } };
  return { status: 200, body: station };
}
