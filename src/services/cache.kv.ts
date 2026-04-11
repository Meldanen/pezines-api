import type { Env } from '../config.worker.js';
import { scrapeAll } from './scraper.service.js';
import { getSessionKV, refreshSessionKV } from './session-manager.kv.js';
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

export async function refreshCacheKV(env: Env): Promise<CacheData> {
  const stations = await scrapeAll({
    getSession: () => getSessionKV(env),
    refreshSession: () => refreshSessionKV(env),
    govUrl: env.GOV_URL,
  });

  const meta = extractMeta(stations);
  const data: CacheData = {
    stations,
    scrapedAt: new Date().toISOString(),
    fuelTypes: meta.fuelTypes,
    districts: meta.districts,
  };

  await env.KV.put(CACHE_KEY, JSON.stringify(data), { expirationTtl: 86400 });
  return data;
}

export function isCacheStaleKV(cache: CacheData): boolean {
  return Date.now() - new Date(cache.scrapedAt).getTime() > 14_400_000; // 4 hours
}
