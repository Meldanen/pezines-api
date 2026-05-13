// Stubs globalThis.fetch with canned gov-site responses and exercises the
// session fetcher + scraper end-to-end. Catches regressions in the axios→fetch
// swap (form encoding, cookie harvesting, CSRF token retry, redirect handling)
// without hitting the real gov site.

import { fetchSessionTokens } from '../src/services/session-fetcher.js';
import { scrapeAll } from '../src/services/scraper.service.js';

let failures = 0;
function assert(cond: unknown, msg: string): void {
  if (!cond) {
    failures += 1;
    console.error(`FAIL: ${msg}`);
  }
}

const SESSION_HTML = `<!DOCTYPE html>
<html><body>
<form>
  <input type="hidden" name="__RequestVerificationToken" value="TEST_TOKEN_xyz123" />
</form>
</body></html>`;

function priceTableHtml(stationName: string, price: string): string {
  // Mirrors what html-parser.service.ts walks: #petroleumPriceDetailsFootable tbody tr,
  // with td:nth-child(1..5) being brand, name, address link (href has coordinates= query),
  // area, price (with comma decimal).
  return `<!DOCTYPE html><html><body>
<table id="petroleumPriceDetailsFootable">
  <tbody>
    <tr>
      <td>EKO</td>
      <td>${stationName}</td>
      <td><a href="https://maps.example.com/?coordinates=35.18%2C33.38">123 Main St
Nicosia</a></td>
      <td>Nicosia</td>
      <td>${price}</td>
    </tr>
  </tbody>
</table>
</body></html>`;
}

interface RecordedCall {
  url: string;
  method: string;
  body?: string;
  cookieHeader?: string;
}

function installFetch(fn: (call: RecordedCall) => Response): RecordedCall[] {
  const calls: RecordedCall[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? init.body : undefined;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const call: RecordedCall = { url, method, body, cookieHeader: headers.Cookie };
    calls.push(call);
    return fn(call);
  }) as typeof fetch;
  return calls;
}

const originalFetch = globalThis.fetch;

