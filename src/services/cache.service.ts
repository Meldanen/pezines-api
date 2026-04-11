import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { scrapeAll } from './scraper.service.js';
import { getSession, refreshSession } from './session-manager.service.js';
import type { CacheData, Station } from '../models/types.js';

const CACHE_FILE = path.resolve('data', 'cache.json');

let cache: CacheData | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let refreshing = false;

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

async function persistToFile(data: CacheData): Promise<void> {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[cache] Failed to persist cache file:', (err as Error).message);
  }
}

async function loadFromFile(): Promise<CacheData | null> {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = await readFile(CACHE_FILE, 'utf-8');
    return JSON.parse(raw) as CacheData;
  } catch {
    return null;
  }
}

export async function refreshCache(): Promise<CacheData> {
  if (refreshing) {
    // If already refreshing, wait and return current cache
    if (cache) return cache;
    throw new Error('Cache refresh already in progress and no stale data available');
  }

  refreshing = true;
  try {
    const stations = await scrapeAll({
      getSession,
      refreshSession,
      govUrl: config.GOV_URL,
    });
    const meta = extractMeta(stations);
    cache = {
      stations,
      scrapedAt: new Date().toISOString(),
      fuelTypes: meta.fuelTypes,
      districts: meta.districts,
    };
    await persistToFile(cache);
    return cache;
  } catch (err) {
    // Stale-while-revalidate: keep old cache if refresh fails
    if (cache) {
      console.error('[cache] Refresh failed, serving stale data:', (err as Error).message);
      return cache;
    }
    throw err;
  } finally {
    refreshing = false;
  }
}

export async function initCache(): Promise<void> {
  // Try loading from file first (cold-start recovery)
  const fileCache = await loadFromFile();
  if (fileCache) {
    cache = fileCache;
    console.log(`[cache] Loaded ${fileCache.stations.length} stations from file (scraped: ${fileCache.scrapedAt})`);
  }

  // Kick off a fresh scrape in the background
  refreshCache().catch((err) => {
    console.error('[cache] Initial scrape failed:', (err as Error).message);
  });
}

export function startAutoRefresh(): void {
  if (refreshTimer) return;
  refreshTimer = setInterval(async () => {
    try {
      await refreshCache();
      console.log('[cache] Auto-refresh completed');
    } catch (err) {
      console.error('[cache] Auto-refresh failed:', (err as Error).message);
    }
  }, config.SCRAPE_INTERVAL_MS);
}

export function stopAutoRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

export function getCache(): CacheData | null {
  return cache;
}

export function isCacheStale(): boolean {
  if (!cache) return true;
  return Date.now() - new Date(cache.scrapedAt).getTime() > config.CACHE_TTL_MS;
}
