import axios from 'axios';
import { createHash } from 'node:crypto';
import { config } from '../config.js';
import { getSession, refreshSession } from './session-manager.service.js';
import { parseStationsHtml } from './html-parser.service.js';
import { FUEL_TYPE_MAP } from '../utils/constants.js';
import type { Station, RawStation, ScrapeResult } from '../models/types.js';

function generateStationId(brand: string, name: string, lat: number, lng: number): string {
  const input = `${brand}|${name}|${lat}|${lng}`;
  return createHash('sha256').update(input).digest('hex').slice(0, 12);
}

async function scrapeFuelType(fuelTypeId: number): Promise<ScrapeResult> {
  let session = await getSession();

  const formData = new URLSearchParams();
  formData.append('Entity.PetroleumType', String(fuelTypeId));
  formData.append('Entity.StationCityEnum', 'All');
  formData.append('__RequestVerificationToken', session.verificationToken);

  let response;
  try {
    response = await axios.post(config.GOV_URL, formData.toString(), {
      headers: {
        Cookie: session.cookies,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      maxRedirects: 5,
    });
  } catch (err: any) {
    if (err.response?.status === 403 || err.response?.status === 302) {
      // Session expired, refresh and retry once
      session = await refreshSession();
      formData.set('__RequestVerificationToken', session.verificationToken);
      response = await axios.post(config.GOV_URL, formData.toString(), {
        headers: {
          Cookie: session.cookies,
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        maxRedirects: 5,
      });
    } else {
      throw err;
    }
  }

  const stations = parseStationsHtml(response.data);
  return {
    fuelType: FUEL_TYPE_MAP[fuelTypeId] ?? `Unknown (${fuelTypeId})`,
    fuelTypeId,
    stations,
  };
}

function mergeResults(results: ScrapeResult[]): Station[] {
  const stationMap = new Map<string, Station>();

  for (const result of results) {
    for (const raw of result.stations) {
      const id = generateStationId(
        raw.brand,
        raw.name,
        raw.location.coordinates.latitude,
        raw.location.coordinates.longitude
      );

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

export async function scrapeAll(): Promise<Station[]> {
  console.log('[scraper] Starting full scrape of all fuel types...');
  const results: ScrapeResult[] = [];

  for (let id = 1; id <= 5; id++) {
    try {
      const result = await scrapeFuelType(id);
      results.push(result);
      console.log(`[scraper] Fuel type ${FUEL_TYPE_MAP[id]}: ${result.stations.length} stations`);
    } catch (err) {
      console.error(`[scraper] Failed to scrape fuel type ${id}:`, (err as Error).message);
    }
  }

  const stations = mergeResults(results);
  console.log(`[scraper] Merged into ${stations.length} unique stations`);
  return stations;
}
