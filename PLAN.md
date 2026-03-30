# FUEL::TH v3 -- Master Plan

**Live:** https://www.fuelthai.com\
**Staging:** https://fuel-staging.lanta.dev\
**Branch:** `v3-staging` (merge to `main` when ready)\
**Started:** March 24, 2026 -- built during the Iran war energy crisis\
**Audience:** All of Thailand -- Thai locals, expats, tourists. Bilingual EN/TH.

## What We Have (v2 -- SHIPPED)

- Real-time fuel prices from Bangchak API (today/yesterday/tomorrow)
- Multi-brand price comparison across 10 brands (thai-oil-api)
- Diesel availability from DOEB Fuel Now (24,548 stations, official government data)
- PumpRadar crowdsourced overlay (notes, photos, queue counts)
- Brent crude oil chart (EIA) + THB/USD exchange rate
- Bangkok Post RSS crisis news ticker
- Thai/English bilingual with browser auto-detection
- Station finder with live diesel status across ALL brands
- Stale report detection (8h+ dimmed + "POSSIBLY OUTDATED")
- Deployed on Cloudflare Workers with edge caching

## Architecture

```
                    fuel.lanta.dev
                         |
                  [CF Workers + Assets]
                    /    |    \
            [Hono API]  [SPA]  [Static]
              /  |  \
    [DOEB]  [PumpRadar]  [Bangchak]  [EIA]  [thai-oil-api]  [Frankfurter]  [BKK Post RSS]
```

**Stack:** Vite + React 19 + TypeScript 6 + TanStack Router + Tailwind v4 + Zustand\
**Worker:** Hono on Cloudflare Workers\
**Infra:** Workers Paid plan on DUPLO account

---

## v3 Roadmap

### Phase 1: Data Pipeline (D1 + R2) -- IN PROGRESS

The foundation for everything else. Historical data enables trend analysis, alerts, and station reliability scoring.

#### 1A. R2 Snapshots

Store full DOEB dumps every 15 minutes in R2.

- **Bucket:** `fuel-th-snapshots`
- **Key format:** `doeb/{YYYY-MM-DD}/{HH-MM}.json.gz` (gzipped, ~2-3MB each)
- **Retention:** 30 days (lifecycle rule), then archive to cold storage or drop
- **Size estimate:** ~2-3MB x 96/day x 30 days = ~8.6GB/month (well within R2 free tier)
- **Purpose:** Full audit trail, reprocessing, debugging, ML training data later

#### 1B. D1 Status History

Track per-station diesel status changes over time.

**Schema:**

```sql
-- Stations directory (refreshed from DOEB)
CREATE TABLE stations (
  id TEXT PRIMARY KEY,           -- hash of lat+lon or DOEB identifier
  name TEXT NOT NULL,
  brand TEXT,
  province TEXT,
  amphoe TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  first_seen TEXT NOT NULL,      -- ISO timestamp
  last_seen TEXT NOT NULL,       -- ISO timestamp
  last_diesel_status TEXT,       -- current status
  last_report_at TEXT            -- when last status was reported
);

-- Status change log (append-only)
CREATE TABLE status_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  fuel_code TEXT NOT NULL,       -- D, B20, G95, etc.
  old_status TEXT,
  new_status TEXT NOT NULL,
  reported_at TEXT NOT NULL,     -- ISO timestamp from DOEB
  recorded_at TEXT NOT NULL,     -- ISO timestamp when we saw it
  source TEXT DEFAULT 'doeb',    -- doeb or pumpradar
  FOREIGN KEY (station_id) REFERENCES stations(id)
);

-- Regional aggregates (computed every snapshot)
CREATE TABLE regional_stats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  province TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  total_stations INTEGER,
  diesel_available INTEGER,
  diesel_limited INTEGER,
  diesel_out INTEGER,
  diesel_pending INTEGER,
  diesel_unknown INTEGER
);

-- Indexes
CREATE INDEX idx_changes_station ON status_changes(station_id, recorded_at);
CREATE INDEX idx_changes_fuel ON status_changes(fuel_code, recorded_at);
CREATE INDEX idx_regional_province ON regional_stats(province, recorded_at);
CREATE INDEX idx_stations_province ON stations(province);
```

#### 1C. Cron Trigger

Runs every 15 minutes:

1. Fetch DOEB dump (~15MB JSON)
2. Gzip and store to R2
3. Diff against previous snapshot:
   - New stations -> INSERT into `stations`
   - Status changes -> INSERT into `status_changes`
   - Update `stations.last_diesel_status` and `last_seen`