try {
  // ───── 1. fetchSessionTokens parses the gov page correctly
  {
    installFetch(() =>
      new Response(SESSION_HTML, {
        status: 200,
        headers: { 'Set-Cookie': 'ASP.NET_SessionId_Efef=abc123; Path=/; HttpOnly' },
      })
    );

    const session = await fetchSessionTokens('http://gov.test/page');
    assert(session.verificationToken === 'TEST_TOKEN_xyz123', `session: extracted token (got ${session.verificationToken})`);
    assert(session.cookies.includes('ASP.NET_SessionId_Efef=abc123'), `session: extracted cookie (got ${session.cookies})`);
    assert(typeof session.obtainedAt === 'number' && Date.now() - session.obtainedAt < 1000, 'session: obtainedAt is recent');
  }

  // ───── 2. fetchSessionTokens throws on missing token
  {
    installFetch(() => new Response('<html><body>nothing here</body></html>', { status: 200 }));
    let threw = false;
    try {
      await fetchSessionTokens('http://gov.test/page');
    } catch (err) {
      threw = (err as Error).message.includes('__RequestVerificationToken');
    }
    assert(threw, 'session: throws when token missing from HTML');
  }

  // ───── 3. fetchSessionTokens throws on non-2xx
  {
    installFetch(() => new Response('forbidden', { status: 403 }));
    let threw = false;
    try {
      await fetchSessionTokens('http://gov.test/page');
    } catch (err) {
      threw = (err as Error).message.includes('403');
    }
    assert(threw, 'session: throws on 403 with status in message');
  }

  // ───── 4. scrapeAll: full happy path with 5 fuel types
  {
    const session = { cookies: 'SESS=abc; LANG=el', verificationToken: 'CSRF_TOK', obtainedAt: Date.now() };
    const calls = installFetch((call) => {
      if (call.method !== 'POST') throw new Error(`unexpected ${call.method}`);
      const params = new URLSearchParams(call.body ?? '');
      const ft = params.get('Entity.PetroleumType') ?? '?';
      // Same station coords across all fuel types → should merge to one Station with 5 prices.
      return new Response(priceTableHtml('EKO Nicosia', `1.${500 + Number(ft)}`), {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });
    });

    const stations = await scrapeAll({
      getSession: async () => session,
      refreshSession: async () => session,
      govUrl: 'http://gov.test/page',
    });

    assert(stations.length === 1, `scrapeAll: merged to 1 station (got ${stations.length})`);
    assert(stations[0]?.prices.length === 5, `scrapeAll: 5 fuel types collected (got ${stations[0]?.prices.length})`);
    assert(stations[0]?.brand === 'EKO', 'scrapeAll: brand preserved');

    const posts = calls.filter((c) => c.method === 'POST');
    assert(posts.length === 5, `5 POSTs (one per fuel type, got ${posts.length})`);
    for (const p of posts) {
      assert(p.body?.includes('__RequestVerificationToken=CSRF_TOK'), 'POST body carries CSRF token');
      assert(p.body?.includes('Entity.StationCityEnum=All'), 'POST body carries station enum');
      assert(p.cookieHeader === 'SESS=abc; LANG=el', `POST sends session cookies (got ${p.cookieHeader})`);
    }
    const fuelIds = posts.map((p) => new URLSearchParams(p.body ?? '').get('Entity.PetroleumType'));
    assert(JSON.stringify(fuelIds) === JSON.stringify(['1', '2', '3', '4', '5']), `5 fuel-type IDs 1..5 (got ${JSON.stringify(fuelIds)})`);
  }

  // ───── 5. scrapeAll: 403 on first POST triggers session refresh + retry
  {
    let postSeq = 0;
    let refreshCount = 0;
    const staleSession = { cookies: 'STALE=1', verificationToken: 'OLD_TOK', obtainedAt: 0 };
    const freshSession = { cookies: 'FRESH=1', verificationToken: 'NEW_TOK', obtainedAt: Date.now() };

    const calls = installFetch(() => {
      postSeq += 1;
      // First POST 403s, all subsequent (including retry of fuel type 1) succeed.
      if (postSeq === 1) return new Response('forbidden', { status: 403 });
      return new Response(priceTableHtml('EKO Nicosia', '1.50'), { status: 200 });
    });

    let sessionToReturn = staleSession;
    const stations = await scrapeAll({
      getSession: async () => sessionToReturn,
      refreshSession: async () => {
        refreshCount += 1;
        sessionToReturn = freshSession;
        return freshSession;
      },
      govUrl: 'http://gov.test/page',
    });

    assert(refreshCount === 1, `403 triggered exactly one refresh (got ${refreshCount})`);
    assert(stations.length === 1, '403 retry path still yields a station');
    // POSTs: fuel1-fail, fuel1-retry-ok, fuel2-ok, fuel3-ok, fuel4-ok, fuel5-ok = 6 total
    assert(calls.length === 6, `expected 6 POSTs (1 failure + 1 retry + 4 normal), got ${calls.length}`);
    // Retry POST should carry the refreshed CSRF token.
    assert(calls[1]?.body?.includes('NEW_TOK'), 'retry POST uses refreshed CSRF token');
    assert(calls[1]?.cookieHeader === 'FRESH=1', `retry POST uses refreshed cookies (got ${calls[1]?.cookieHeader})`);
  }

  // ───── 6. scrapeAll: non-retry error continues to next fuel type instead of failing
  {
    let postSeq = 0;
    installFetch(() => {
      postSeq += 1;
      // First fuel type returns 500 (not 403/302 → no retry, just skip). Rest succeed.
      if (postSeq === 1) return new Response('boom', { status: 500 });
      return new Response(priceTableHtml('EKO Nicosia', '1.50'), { status: 200 });
    });

    const session = { cookies: 'S=1', verificationToken: 'T', obtainedAt: Date.now() };
    const stations = await scrapeAll({
      getSession: async () => session,
      refreshSession: async () => session,
      govUrl: 'http://gov.test/page',
    });
    // 4 successful fuel types, all same station → 1 merged station with 4 prices.
    assert(stations.length === 1, 'partial failure: still produces stations');
    assert(stations[0]?.prices.length === 4, `4 fuel types collected after one failure (got ${stations[0]?.prices.length})`);
  }
} finally {
  globalThis.fetch = originalFetch;
}

if (failures === 0) console.log('OK — all scraper smoke tests passed');
else {
  console.error(`${failures} failure(s)`);
  process.exit(1);
}
