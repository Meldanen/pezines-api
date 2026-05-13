import { parseStationsHtml } from './html-parser.service.js';
import { FUEL_TYPE_MAP } from '../utils/constants.js';
import type { Station, ScrapeResult, SessionTokens } from '../models/types.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function generateStationId(brand: string, name: string, lat: number, lng: number): Promise<string> {
  const input = `${brand}|${name}|${lat}|${lng}`;
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

export interface ScrapeOptions {
  getSession: () => Promise<SessionTokens>;
  refreshSession: () => Promise<SessionTokens>;
  govUrl: string;
}

async function postFuelType(govUrl: string, fuelTypeId: number, session: SessionTokens): Promise<Response> {
  const body = new URLSearchParams();
  body.append('Entity.PetroleumType', String(fuelTypeId));
  body.append('Entity.StationCityEnum', 'All');
  body.append('__RequestVerificationToken', session.verificationToken);

  return fetch(govUrl, {
    method: 'POST',
    headers: {
      Cookie: session.cookies,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: body.toString(),
    redirect: 'follow',
  });
}

async function scrapeFuelType(fuelTypeId: number, opts: ScrapeOptions): Promise<ScrapeResult> {
  let session = await opts.getSession();
  let response = await postFuelType(opts.govUrl, fuelTypeId, session);

  // 403/302 = session likely expired (CSRF rejected or login redirect). Refresh and retry once.
  if (response.status === 403 || response.status === 302) {
    session = await opts.refreshSession();
    response = await postFuelType(opts.govUrl, fuelTypeId, session);
  }
  if (!response.ok) {
    throw new Error(`Scrape POST failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const stations = parseStationsHtml(html);
  return {
    fuelType: FUEL_TYPE_MAP[fuelTypeId] ?? `Unknown (${fuelTypeId})`,
    fuelTypeId,
    stations,
  };
}

async function mergeResults(results: ScrapeResult[]): Promise<Station[]> {
  const stationMap = new Map<string, Station>();
  const idCache = new Map<string, string>();

  for (const result of results) {
    for (const raw of result.stations) {
      const key = `${raw.brand}|${raw.name}|${raw.location.coordinates.latitude}|${raw.location.coordinates.longitude}`;
      let id = idCache.get(key);
      if (!id) {
        id = await generateStationId(
          raw.brand,
          raw.name,
          raw.location.coordinates.latitude,
          raw.location.coordinates.longitude
        );
        idCache.set(key, id);
      }

      let station = stationMap.get(id);
      if (!station) {
        station = {
          id,
          brand: raw.brand,
          name: raw.name,
          location: raw.location,
          prices: [],
        };
        stationMap.set(id, station);
      }

      station.prices.push({
        fuelType: result.fuelType,
        price: raw.price,
      });
    }
  }

  return Array.from(stationMap.values());
}

export async function scrapeAll(opts: ScrapeOptions): Promise<Station[]> {
  console.log('[scraper] Starting full scrape of all fuel types...');
  const results: ScrapeResult[] = [];
  const errors: string[] = [];

  // Sequential by design: the gov site shares one CSRF session across requests
  // and rejects concurrent POSTs from the same token. Don't parallelise.
  for (let id = 1; id <= 5; id++) {
    try {
      const result = await scrapeFuelType(id, opts);
      results.push(result);
      console.log(`[scraper] Fuel type ${FUEL_TYPE_MAP[id]}: ${result.stations.length} stations`);
    } catch (err) {
      const msg = (err as Error).message;
      errors.push(`${FUEL_TYPE_MAP[id] ?? id}: ${msg}`);
      console.error(`[scraper] Failed to scrape fuel type ${id}:`, msg);
    }
  }

  if (results.length === 0) {
    throw new Error(`Scrape failed for all fuel types: ${errors.join('; ')}`);
  }

  const stations = await mergeResults(results);
  console.log(`[scraper] Merged into ${stations.length} unique stations`);

  if (stations.length === 0) {
    throw new Error('Scrape returned zero stations across all fuel types');
  }

  return stations;
}