4. Compute regional aggregates -> INSERT into `regional_stats`

**Cron schedule:** `*/15 * * * *`

#### 1D. History API

- `GET /api/history/station/:id` -- status changes for a station
- `GET /api/history/province/:name` -- regional stats over time
- `GET /api/history/summary` -- nationwide stats (total available/out/etc over time)

---

### Phase 2: Station Detail Pages

Deep-link pages for individual stations.

- **Route:** `/station/:id`
- **Content:**
  - Station name, brand, address, map embed
  - Current fuel status (all types, not just diesel)
  - Diesel status history chart (from D1)
  - PumpRadar notes timeline
  - Queue history
  - "Last had diesel: 3 hours ago" / "Dry for 2 days"
  - Directions button (Google Maps deep link)
  - Share button (generates OG-tagged URL)
- **Data:** D1 history + live DOEB + PumpRadar overlay

---

### Phase 3: Regional Dashboard

Province-level crisis overview.

- **Route:** `/region/:province` or `/region` for nationwide
- **Content:**
  - Province selector (77 provinces)
  - Diesel availability percentage over time (sparkline per province)
  - "Worst hit" provinces ranked by % stations with diesel
  - Station count by brand per province
  - Heat map (ambitious -- SVG Thailand map colored by availability)
- **Data:** `regional_stats` table from D1

---

### Phase 4: Push Notifications

"Alert me when diesel appears near me."

#### Architecture

```
[User subscribes]
     |
[Browser Push API] -> [subscription stored in D1]
     |
[Cron Trigger (every 15min)]
     |
[Diff DOEB snapshot] -> [station X changed to "available"]
     |
[Query D1: who watches this area?]
     |
[Web Push API -> send notification]
```

#### D1 Schema Addition

```sql
CREATE TABLE push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  radius INTEGER DEFAULT 20,
  postal TEXT,
  fuel_code TEXT DEFAULT 'D',    -- what fuel to watch
  lang TEXT DEFAULT 'th',
  created_at TEXT NOT NULL,
  last_notified_at TEXT
);

CREATE INDEX idx_push_location ON push_subscriptions(lat, lon);
```

#### Flow

1. User clicks "Notify me" on availability page
2. Browser prompts for notification permission
3. We store the Push subscription + their location in D1
4. Every 15min cron, after diffing DOEB data:
   - Find stations that changed from non-available -> available
   - Find subscriptions within radius of those stations
   - Send Web Push notification: "Diesel available at [station name] (Xkm away)"
5. Rate limit: max 1 notification per subscription per hour

#### Requirements

- VAPID keys (generate once, store as worker secrets)
- `web-push` compatible library for CF Workers (or raw Web Push protocol)
- Service Worker in the app for receiving push events

---

### Phase 5: PWA / Offline

Make the app installable and functional offline.

- **manifest.json** -- app name, icons, theme color, display: standalone
- **Service Worker:**
  - Cache app shell (HTML/JS/CSS) -- works offline
  - Cache last API responses -- show stale data with "offline" banner
  - Background sync -- queue searches for when connection returns
- **Icons:** Generate from FUEL::TH branding (192x192, 512x512)
- **Install prompt:** Show "Add to Home Screen" banner on mobile

#### Offline Strategy

| Resource | Cache Strategy |
|----------|---------------|
| App shell (HTML/JS/CSS) | Cache-first, update in background |
| /api/prices | Network-first, fall back to cache (max 1hr stale) |
| /api/availability | Network-first, fall back to cache (max 30min stale) |
| /api/crude, /api/exchange | Cache-first (changes slowly) |
| /api/news | Network-only (no point caching news offline) |

---

### Phase 6: SEO + Social Sharing

Make shared links look good on LINE, Facebook, Twitter.

- **OG tags** per page:
  - Home: "Thailand Fuel Prices -- FUEL::TH" + diesel price in description
  - Availability: "Diesel Availability near [postal/location]"
  - Station: "[Station Name] -- Diesel [status]"
  - Stats: "Thailand Fuel Crisis Stats"
- **Thai meta descriptions** (most shares will be in Thai on LINE)
- **Structured data** (JSON-LD) for Google:
  - GasStation schema for station pages
  - Product schema for fuel prices
- **Sitemap** -- auto-generated from province list
- **Share buttons** -- LINE, Facebook, copy link
- **Preview cards:** Dynamic OG images via CF Workers (SVG -> PNG)

---

### Phase 7: Advanced Features (Future)

