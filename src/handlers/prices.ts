import { DEFAULT_CHEAPEST_LIMIT, MAX_CHEAPEST_LIMIT } from '../utils/constants.js';
import type {
  CacheData,
  DistrictSummaryItem,
  PriceSummaryItem,
  Station,
} from '../models/types.js';
import type { ErrorBody, HandlerResponse } from './types.js';

const dataNotAvailable: HandlerResponse<ErrorBody> = {
  status: 503,
  body: { error: 'Data not available yet' },
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function avg(values: number[]): number {
  return round3(values.reduce((a, b) => a + b, 0) / values.length);
}

export interface CheapestParams {
  fuelType?: string;
  limit?: number;
  district?: string;
}

export interface CheapestBody {
  fuelType: string;
  count: number;
  scrapedAt: string;
  stations: (Station & { price: number })[];
}

export function cheapestPrices(
  cache: CacheData | null,
  params: CheapestParams
): HandlerResponse<CheapestBody | ErrorBody> {
  if (!cache) return dataNotAvailable;
  if (!params.fuelType) return { status: 400, body: { error: 'fuelType is required' } };

  const resolvedFuelType = cache.fuelTypes.find((ft) =>
    ft.toLowerCase().includes(params.fuelType!.toLowerCase())
  );
  if (!resolvedFuelType) {
    return { status: 400, body: { error: 'Unknown fuel type', available: cache.fuelTypes } };
  }

  let stations = cache.stations.filter((s) =>
    s.prices.some((p) => p.fuelType === resolvedFuelType)
  );
  if (params.district) {
    stations = stations.filter((s) =>
      s.location.area.toLowerCase().includes(params.district!.toLowerCase())
    );
  }

  const limit = Math.min(params.limit ?? DEFAULT_CHEAPEST_LIMIT, MAX_CHEAPEST_LIMIT);
  const sorted = stations
    .map((s) => ({ ...s, price: s.prices.find((p) => p.fuelType === resolvedFuelType)!.price }))
    .sort((a, b) => a.price - b.price)
    .slice(0, limit);

  return {
    status: 200,
    body: {
      fuelType: resolvedFuelType,
      count: sorted.length,
      scrapedAt: cache.scrapedAt,
      stations: sorted,
    },
  };
}

export interface SummaryBody {
  scrapedAt: string;
  byFuelType: PriceSummaryItem[];
  byDistrict: DistrictSummaryItem[];
}

export function pricesSummary(cache: CacheData | null): HandlerResponse<SummaryBody | ErrorBody> {
  if (!cache) return dataNotAvailable;

  const byFuelType: PriceSummaryItem[] = [];
  const byDistrict: DistrictSummaryItem[] = [];

  for (const fuelType of cache.fuelTypes) {
    const prices = cache.stations.flatMap((s) =>
      s.prices.filter((p) => p.fuelType === fuelType).map((p) => p.price)
    );
    if (prices.length === 0) continue;

    byFuelType.push({
      fuelType,
      avg: avg(prices),
      min: Math.min(...prices),
      max: Math.max(...prices),
      stationCount: prices.length,
    });

    for (const district of cache.districts) {
      const distPrices = cache.stations
        .filter((s) => s.location.area === district)
        .flatMap((s) => s.prices.filter((p) => p.fuelType === fuelType).map((p) => p.price));
      if (distPrices.length === 0) continue;

      byDistrict.push({
        fuelType,
        district,
        avg: avg(distPrices),
        min: Math.min(...distPrices),
        max: Math.max(...distPrices),
        stationCount: distPrices.length,
      });
    }
  }

  return { status: 200, body: { scrapedAt: cache.scrapedAt, byFuelType, byDistrict } };
}
