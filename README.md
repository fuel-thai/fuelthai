# FUEL::TH

Real-time Thailand fuel prices, diesel availability, and station finder for 24,548+ stations. Built during the 2026 Iran war energy crisis.

**Live:** https://www.fuelthai.com\
**GitHub:** https://github.com/fuel-thai/fuelthai

## What it does

- Real-time diesel availability from DOEB Fuel Now (government) + PumpRadar (crowdsourced)
- Multi-brand fuel prices from Bangchak API + thai-oil-api (10 brands)
- Brent crude oil chart (Yahoo Finance, EIA fallback)
- THB/USD exchange rate tracking
- Energy news aggregation (OilPrice, gCaptain, Natural Gas Intel, Bangkok Post)
- Daily price capture to D1 (crude, exchange rate, brand diesel, FRED indices)
- 77 provinces with regional diesel availability stats
- Station detail pages with status history, directions, sharing
- Push notifications for diesel status changes (area + station-specific)
- Bilingual EN/TH with browser auto-detection
- PWA installable

## Stack

- **Frontend:** Vite 8, React 19, TypeScript, TanStack Router, Tailwind CSS v4, shadcn/ui, Zustand
- **Backend:** Cloudflare Workers (Hono), D1 (SQLite), R2 (snapshots)
- **Data pipeline:** Cron trigger every 15min -- fetch DOEB, diff into D1, archive to R2
- **Spatial indexing:** Geohash5 (~5km cells) for all station lookups
- **Ingest script:** Standalone bun script for NAS/external cron data collection

## Setup

```bash
# Install dependencies
npm install

# Copy config templates
cp wrangler.example.toml wrangler.toml  # Edit with your CF resource IDs
cp .env.example .env                     # Add your keys (see below)

# Create D1 database
wrangler d1 create fuel-th-db
# Update database_id in wrangler.toml

# Create R2 bucket
wrangler r2 bucket create fuel-th-snapshots

# Initialize D1 schema
wrangler d1 execute fuel-th-db --remote --file worker/db/schema.sql
wrangler d1 execute fuel-th-db --remote --file worker/db/provinces.sql
wrangler d1 execute fuel-th-db --remote --file worker/db/postal-codes.sql
wrangler d1 execute fuel-th-db --remote --file worker/db/postal-codes-seed.sql
wrangler d1 execute fuel-th-db --remote --file worker/db/price-history.sql

# Set secrets (prompted for values -- NOT stored in code)
wrangler secret put CRON_SECRET
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put FRED_API_KEY

# Generate VAPID keys (if you don't have them)
npx web-push generate-vapid-keys

# Development
npm run dev          # Frontend (port 4000)
npm run dev:worker   # Worker (port 8787)

# Deploy
npm run deploy
```

## Environment & Secrets

**All secrets are stored via `wrangler secret put` or `.env` -- never in git.**

### Build-time (`.env` -- gitignored)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CF_BEACON` | No | Cloudflare Web Analytics token |
| `VITE_GA_ID` | No | Google Analytics measurement ID |

### Worker Secrets (`wrangler secret put` -- encrypted at rest)

