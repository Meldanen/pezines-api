import type { Env } from '../config.worker.js';
import { scrapeAll } from './scraper.service.js';
import { getSessionKV, refreshSessionKV } from './session-manager.kv.js';
import { USER_FACING_STALE_MS } from '../utils/constants.js';
import type { CacheData, Station } from '../models/types.js';

const CACHE_KEY = 'cache';

function extractMeta(stations: Station[]): { fuelTypes: string[]; districts: string[] } {
  const fuelTypes = new Set<string>();
  const districts = new Set<string>();
  for (const s of stations) {
    for (const p of s.prices) fuelTypes.add(p.fuelType);
    if (s.location.area) districts.add(s.location.area);
  }
  return {
    fuelTypes: [...fuelTypes].sort(),
    districts: [...districts].sort(),
  };
}

export async function getCacheKV(env: Env): Promise<CacheData | null> {
  return env.KV.get(CACHE_KEY, 'json') as Promise<CacheData | null>;
}

export interface RefreshResult {
  data: CacheData;
  fresh: boolean;
}

export async function refreshCacheKV(env: Env): Promise<RefreshResult> {
  let stations;
  try {
    stations = await scrapeAll({
      getSession: () => getSessionKV(env),
      refreshSession: () => refreshSessionKV(env),
      govUrl: env.GOV_URL,
    });
  } catch (err) {
    const existing = await getCacheKV(env);
    if (existing && existing.stations.length > 0) {
      console.error(
        `[cache] Scrape failed, serving stale data (${existing.stations.length} stations from ${existing.scrapedAt}):`,
        (err as Error).message
      );
      // Refresh the KV TTL so stale data doesn't expire mid-outage.
      await env.KV.put(CACHE_KEY, JSON.stringify(existing), { expirationTtl: 86400 });
      return { data: existing, fresh: false };
    }
    throw err;
  }

  const meta = extractMeta(stations);
  const data: CacheData = {
    stations,
    scrapedAt: new Date().toISOString(),
    fuelTypes: meta.fuelTypes,
    districts: meta.districts,
  };

  await env.KV.put(CACHE_KEY, JSON.stringify(data), { expirationTtl: 86400 });
  return { data, fresh: true };
}

export function isCacheStaleKV(cache: CacheData): boolean {
  return Date.now() - new Date(cache.scrapedAt).getTime() > USER_FACING_STALE_MS;
}
