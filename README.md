# pezines

REST API that scrapes petroleum prices from the Cyprus government site and serves them via cached endpoints.

## Quick Start

```bash
npm install
npm run dev
```

Server starts on `http://localhost:3000`.

## Docker

```bash
docker build -t pezines .
docker run -p 3000:3000 -e ADMIN_API_KEY=yoursecret pezines
```

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/v1/stations` | All stations (filterable by `fuelType`, `district`, `brand`) |
| `GET /api/v1/stations/nearby` | Nearby stations (`lat`, `lng`, `radius`, `fuelType`, `sort=price\|distance`) |
| `GET /api/v1/stations/:id` | Single station detail |
| `GET /api/v1/prices/cheapest` | Top N cheapest for a fuel type |
| `GET /api/v1/prices/summary` | Avg/min/max per fuel type and district |
| `GET /api/v1/meta/fuel-types` | Available fuel types |
| `GET /api/v1/meta/districts` | Available districts |
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
```

## How It Works

1. **Session manager** fetches CSRF tokens from the gov site (ASP.NET form tokens + cookies)
2. **Scraper** POSTs for each fuel type (Unleaded 95, 98, Diesel, Heating Oil, Kerosene) and parses the HTML response
3. **Cache** merges results into unified station objects, stored in-memory with file backup
4. Data auto-refreshes every 4 hours; sessions refresh every 30 minutes

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `HOST` | `0.0.0.0` | Bind address |
| `ADMIN_API_KEY` | `changeme` | API key for admin endpoints |
| `CACHE_TTL_MS` | `14400000` | Cache TTL (4 hours) |
| `SCRAPE_INTERVAL_MS` | `14400000` | Auto-refresh interval (4 hours) |
| `SESSION_REFRESH_MS` | `1800000` | Session token refresh (30 min) |

## Tech Stack

TypeScript, Fastify 5, axios, cheerio, envalid
