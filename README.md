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

## Quick Start

```bash
# Install dependencies
npm install

# Copy env file and edit as needed
cp .env.example .env

# Start dev server
npm run dev
```

Server starts on `http://localhost:3000`. The first run scrapes the Cyprus gov site and caches the data — this takes ~30 seconds.

## Cloudflare Workers

```bash
# Local dev (uses Wrangler local mode)
npm run dev:worker

# Deploy to Cloudflare
npm run deploy
```

### First-time setup

1. Create a KV namespace:
   ```bash
   npx wrangler kv namespace create KV
   npx wrangler kv namespace create KV --preview
   ```
2. Update `wrangler.toml` with the returned namespace IDs
3. Set the admin secret:
   ```bash
   npx wrangler secret put ADMIN_API_KEY
   ```

The Worker uses a cron trigger (every 6 hours) to refresh the cache. On first deploy, trigger a manual refresh:

```bash
curl -X POST https://your-worker.workers.dev/api/v1/admin/refresh -H "x-api-key: YOUR_KEY"
```

## Docker

```bash
docker build -t pezines .
docker run -p 3000:3000 -e ADMIN_API_KEY=yoursecret pezines
```

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
| `POST /api/v1/admin/refresh` | Force re-scrape (requires `x-api-key` header) |

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
   - Fastify: in-memory with file backup, `setInterval` auto-refresh
   - Workers: Cloudflare KV storage, cron-triggered refresh
4. Data auto-refreshes every 6 hours; sessions refresh every 30 minutes
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

## CI/CD

Pushing to `master` auto-deploys to Cloudflare Workers via GitHub Actions. Requires a `CLOUDFLARE_API_TOKEN` secret in the repo settings.

## Tech Stack

TypeScript, Fastify 5, Hono, axios, cheerio, envalid, Cloudflare Workers + KV + D1
