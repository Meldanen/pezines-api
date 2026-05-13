// Smoke test for the extracted handlers. Run with: npx tsx scripts/smoke.ts
// Builds a fake CacheData fixture and exercises every handler, asserting
// shape, status, filtering, sorting, and edge cases.

import { getStation, listStations, nearbyStations } from '../src/handlers/stations.js';
import { cheapestPrices, pricesSummary } from '../src/handlers/prices.js';
import { metaDistricts, metaFuelTypes } from '../src/handlers/meta.js';
import type { CacheData, Station } from '../src/models/types.js';

let failures = 0;
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${msg}`);
  }
}
function eq<T>(actual: T, expected: T, msg: string): void {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

// Cyprus-ish coordinates so haversine returns sensible distances.
// NB: Limassol is >50km from Nicosia in reality; the clamp test below uses Larnaca.
const NICOSIA = { latitude: 35.1856, longitude: 33.3823 };
const LIMASSOL = { latitude: 34.6841, longitude: 33.0379 }; // ~75km from Nicosia
const LARNACA = { latitude: 34.9229, longitude: 33.6233 };  // ~40km from Nicosia

const stations: Station[] = [
  {
    id: 'aaa1',
    brand: 'EKO',
    name: 'EKO Nicosia 1',
    location: { address: 'addr1', area: 'Nicosia', coordinates: NICOSIA },
    prices: [
      { fuelType: 'Unleaded 95', price: 1.5 },
      { fuelType: 'Diesel', price: 1.4 },
    ],
  },
  {
    id: 'bbb2',
    brand: 'BP',
    name: 'BP Limassol',
    location: { address: 'addr2', area: 'Limassol', coordinates: LIMASSOL },
    prices: [
      { fuelType: 'Unleaded 95', price: 1.45 },
      { fuelType: 'Unleaded 98', price: 1.7 },
    ],
  },
  {
    id: 'ccc3',
    brand: 'Petrolina',
    name: 'Petrolina Larnaca',
    location: { address: 'addr3', area: 'Larnaca', coordinates: LARNACA },
    prices: [
      { fuelType: 'Unleaded 95', price: 1.55 },
      { fuelType: 'Diesel', price: 1.42 },
    ],
  },
];

const cache: CacheData = {
  stations,
  scrapedAt: '2026-05-13T10:00:00Z',
  fuelTypes: ['Diesel', 'Unleaded 95', 'Unleaded 98'],
  districts: ['Larnaca', 'Limassol', 'Nicosia'],
};

// ───── listStations
{
  const r = listStations(cache, {});
  eq(r.status, 200, 'listStations: 200');
  assert(
    r.body && typeof r.body === 'object' && 'stations' in r.body && r.body.stations.length === 3,
    'listStations: returns all 3'
  );
}
{
  const r = listStations(cache, { district: 'limass' }); // substring
  assert(
    r.body && 'stations' in r.body && r.body.stations.length === 1 && r.body.stations[0]!.id === 'bbb2',
    'listStations: district substring match (case-insensitive)'
  );
}
{
  const r = listStations(cache, { fuelType: '98' });
  assert(
    r.body && 'stations' in r.body && r.body.stations.length === 1 && r.body.stations[0]!.id === 'bbb2',
    'listStations: fuelType substring filters to bbb2'
  );
}
{
  const r = listStations(cache, { brand: 'bp' });
  assert(
    r.body && 'stations' in r.body && r.body.stations.length === 1 && r.body.stations[0]!.id === 'bbb2',
    'listStations: brand match'
  );
}
{
  const r = listStations(null, {});
  eq(r.status, 503, 'listStations: 503 on null cache');
}

// ───── nearbyStations
{
  const r = nearbyStations(cache, { lat: NICOSIA.latitude, lng: NICOSIA.longitude, radius: 10 });
  assert(
    r.status === 200 && r.body && 'stations' in r.body && r.body.stations.length === 1 && r.body.stations[0]!.id === 'aaa1',
    'nearbyStations: 10km of Nicosia matches only EKO Nicosia'
  );
}
{
  // radius:100 → clamp:50 → only Nicosia + Larnaca match (Limassol is ~75km from Nicosia).
  const r = nearbyStations(cache, { lat: NICOSIA.latitude, lng: NICOSIA.longitude, radius: 100 });
  assert(
    r.status === 200 && r.body && 'stations' in r.body && r.body.stations.length === 2,
    'nearbyStations: radius clamped at 50km picks Nicosia + Larnaca'
  );
  const ids = r.status === 200 && r.body && 'stations' in r.body ? r.body.stations.map((s) => s.id).sort() : [];
  eq(ids, ['aaa1', 'ccc3'], 'nearbyStations: clamped-radius result contains Nicosia + Larnaca only');
}
{
  const r = nearbyStations(cache, { lat: undefined, lng: undefined });
  eq(r.status, 400, 'nearbyStations: 400 when lat/lng missing');
}
{
  const r = nearbyStations(cache, { lat: Number('abc'), lng: 33 });
  eq(r.status, 400, 'nearbyStations: 400 when lat is NaN');
}
{
  // Within 50km of Nicosia: aaa1 (1.5) and ccc3 (1.55). Price-asc → aaa1 first.
  const r = nearbyStations(cache, { lat: NICOSIA.latitude, lng: NICOSIA.longitude, radius: 100, fuelType: '95', sort: 'price' });
  assert(
    r.status === 200 &&
      r.body && 'stations' in r.body &&
      r.body.stations.length === 2 &&
      r.body.stations[0]!.id === 'aaa1' &&
      r.body.stations[1]!.id === 'ccc3',
    'nearbyStations: sort=price orders by price ascending within radius'
  );
}
{
  const r = nearbyStations(cache, { lat: NICOSIA.latitude, lng: NICOSIA.longitude, radius: 9999 });
  assert(
    r.status === 200 && r.body && 'radiusKm' in r.body && r.body.radiusKm === 50,
    'nearbyStations: radius clamped to MAX_NEARBY_RADIUS_KM (50)'
  );
}

// ───── getStation
{
  const r = getStation(cache, 'bbb2');
  assert(r.status === 200 && r.body && 'id' in r.body && r.body.id === 'bbb2', 'getStation: hit');
}
{
  const r = getStation(cache, 'nonesuch');
  eq(r.status, 404, 'getStation: 404 on unknown id');
}
{
  const r = getStation(null, 'bbb2');
  eq(r.status, 503, 'getStation: 503 on null cache');
}

// ───── cheapestPrices
{
  const r = cheapestPrices(cache, { fuelType: '95' });
  assert(
    r.status === 200 && r.body && 'stations' in r.body &&
      r.body.stations.length === 3 &&
      r.body.stations[0]!.id === 'bbb2' && r.body.stations[0]!.price === 1.45 &&
      r.body.stations[2]!.id === 'ccc3' && r.body.stations[2]!.price === 1.55,
    'cheapestPrices: sorted ascending by price'
  );
}
{
  const r = cheapestPrices(cache, { fuelType: '95', limit: 1 });
  assert(
    r.status === 200 && r.body && 'stations' in r.body && r.body.stations.length === 1,
    'cheapestPrices: limit honoured'
  );
}
{
  const r = cheapestPrices(cache, { fuelType: '95', limit: 0 });
  assert(
    r.status === 200 && r.body && 'stations' in r.body && r.body.stations.length === 0,
    'cheapestPrices: limit=0 returns empty (behaviour change vs old code)'
  );
}
{
  const r = cheapestPrices(cache, { fuelType: '95', limit: 1000 });
  assert(
    r.status === 200 && r.body && 'stations' in r.body && r.body.stations.length === 3,
    'cheapestPrices: limit clamped at MAX_CHEAPEST_LIMIT and returns all available'
  );
}
{
  const r = cheapestPrices(cache, { fuelType: 'made-up' });
  assert(
    r.status === 400 && r.body && 'available' in r.body,
    'cheapestPrices: 400 with `available` for unknown fuel type'
  );
}
{
  const r = cheapestPrices(cache, {});
  eq(r.status, 400, 'cheapestPrices: 400 when fuelType missing');
}
{
  const r = cheapestPrices(cache, { fuelType: '95', district: 'nicosia' });
  assert(
    r.status === 200 && r.body && 'stations' in r.body && r.body.stations.length === 1 && r.body.stations[0]!.id === 'aaa1',
    'cheapestPrices: district filter'
  );
}

// ───── pricesSummary
{
  const r = pricesSummary(cache);
  assert(r.status === 200 && r.body && 'byFuelType' in r.body, 'pricesSummary: shape');
  const u95 = r.body && 'byFuelType' in r.body ? r.body.byFuelType.find((x) => x.fuelType === 'Unleaded 95') : undefined;
  assert(u95?.stationCount === 3, 'pricesSummary: 3 U95 stations');
  assert(u95?.min === 1.45 && u95?.max === 1.55, 'pricesSummary: U95 min/max');
  // avg(1.5, 1.45, 1.55) = 1.5 → round3 = 1.5
  assert(u95?.avg === 1.5, 'pricesSummary: U95 avg rounded to 3dp');
  // byDistrict should include U95 entries for each populated district
  const nic95 = r.body && 'byDistrict' in r.body ? r.body.byDistrict.find((x) => x.district === 'Nicosia' && x.fuelType === 'Unleaded 95') : undefined;
  assert(nic95?.avg === 1.5, 'pricesSummary: Nicosia U95 avg');
}

// ───── meta
{
  const r = metaFuelTypes(cache);
  assert(r.status === 200 && r.body && 'fuelTypes' in r.body && r.body.fuelTypes.length === 3, 'metaFuelTypes: 3 types');
}
{
  const r = metaDistricts(cache);
  assert(r.status === 200 && r.body && 'districts' in r.body && r.body.districts.length === 3, 'metaDistricts: 3 districts');
}
{
  eq(metaFuelTypes(null).status, 503, 'metaFuelTypes: 503 on null cache');
  eq(metaDistricts(null).status, 503, 'metaDistricts: 503 on null cache');
}

if (failures === 0) console.log('OK — all handler smoke tests passed');
else {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
