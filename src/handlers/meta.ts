import type { CacheData } from '../models/types.js';
import type { ErrorBody, HandlerResponse } from './types.js';

const dataNotAvailable: HandlerResponse<ErrorBody> = {
  status: 503,
  body: { error: 'Data not available yet' },
};

export function metaFuelTypes(cache: CacheData | null): HandlerResponse<{ fuelTypes: string[] } | ErrorBody> {
  if (!cache) return dataNotAvailable;
  return { status: 200, body: { fuelTypes: cache.fuelTypes } };
}

export function metaDistricts(cache: CacheData | null): HandlerResponse<{ districts: string[] } | ErrorBody> {
  if (!cache) return dataNotAvailable;
  return { status: 200, body: { districts: cache.districts } };
}
