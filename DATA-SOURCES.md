# FUEL::TH -- Data Sources & API Acknowledgments

## Live Data Sources

### 1. Bangchak Corporation -- Fuel Prices
- **Endpoint:** `https://oil-price.bangchak.co.th/apioilprice2/en`
- **Method:** GET (no auth)
- **Data:** Today's retail fuel prices (7 fuel types), tomorrow's announced price, price change deltas
- **Freshness:** Daily, effective 05:00 AM Bangkok time
- **Used for:** `/api/prices`, `/api/diesel`, `/api/prices/th`
- **License:** Public API, no documented terms. Bangchak Corporation (BCP) is a Thai public company listed on SET.
- **Website:** https://www.bangchak.co.th

### 2. PTT Station API -- Station Locations & Fuel Types
- **Endpoint:** `https://www.pttstation.com/mobilecontrol/list_station`
- **Method:** POST with JSON body
- **Auth:** Static key `1234` (found in public HTML source)
- **Data:** 2,000+ PTT/OR stations with GPS coordinates, addresses, available fuel types, services, phone numbers
- **Freshness:** Real-time query (sorted by distance from query point)
- **Used for:** `/api/stations`
- **License:** Undocumented mobile API. PTT Public Company Limited is Thailand's state oil company.
- **Website:** https://www.pttstation.com

### 3. PumpRadar -- Real-Time Fuel Availability (Crowdsourced)
- **Endpoint:** `https://thaipumpradar.com/api/stations/nearby`
- **Method:** GET (no auth for reads)
- **Data:** Crowdsourced station status: fuel availability (available/limited/out/pending_delivery), reporter notes, confidence scores, photos, expected restock times, report timestamps
- **Freshness:** Real-time (reports expire after ~6 hours)
- **Used for:** `/api/availability`
- **Creator:** Chanon Ngernthongdee (@killernay) -- built as a community response to the 2026 fuel crisis
- **Tech:** Next.js, Cloudflare, OpenStreetMap data, LINE OAuth for reporters
- **License:** No documented terms. Community/open project.
- **Website:** https://thaipumpradar.com

### 4. Thai Postal Code Dataset -- Geocoding
- **Source:** https://github.com/rathpanyowat/Thai-zip-code-latitude-and-longitude
- **Data:** 750 Thai postal codes mapped to lat/lng coordinates with province and district names
- **Used for:** Postal code to coordinate resolution in `/api/stations` and `/api/availability`
- **License:** Public GitHub repository
- **Author:** rathpanyowat

## Reference Data Sources (researched, not yet integrated)

### 5. EPPO Official API -- Government Energy Data
- **Base URL:** `https://api.eppo.go.th/v1/openAPI/`
- **Docs:** `https://apidoc.eppo.go.th/`
- **Data:** Retail/wholesale fuel prices, Oil Fund rates, tax breakdowns, world oil prices, import/export volumes
- **Auth:** Free API key registration at `https://data.eppo.go.th/RequestAPI`
- **Status:** Researched, not integrated. Best source for Oil Fund and tax data.
- **Organization:** Energy Policy and Planning Office, Ministry of Energy, Thailand

### 6. OpenStreetMap Overpass API -- All-Brand Station Data
- **Endpoint:** `https://overpass-api.de/api/interpreter`
- **Data:** 8,601 fuel stations in Thailand across all brands (PTT, Shell, Bangchak, Caltex, Esso, Susco, etc.)
- **Auth:** None
- **Status:** Researched, not integrated. Best source for non-PTT station locations.
- **License:** Open Database License (ODbL)

### 7. Motorist Thailand -- Multi-Brand Price History
- **URL:** `https://www.motorist.co.th/en/petrol-prices`
- **Data:** 6 months daily price history for 8 brands, embedded as Chartkick JSON
- **Auth:** None (HTML scrape)
- **Status:** Researched, not integrated. Best source for brand comparison and historical trends.

### 8. GeoNames -- Geographic Data
- **Endpoint:** `http://api.geonames.org/`
- **Account:** `icanhasjonas`
- **Data:** Postal code lookup, geographic features, elevation
- **Status:** Available as geocoding fallback
- **License:** Creative Commons Attribution 4.0

### 9. DOEB Fuel Monitoring -- Government B2B System
- **URL:** `https://fuelmonitoring.doeb.go.th`
- **Data:** Fuel reserve quantities reported by oil companies to government
- **Auth:** OAuth (Client ID + Secret + API Key), company registration required
- **Status:** B2B only, not public-facing. This is what the media calls "Fuel Now."
- **Organization:** Department of Energy Business (กรมธุรกิจพลังงาน)
- **Contractor:** Prompt Technical Services Limited

## Architecture

```
User Request
    |
    v
Cloudflare Workers (edge cache: 5-30 min)
    |
    +-- /api/prices ---------> Bangchak API (daily prices)
    +-- /api/diesel ---------> Bangchak API (diesel quick check)
    +-- /api/stations -------> PTT Station API (locations + fuel types)
    +-- /api/availability ---> PumpRadar API (real-time crowdsourced status)
    +-- /api/prices/th ------> Bangchak API (Thai language)
    +-- /api/health ---------> Internal
    |
    +-- Postal Code Lookup --> Embedded dataset (750 codes, zero latency)
```

## Caching Strategy

| Endpoint | Cache TTL | Stale-While-Revalidate | Stale-If-Error | Rationale |
|----------|-----------|----------------------|----------------|-----------|
| `/api/prices` | 30 min | 60 min | -- | Prices change once daily at 05:00 |
| `/api/availability` | 5 min | 10 min | 30 min | Crowdsourced reports, ~6h expiry |
| `/api/stations` | none | -- | -- | Live query, distance-sorted |
| `/api/diesel` | none | -- | -- | Quick check, always fresh |
| Static assets | Cloudflare default | -- | -- | Immutable hashed filenames |

## Acknowledgments

- **Bangchak Corporation** for maintaining an open, unauthenticated JSON API for fuel prices
- **PTT Public Company Limited** for the station finder API
- **Chanon Ngernthongdee (@killernay)** for building PumpRadar -- the real public-facing fuel availability tool that the government couldn't deliver
- **rathpanyowat** for the Thai postal code geocoding dataset
- **OpenStreetMap contributors** for mapping 8,601 fuel stations in Thailand
- **EPPO** for maintaining government energy statistics

## Disclaimer

This application aggregates publicly available data from third-party APIs. It is not affiliated with the Thai government, PTT, Bangchak, or any fuel company. Fuel availability data from PumpRadar is crowdsourced and may not be 100% accurate. Always confirm availability before traveling.

---

*Built during the 2026 Iran war energy crisis. Deployed at [fuel.lanta.dev](https://fuel.lanta.dev).*
