import { EARTH_RADIUS_KM } from '../utils/constants.js';
import type { Station, StationWithDistance, Coordinates } from '../models/types.js';

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function haversine(a: Coordinates, b: Coordinates): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function findNearby(
  stations: Station[],
  center: Coordinates,
  radiusKm: number,
  fuelType?: string,
  sort: 'distance' | 'price' = 'distance'
): StationWithDistance[] {
  // Bounding box pre-filter (~1 degree lat ≈ 111km)
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(toRad(center.latitude)));

  const minLat = center.latitude - latDelta;
  const maxLat = center.latitude + latDelta;
  const minLng = center.longitude - lngDelta;
  const maxLng = center.longitude + lngDelta;

  const results: StationWithDistance[] = [];

  for (const station of stations) {
    const { latitude, longitude } = station.location.coordinates;

    // Bounding box check
    if (latitude < minLat || latitude > maxLat || longitude < minLng || longitude > maxLng) {
      continue;
    }

    // Filter by fuel type if specified
    if (fuelType && !station.prices.some((p) => p.fuelType === fuelType)) {
      continue;
    }

    const distance = haversine(center, station.location.coordinates);
    if (distance <= radiusKm) {
      results.push({ ...station, distance: Math.round(distance * 100) / 100 });
    }
  }

  if (sort === 'price' && fuelType) {
    results.sort((a, b) => {
      const priceA = a.prices.find((p) => p.fuelType === fuelType)?.price ?? Infinity;
      const priceB = b.prices.find((p) => p.fuelType === fuelType)?.price ?? Infinity;
      return priceA - priceB || a.distance - b.distance;
    });
  } else {
    results.sort((a, b) => a.distance - b.distance);
  }

  return results;
}