| Secret | Required | Description |
|--------|----------|-------------|
| `CRON_SECRET` | Yes | Auth token for admin/cron/ingest endpoints (`X-Cron-Key` header) |
| `VAPID_PRIVATE_KEY` | Yes | Web Push VAPID private key |
| `FRED_API_KEY` | No | FRED API key for economic indices ([free signup](https://fredaccount.stlouisfed.org/login/create/)) |

### Worker Vars (`wrangler.toml [vars]` -- not secret)

| Variable | Required | Description |
|----------|----------|-------------|
| `VAPID_PUBLIC_KEY` | Yes | Web Push VAPID public key (client-visible by design) |
| `VAPID_SUBJECT` | Yes | Web Push contact (`mailto:` URL) |

### Ingest Script (`tools/ingest.ts`)

| Variable | Required | Description |
|----------|----------|-------------|
| `FUELTHAI_KEY` | Yes | Same as `CRON_SECRET` -- auth for `/api/ingest` |
| `FUELTHAI_URL` | No | Target API (default: `https://www.fuelthai.com`) |
| `FRED_API_KEY` | No | FRED API key for fertilizer/plastics indices |

## Data Sources

| Source | Used For | Auth |
|--------|----------|------|
| [DOEB Fuel Now](https://fuel-now.doeb.go.th) | 24,548 stations + diesel status (primary) | None |
| [PumpRadar](https://thaipumpradar.com) | Crowdsourced notes, photos, queues | None |
| [Bangchak API](https://oil-price.bangchak.co.th) | Fuel prices (today/yesterday/tomorrow) | None |
| [thai-oil-api](https://api.chnwt.dev/thai-oil-api) | Multi-brand prices (10 brands) | None |
| [Yahoo Finance](https://finance.yahoo.com) | Brent crude (BZ=F) intraday | None |
| [Frankfurter](https://api.frankfurter.app) | THB/USD exchange rate | None |
| [EPPO Catalog](https://catalog.eppo.go.th) | Historical retail fuel prices (22 years) | None |
| [efinancethai](https://www.efinancethai.com) | Backup fuel price feed | None |
| [FRED](https://fred.stlouisfed.org) | Fertilizer PPI, plastic resins PPI | API key |
| [OilPrice.com](https://oilprice.com/rss/main) | Energy news RSS | None |
| [gCaptain](https://gcaptain.com/feed/) | Shipping/maritime news RSS | None |
| [Natural Gas Intel](https://naturalgasintel.com/feed/) | LNG/gas market news RSS | None |
| [Bangkok Post](https://bangkokpost.com/rss/) | Thailand news RSS | None |

## Ingest Script

Standalone bun script that collects data from external APIs and pushes to D1 via `/api/ingest`.

```bash
# Dry run (show what would be sent)
bun tools/ingest.ts --dry-run

# Run all collectors
FUELTHAI_KEY=secret FRED_API_KEY=key bun tools/ingest.ts

# Run single collector
bun tools/ingest.ts --collector=eppo

# Available collectors: eppo, fred, efinance
```

For NAS/server deployment:
```bash
# Cron: daily at midnight UTC
0 0 * * * cd /path/to/thai-fuel && FUELTHAI_KEY=secret FRED_API_KEY=key bun tools/ingest.ts >> /var/log/fuelthai-ingest.log 2>&1
```

## Project Structure

```
src/
  components/       Shared UI (StationCard, SearchForm, SiteHeader/Footer, charts)
  lib/              Stores (Zustand), translations, brand/diesel config
  pages/            Route components (10 pages)
worker/
  worker.ts         Entry point -- global middleware, route mounting, SPA fallback
  shared.ts         Shared types, geohash, haversine, district lookup
  web-push.ts       VAPID JWT signing for CF Workers
  routes/
    prices.ts       Bangchak, thai-oil, crude, exchange rate
    news.ts         RSS feeds (OilPrice, gCaptain, NGI, Bangkok Post)
    stations.ts     Availability, station detail, province stations
    feed.ts         Live diesel status changes
    history.ts      Historical data, price history, ingest endpoint
    push.ts         Web Push subscriptions (with SSRF protection)
    cron.ts         DOEB pipeline, daily price capture, admin endpoints
    health.ts       Health check
  db/               D1 schema + seed SQL
  data/             District name translations (thai-districts.json)
tools/
  ingest.ts         Standalone bun script for NAS/external data collection
public/             Static assets, PWA manifest, brand logos
```

## API

### Public
- `GET /api/prices` -- Bangchak fuel prices
- `GET /api/brand-prices` -- All brands from thai-oil-api
- `GET /api/crude` -- Brent crude (Yahoo Finance / EIA)
- `GET /api/exchange` -- THB/USD exchange rate
- `GET /api/availability?postal=XXXXX&radius=N` -- Diesel availability near location
- `GET /api/stations?postal=XXXXX` -- PTT stations nearby
- `GET /api/station/:id` -- Station detail with status history
- `GET /api/stations/province/:id` -- All stations in a province
- `GET /api/feed` -- Live diesel status change feed
- `GET /api/news/energy` -- Aggregated energy news
- `GET /api/history/prices?metric=X&days=N` -- Historical price data
- `GET /api/history/prices/latest` -- Latest value per tracked metric
- `GET /api/health` -- Health check

### Authenticated (`X-Cron-Key` header)
- `GET /api/cron/trigger` -- Manually trigger DOEB snapshot
- `GET /api/cron/log` -- Cron run history
- `GET /api/cron/stats` -- Database stats
- `POST /api/ingest` -- Push metrics from external sources

## License

MIT
