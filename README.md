# pezines

REST API that scrapes petroleum prices from the Cyprus government site and serves them via cached endpoints.

Two deployment targets from shared core logic:
- **Fastify** — local dev, Docker, any VPS
- **Cloudflare Workers** — edge deployment with KV storage

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- npm (comes with Node)
- (Optional) [Docker](https://www.docker.com/) for containerized deployment
- (Optional) [Cloudflare account](https://dash.cloudflare.com/sign-up) for Workers deployment

## Run locally (Fastify)

```bash
npm install
cp .env.example .env        # edit .env if you want to override defaults
npm run dev
```

Server starts on `http://localhost:3000`. The first run scrapes the Cyprus gov site and caches the data — takes ~30 seconds. After that, the cache is auto-refreshed in the background and stored in `data/cache.json` so subsequent restarts come up instantly.

To enable the admin dashboard locally, set `DASHBOARD_PASSWORD` in `.env` (any value), then open `http://localhost:3000/`. The browser will prompt for a username (anything) and the password you set. With `DASHBOARD_PASSWORD` blank, `/` returns 404.

## Run locally (Cloudflare Worker)

To exercise the Worker code path against local KV + D1:

```bash
# Apply the D1 schema to the local DB (one time)
npx wrangler d1 execute pezines-history --local --file=./schema.sql

# Start the Worker in local mode
npm run dev:worker
```

`wrangler dev` simulates KV, D1, secrets, and cron locally. Default port is `http://localhost:8787`. To enable the dashboard, add `DASHBOARD_PASSWORD = "yourpw"` to a `.dev.vars` file in the project root (gitignored).

## Deploy to Cloudflare Workers

### First-time setup

1. **KV namespace** — for cache + session storage:
   ```bash
   npx wrangler kv namespace create KV
   npx wrangler kv namespace create KV --preview
   ```
   Update the IDs in `wrangler.toml`.

2. **D1 database** — for historical price snapshots:
   ```bash
   npx wrangler d1 create pezines-history    # only if not already created
   npx wrangler d1 execute pezines-history --remote --file=./schema.sql
   ```
   Update the `database_id` in `wrangler.toml` if you created a new one.

3. **Secrets**:
   ```bash
   npx wrangler secret put ADMIN_API_KEY        # for POST /api/v1/admin/refresh
   npx wrangler secret put DASHBOARD_PASSWORD   # optional — enables the / dashboard
   ```
   Use a long random value (`openssl rand -base64 32 | npx wrangler secret put DASHBOARD_PASSWORD`). Save it to your password manager — Cloudflare secrets are write-only and can't be read back.

4. **Deploy**:
   ```bash
   npm run deploy
   ```

The Worker runs an hourly cron to refresh the cache and write a snapshot to D1. On first deploy the cache is empty until the cron fires (or you trigger a refresh manually):

```bash
curl -X POST https://your-worker.workers.dev/api/v1/admin/refresh \
  -H "x-api-key: YOUR_ADMIN_KEY"
```

## Docker

```bash
docker build -t pezines .
docker run -p 3000:3000 -e ADMIN_API_KEY=yoursecret pezines
```

## Admin dashboard

A built-in UI at `/` provides cache status, one-click resync, and a query playground for every endpoint.

Disabled by default. To enable, set the `DASHBOARD_PASSWORD` env var (Fastify) or secret (Workers: `npx wrangler secret put DASHBOARD_PASSWORD`). When unset, `/` returns 404. When set, the route is gated by HTTP Basic auth — the browser will prompt on first visit.

## API Endpoints

All endpoints are identical on both runtimes.

| Endpoint | Description |
|---|---|
| `GET /api/v1/stations` | All stations (filterable by `fuelType`, `district`, `brand`) |
| `GET /api/v1/stations/nearby` | Nearby stations (`lat`, `lng`, `radius`, `fuelType`, `sort=price\|distance`) |
| `GET /api/v1/stations/:id` | Single station detail |
| `GET /api/v1/prices/cheapest` | Top N cheapest for a fuel type |
| `GET /api/v1/prices/summary` | Avg/min/max per fuel type and district |
| `GET /api/v1/meta/fuel-types` | Available fuel types |
| `GET /api/v1/meta/districts` | Available districts |
| `GET /api/v1/history/station/:stationId` | Price history for a station (`fuelType`, `from`, `to`, `limit`) |
| `GET /api/v1/history/average` | Avg/min/max price history across all stations (`fuelType`, `from`, `to`, `limit`) |
| `GET /api/v1/history/snapshots` | List of distinct snapshot timestamps (`limit`) |
| `GET /api/v1/health` | Server health + cache status |
| `POST /api/v1/admin/refresh` | Force re-scrape. Auth: `x-api-key: <ADMIN_API_KEY>`, or HTTP Basic with the dashboard password. |

## Examples

```bash
# Nearby stations sorted by price
curl "http://localhost:3000/api/v1/stations/nearby?lat=34.68&lng=33.04&fuelType=95&radius=10&sort=price"

# Cheapest Unleaded 95
curl "http://localhost:3000/api/v1/prices/cheapest?fuelType=95&limit=5"

# Price summary
curl "http://localhost:3000/api/v1/prices/summary"

# Station price history (last 30 days, Unleaded 95)
curl "http://localhost:3000/api/v1/history/station/123?fuelType=95&from=2026-03-27&to=2026-04-26"

# Average price history
curl "http://localhost:3000/api/v1/history/average?fuelType=95&limit=30"
```

## How It Works

1. **Session manager** fetches CSRF tokens from the gov site (ASP.NET form tokens + cookies)
2. **Scraper** POSTs for each fuel type (Unleaded 95, 98, Diesel, Heating Oil, Kerosene) and parses the HTML response
3. **Cache** merges results into unified station objects
   - Fastify: in-memory with file backup (`data/cache.json`), `setInterval` auto-refresh every 4 hours
   - Workers: Cloudflare KV storage, refreshed hourly by cron trigger
4. Sessions refresh every 30 minutes
5. **History** — on each cron refresh (Workers), a snapshot of all prices is saved to D1 for historical tracking

## Architecture

```
src/
  server.ts / app.ts          Fastify entry + app
  worker.ts / worker-app.ts   Workers entry + Hono app
  services/
    scraper.service.ts         Shared (Web Crypto, injectable session)
    html-parser.service.ts     Shared (isomorphic)
    geo.service.ts             Shared (pure math)
    cache.service.ts           Fastify (fs-backed)
    session-manager.service.ts Fastify (axios + setInterval)
    cache.kv.ts                Workers (KV-backed)
    session-manager.kv.ts      Workers (KV-backed, fetch API)
    history.d1.ts              Workers (D1-backed history queries)
  routes/                      Fastify route handlers
  routes-worker/               Hono route handlers
```

## Environment Variables

### Fastify

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `ADMIN_API_KEY` | `changeme` | API key for admin endpoints |
| `DASHBOARD_PASSWORD` | _(unset)_ | Password for the `/` dashboard. Unset = dashboard disabled. |
| `CACHE_TTL_MS` | `14400000` | Cache TTL (4 hours) |
| `SCRAPE_INTERVAL_MS` | `14400000` | Auto-refresh interval (4 hours) |
| `SESSION_REFRESH_MS` | `1800000` | Session token refresh (30 min) |

### Workers

Configured in `wrangler.toml` (vars) and via `wrangler secret put` (secrets):

| Binding | Type | Description |
|---|---|---|
| `KV` | KV Namespace | Cache + session storage |
| `DB` | D1 Database | Historical price snapshots |
| `GOV_URL` | var | Government scrape URL |
| `ADMIN_API_KEY` | secret | API key for admin endpoints |
| `DASHBOARD_PASSWORD` | secret | Password for the `/` dashboard. Unset = dashboard disabled. |

## Viewing the Database

The D1 database (`pezines-history`) stores historical price snapshots. You can query it via the Wrangler CLI or the Cloudflare dashboard.

```bash
# Row count
npx wrangler d1 execute pezines-history --remote --command "SELECT COUNT(*) FROM price_history;"

# Latest records
npx wrangler d1 execute pezines-history --remote --command "SELECT * FROM price_history ORDER BY recorded_at DESC LIMIT 10;"

# Distinct fuel types
npx wrangler d1 execute pezines-history --remote --command "SELECT DISTINCT fuel_type FROM price_history;"

# All data (careful if large)
npx wrangler d1 execute pezines-history --remote --command "SELECT * FROM price_history LIMIT 100;"
```

Replace `--remote` with `--local` to query the local dev database instead.

You can also browse the data in the Cloudflare dashboard under **Workers & Pages > D1 > pezines-history**, which has a built-in SQL console.

## CI/CD

Pushing to `master` auto-deploys to Cloudflare Workers via GitHub Actions. Requires a `CLOUDFLARE_API_TOKEN` secret in the repo settings.

## Tech Stack

TypeScript, Fastify 5, Hono, axios, cheerio, envalid, Cloudflare Workers + KV + D1
