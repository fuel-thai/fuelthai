# FUEL::TH

Real-time Thailand fuel prices, diesel availability, and station finder for 24,548+ stations. Built during the 2026 Iran war energy crisis.

**Live:** https://www.fuelthai.com

## What it does

- Real-time diesel availability from DOEB Fuel Now (government) + PumpRadar (crowdsourced)
- Multi-brand fuel prices from Bangchak API + thai-oil-api (10 brands)
- Brent crude oil chart (Yahoo Finance, EIA fallback)
- THB/USD exchange rate tracking
- Energy news aggregation (OilPrice, gCaptain, Natural Gas Intel, Bangkok Post)
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

## Setup

```bash
# Install dependencies
npm install

# Copy config templates
cp wrangler.example.toml wrangler.toml  # Edit with your CF resources
cp .env.example .env                     # Add analytics tokens (optional)

# Create D1 database
wrangler d1 create fuel-th-db
# Update database_id in wrangler.toml

# Create R2 bucket
wrangler r2 bucket create fuel-th-snapshots

# Initialize D1 schema
wrangler d1 execute fuel-th-db --remote --file worker/db/schema.sql
wrangler d1 execute fuel-th-db --remote --file worker/db/provinces.sql

# Set secrets
wrangler secret put CRON_SECRET
wrangler secret put VAPID_PRIVATE_KEY

# Generate VAPID keys (if you don't have them)
npx web-push generate-vapid-keys

# Development
npm run dev          # Frontend (port 4000)
npm run dev:worker   # Worker (port 8787)

# Deploy
npm run deploy
```

## Environment Variables

### Build-time (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_CF_BEACON` | No | Cloudflare Web Analytics token |
| `VITE_GA_ID` | No | Google Analytics measurement ID |

### Worker Secrets (`wrangler secret put`)

| Secret | Required | Description |
|--------|----------|-------------|
| `CRON_SECRET` | Yes | Auth token for admin/cron endpoints (`X-Cron-Key` header) |
| `VAPID_PRIVATE_KEY` | Yes | Web Push VAPID private key |

### Worker Vars (`wrangler.toml [vars]`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VAPID_PUBLIC_KEY` | Yes | Web Push VAPID public key |
| `VAPID_SUBJECT` | Yes | Web Push contact (mailto: URL) |

## Data Sources

| Source | Used For | Auth |
|--------|----------|------|
| [DOEB Fuel Now](https://fuel-now.doeb.go.th) | 24,548 stations + diesel status | None |
| [PumpRadar](https://thaipumpradar.com) | Crowdsourced notes, photos, queues | None |
| [Bangchak API](https://oil-price.bangchak.co.th) | Fuel prices (today/yesterday/tomorrow) | None |
| [thai-oil-api](https://api.chnwt.dev/thai-oil-api) | Multi-brand prices (10 brands) | None |
| [Yahoo Finance](https://finance.yahoo.com) | Brent crude (BZ=F) intraday | None |
| [EIA](https://api.eia.gov) | Brent crude daily (fallback) | DEMO_KEY |
| [Frankfurter](https://api.frankfurter.app) | THB/USD exchange rate | None |
| [OilPrice.com](https://oilprice.com/rss/main) | Energy news RSS | None |
| [gCaptain](https://gcaptain.com/feed/) | Shipping/maritime news RSS | None |
| [Natural Gas Intel](https://naturalgasintel.com/feed/) | LNG/gas market news RSS | None |
| [Bangkok Post](https://bangkokpost.com/rss/) | Thailand news RSS | None |

## Project Structure

```
src/
  components/     React components (UI, charts, feed, push)
  hooks/          Custom React hooks
  lib/            Stores (Zustand), translations, geolocation
  pages/          Route components (10 pages)
worker/
  worker.ts       Hono API + cron handler (~1400 lines)
  web-push.ts     VAPID JWT signing for CF Workers
  db/             D1 schema + seed data
  data/           Thai postal codes (embedded)
public/           Static assets, PWA manifest, brand logos
```

## License

MIT