#### 7A. Station Reliability Score

Use D1 history to compute per-station reliability:
- How often does reported status match reality? (cross-reference DOEB vs PumpRadar)
- How fresh are reports? (stations that report frequently score higher)
- How often does diesel appear/disappear? (volatile stations flagged)

Display as a trust indicator on station cards.

#### 7B. Fuel Price Predictor

Bangchak shows tomorrow's price. With EPPO data (when API key arrives):
- Oil Fund subsidy rate trends
- Crude price correlation
- Simple regression: "Based on Brent at $X and THB/USD at Y, diesel likely to be Z next week"
- NOT financial advice -- informational context only

#### 7C. Route Planner

"I'm driving from Bangkok to Chiang Mai -- where should I fill up?"
- Input: origin + destination
- Query stations along the route (Google Directions API or OSM routing)
- Show diesel availability at each stop
- Suggest optimal fill-up points

#### 7D. Community Reports

Allow users to submit status reports directly through FUEL::TH:
- "I'm at this station, diesel is available"
- No login required (rate limit by IP/device fingerprint)
- Store in D1, overlay alongside DOEB + PumpRadar
- Upvote/confirm other reports

#### 7E. LINE Bot

Thailand's #1 messaging app. A LINE bot that responds to:
- "diesel 81150" -> availability near postal code
- "price" -> today's diesel price
- "alert 81150" -> subscribe to push alerts via LINE
- Could reach millions of users who don't use web apps

#### 7F. Multi-Language Expansion

Add more languages for the tourism angle:
- Chinese (huge tourist segment)
- Russian (Phuket/Pattaya)
- German (Koh Samui/Lanta)
- Japanese/Korean

#### 7G. API for Third Parties

Public API with rate limiting for:
- Other developers building fuel tools
- News organizations embedding data
- Fleet management companies
- Ride-hailing services (Grab, Bolt)

Documentation page at `/api/docs` with OpenAPI spec.

#### 7H. EPPO Integration (When API Key Arrives)

Once the EPPO API key is approved:
- Oil Fund balance and burn rate
- Tax breakdown per fuel type (crude + excise + municipal + VAT + fund levy = pump price)
- Wholesale vs retail price spread
- Import volume by source country
- Refinery utilization rate

This turns the stats page into the most comprehensive fuel economics dashboard in Thailand.

---

## Infrastructure Summary

| Resource | Purpose | Tier |
|----------|---------|------|
| **CF Worker** (thai-fuel) | API + SPA serving | Workers Paid |
| **CF Worker** (thai-fuel-staging) | Staging | Workers Paid |
| **D1** (fuel-th-db) | Status history, subscriptions, regional stats | Free (5M rows) |
| **R2** (fuel-th-snapshots) | DOEB dump archive | Free (10GB) |
| **Cron Trigger** | 15min DOEB snapshot + diff | Workers Paid |
| **Web Push** | Diesel availability alerts | VAPID keys (free) |

**Estimated monthly cost:** $5 (Workers Paid plan). Everything else fits in free tier limits for the foreseeable future.

---

## File Structure (v3 Target)

```
src/
  components/
    language-toggle.tsx
    svg-chart.tsx
    station-card.tsx        # shared station card component
    diesel-badge.tsx        # shared diesel status badge
    search-controls.tsx     # shared postal/gps search
  lib/
    language-store.ts
    translations.ts
    geolocation.ts
  pages/
    home-page.tsx
    availability-page.tsx
    stations-page.tsx
    stats-page.tsx
    station-detail-page.tsx  # NEW
    region-page.tsx          # NEW
worker/
  worker.ts                  # Hono API routes
  cron.ts                    # Cron Trigger handler
  db/
    schema.sql               # D1 schema
    queries.ts               # Type-safe D1 query helpers
  data/
    thai-postal-codes.json
```

---

## Timeline

| Phase | What | Status |
|-------|------|--------|
| v2 | Core app (prices, availability, stations, stats, i18n) | SHIPPED |
| v3 Phase 1 | D1 + R2 data pipeline | IN PROGRESS |
| v3 Phase 2 | Station detail pages | Next |
| v3 Phase 3 | Regional dashboard | Next |
| v3 Phase 4 | Push notifications | Next |
| v3 Phase 5 | PWA / offline | Next |
| v3 Phase 6 | SEO + social sharing | Next |
| v3 Phase 7 | Advanced features | Future |

---

*Built with rage during the 2026 Iran war energy crisis.*\
*Maintained by WALL-E (the one who cares about Earth's resources).*
