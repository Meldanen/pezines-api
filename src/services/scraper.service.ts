import axios from 'axios';
import { parseStationsHtml } from './html-parser.service.js';
import { FUEL_TYPE_MAP } from '../utils/constants.js';
import type { Station, ScrapeResult, SessionTokens } from '../models/types.js';

async function generateStationId(brand: string, name: string, lat: number, lng: number): Promise<string> {
  const input = `${brand}|${name}|${lat}|${lng}`;
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
}

export interface ScrapeOptions {
  getSession: () => Promise<SessionTokens>;
  refreshSession: () => Promise<SessionTokens>;
  govUrl: string;
}

async function scrapeFuelType(fuelTypeId: number, opts: ScrapeOptions): Promise<ScrapeResult> {
  let session = await opts.getSession();

  const formData = new URLSearchParams();
  formData.append('Entity.PetroleumType', String(fuelTypeId));
  formData.append('Entity.StationCityEnum', 'All');
  formData.append('__RequestVerificationToken', session.verificationToken);

  let response;
  try {
    response = await axios.post(opts.govUrl, formData.toString(), {
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
      session = await opts.refreshSession();
      formData.set('__RequestVerificationToken', session.verificationToken);
      response = await axios.post(opts.govUrl, formData.toString(), {
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

  // Probe for gov-side update signals — runs once per fuel type, log only for the first.
  if (fuelTypeId === 1) {
    console.log('[probe] last-modified:', response.headers['last-modified'] ?? '(none)');
    console.log('[probe] date:', response.headers['date'] ?? '(none)');
    const html: string = response.data;
    for (const needle of ['ισχύουν', 'Ισχύουν', 'ενημερ', 'Ενημερ', 'ημερομην', 'Ημερομην']) {
      const i = html.indexOf(needle);
      if (i !== -1) {
        console.log(`[probe] "${needle}" @${i}:`, html.slice(Math.max(0, i - 40), i + 120).replace(/\s+/g, ' '));
      }
    }
  }

  const stations = parseStationsHtml(response.data);
  return {
    fuelType: FUEL_TYPE_MAP[fuelTypeId] ?? `Unknown (${fuelTypeId})`,
    fuelTypeId,
    stations,
  };
}

async function mergeResults(results: ScrapeResult[]): Promise<Station[]> {
  const stationMap = new Map<string, Station>();

  for (const result of results) {
    for (const raw of result.stations) {
      const id = await generateStationId(
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

export async function scrapeAll(opts: ScrapeOptions): Promise<Station[]> {
  console.log('[scraper] Starting full scrape of all fuel types...');
  const results: ScrapeResult[] = [];

  for (let id = 1; id <= 5; id++) {
    try {
      const result = await scrapeFuelType(id, opts);
      results.push(result);
      console.log(`[scraper] Fuel type ${FUEL_TYPE_MAP[id]}: ${result.stations.length} stations`);
    } catch (err) {
      console.error(`[scraper] Failed to scrape fuel type ${id}:`, (err as Error).message);
    }
  }

  const stations = await mergeResults(results);
  console.log(`[scraper] Merged into ${stations.length} unique stations`);
  return stations;
}
