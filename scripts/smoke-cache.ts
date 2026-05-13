// Exercises refreshCacheKV's stale-while-revalidate behavior with an in-memory
// KV stub. Verifies that a scrape failure does NOT overwrite the cache, and
// that a successful scrape DOES.

import { refreshCacheKV } from '../src/services/cache.kv.js';
import type { CacheData } from '../src/models/types.js';

let failures = 0;
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${msg}`);
  }
}

interface KVRecord {
  value: string;
  expirationTtl?: number;
}

function makeKVStub(initial?: CacheData): {
  KV: { get: (k: string, type?: string) => Promise<unknown>; put: (k: string, v: string, opts?: { expirationTtl?: number }) => Promise<void> };
  store: Map<string, KVRecord>;
  puts: Array<{ key: string; value: string; expirationTtl?: number }>;
} {
  const store = new Map<string, KVRecord>();
  const puts: Array<{ key: string; value: string; expirationTtl?: number }> = [];
  if (initial) store.set('cache', { value: JSON.stringify(initial) });

  return {
    store,
    puts,
    KV: {
      get: async (k: string, type?: string) => {
        const rec = store.get(k);
        if (!rec) return null;
        return type === 'json' ? JSON.parse(rec.value) : rec.value;
      },
      put: async (k: string, v: string, opts?: { expirationTtl?: number }) => {
        store.set(k, { value: v, expirationTtl: opts?.expirationTtl });
        puts.push({ key: k, value: v, expirationTtl: opts?.expirationTtl });
      },
    },
  };
}

const SESSION_HTML = `<!DOCTYPE html><html><body>
<form><input type="hidden" name="__RequestVerificationToken" value="TOK" /></form>
</body></html>`;

const PRICE_HTML = `<!DOCTYPE html><html><body>
<table id="petroleumPriceDetailsFootable"><tbody>
  <tr>
    <td>EKO</td>
    <td>Test Station</td>
    <td><a href="https://maps.example.com/?coordinates=35.18%2C33.38">123 Main St
Nicosia</a></td>
    <td>Nicosia</td>
    <td>1.500</td>
  </tr>
</tbody></table>
</body></html>`;

const originalFetch = globalThis.fetch;

try {
  // ───── 1. Scrape fails completely → existing cache preserved, fresh=false, TTL refreshed
  {
    const existing: CacheData = {
      stations: [
        {
          id: 'abc123',
          brand: 'EKO',
          name: 'Old Station',
          location: { address: '1 Old Rd', area: 'Nicosia', coordinates: { latitude: 35, longitude: 33 } },
          prices: [{ fuelType: 'Unleaded 95', price: 1.45 }],
        },
      ],
      scrapedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      fuelTypes: ['Unleaded 95'],
      districts: ['Nicosia'],
    };
    const stub = makeKVStub(existing);

    // Every fetch returns 503 → session fetch or scrape will throw.
    globalThis.fetch = (async () => new Response('down', { status: 503 })) as typeof fetch;

    const env = { KV: stub.KV, GOV_URL: 'http://gov.test/page' } as Parameters<typeof refreshCacheKV>[0];
    const result = await refreshCacheKV(env);

    assert(result.fresh === false, `outage: fresh=false (got ${result.fresh})`);
    assert(result.data.stations.length === 1, `outage: existing station preserved (got ${result.data.stations.length})`);
    assert(result.data.stations[0]?.name === 'Old Station', 'outage: existing station identity preserved');
    assert(result.data.scrapedAt === existing.scrapedAt, 'outage: scrapedAt unchanged (stale data, original timestamp)');
    assert(stub.puts.length === 1, `outage: KV.put called once to refresh TTL (got ${stub.puts.length})`);
    assert(stub.puts[0]?.expirationTtl === 86400, `outage: TTL refreshed to 24h (got ${stub.puts[0]?.expirationTtl})`);
  }

  // ───── 2. Scrape fails AND no existing cache → throws (nothing to fall back to)
  {
    const stub = makeKVStub(); // empty
    globalThis.fetch = (async () => new Response('down', { status: 503 })) as typeof fetch;

    const env = { KV: stub.KV, GOV_URL: 'http://gov.test/page' } as Parameters<typeof refreshCacheKV>[0];
    let threw = false;
    try {
      await refreshCacheKV(env);
    } catch {
      threw = true;
    }
    assert(threw, 'cold-start outage: throws when no cache exists to fall back on');
    assert(stub.puts.length === 0, 'cold-start outage: nothing written to KV');
  }

  // ───── 3. Successful scrape → fresh=true, cache overwritten with new data
  {
    const stub = makeKVStub();
    // Session GET returns CSRF HTML; all POSTs return a station row.
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (method === 'GET') {
        return new Response(SESSION_HTML, {
          status: 200,
          headers: { 'Set-Cookie': 'SESS=abc; Path=/; HttpOnly' },
        });
      }
      return new Response(PRICE_HTML, { status: 200 });
    }) as typeof fetch;

    const env = { KV: stub.KV, GOV_URL: 'http://gov.test/page' } as Parameters<typeof refreshCacheKV>[0];
    const result = await refreshCacheKV(env);

    assert(result.fresh === true, `happy: fresh=true (got ${result.fresh})`);
    assert(result.data.stations.length === 1, `happy: station scraped (got ${result.data.stations.length})`);
    assert(result.data.stations[0]?.name === 'Test Station', 'happy: scraped station identity');
    const cachePuts = stub.puts.filter((p) => p.key === 'cache');
    assert(cachePuts.length === 1, `happy: cache key written exactly once (got ${cachePuts.length})`);
    assert(
      cachePuts[0]?.value.includes('Test Station'),
      'happy: cache write contains scraped station'
    );
  }
} finally {
  globalThis.fetch = originalFetch;
}

if (failures === 0) console.log('OK — all cache smoke tests passed');
else {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
