import type { CacheData } from '../models/types.js';

export async function savePriceSnapshot(db: D1Database, data: CacheData): Promise<void> {
  const { scrapedAt, stations } = data;

  const stmt = db.prepare(
    'INSERT INTO price_history (recorded_at, station_id, brand, station_name, fuel_type, price) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const bindings = stations.flatMap((station) =>
    station.prices.map((p) =>
      stmt.bind(scrapedAt, station.id, station.brand, station.name, p.fuelType, p.price)
    )
  );

  if (bindings.length === 0) return;

  await db.batch(bindings);
}

export interface HistoryRow {
  recorded_at: string;
  station_id: string;
  brand: string;
  station_name: string;
  fuel_type: string;
  price: number;
}

export interface AverageRow {
  recorded_at: string;
  fuel_type: string;
  avg_price: number;
  min_price: number;
  max_price: number;
  station_count: number;
}

/** Get price history for a specific station */
export async function getStationHistory(
  db: D1Database,
  stationId: string,
  opts?: { fuelType?: string; from?: string; to?: string; limit?: number }
): Promise<HistoryRow[]> {
  const conditions = ['station_id = ?'];
  const params: (string | number)[] = [stationId];

  if (opts?.fuelType) {
    conditions.push('fuel_type = ?');
    params.push(opts.fuelType);
  }
  if (opts?.from) {
    conditions.push('recorded_at >= ?');
    params.push(opts.from);
  }
  if (opts?.to) {
    conditions.push('recorded_at <= ?');
    params.push(opts.to);
  }

  const limit = Math.min(opts?.limit ?? 100, 500);

  const sql = `SELECT recorded_at, station_id, brand, station_name, fuel_type, price
    FROM price_history WHERE ${conditions.join(' AND ')}
    ORDER BY recorded_at DESC LIMIT ?`;
  params.push(limit);

  const result = await db.prepare(sql).bind(...params).all<HistoryRow>();
  return result.results;
}

/** Get average prices over time, grouped by snapshot and fuel type */
export async function getAverageHistory(
  db: D1Database,
  opts?: { fuelType?: string; from?: string; to?: string; limit?: number }
): Promise<AverageRow[]> {
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (opts?.fuelType) {
    conditions.push('fuel_type = ?');
    params.push(opts.fuelType);
  }
  if (opts?.from) {
    conditions.push('recorded_at >= ?');
    params.push(opts.from);
  }
  if (opts?.to) {
    conditions.push('recorded_at <= ?');
    params.push(opts.to);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = Math.min(opts?.limit ?? 100, 500);

  const sql = `SELECT recorded_at, fuel_type,
      ROUND(AVG(price), 3) as avg_price,
      MIN(price) as min_price,
      MAX(price) as max_price,
      COUNT(*) as station_count
    FROM price_history ${where}
    GROUP BY recorded_at, fuel_type
    ORDER BY recorded_at DESC LIMIT ?`;
  params.push(limit);

  const result = await db.prepare(sql).bind(...params).all<AverageRow>();
  return result.results;
}

/** List distinct snapshot timestamps */
export async function getSnapshots(
  db: D1Database,
  limit?: number
): Promise<{ recorded_at: string; station_count: number }[]> {
  const effectiveLimit = Math.min(limit ?? 50, 200);
  const result = await db
    .prepare(
      `SELECT recorded_at, COUNT(DISTINCT station_id) as station_count
       FROM price_history GROUP BY recorded_at ORDER BY recorded_at DESC LIMIT ?`
    )
    .bind(effectiveLimit)
    .all<{ recorded_at: string; station_count: number }>();
  return result.results;
}
