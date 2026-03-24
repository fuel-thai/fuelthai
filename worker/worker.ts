import { Hono } from "hono";
import { sendWebPush } from "./web-push";
import { cors } from "hono/cors";
import { cache } from "hono/cache";
import postalCodes from "./data/thai-postal-codes.json";

type Bindings = {
	ASSETS: Fetcher;
	CRON_SECRET?: string;
	VAPID_PUBLIC_KEY?: string;
	VAPID_PRIVATE_KEY?: string;
	VAPID_SUBJECT?: string;
	DB: D1Database;
	R2: R2Bucket;
};

function safeLimit(raw: string | undefined, defaultVal: number, max: number): number {
	const n = Number(raw || defaultVal);
	if (!Number.isFinite(n) || n < 1) return defaultVal;
	return Math.min(Math.floor(n), max);
}

interface PostalCode {
	id: string;
	zip: string;
	province: string;
	district: string;
	lat: number;
	lng: number;
}

const postalLookup = new Map<string, PostalCode>();
for (const entry of postalCodes as PostalCode[]) {
	if (!postalLookup.has(entry.zip)) {
		postalLookup.set(entry.zip, entry);
	}
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function geohash(lat: number, lon: number, precision = 5): string {
	const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
	let minLat = -90, maxLat = 90, minLon = -180, maxLon = 180;
	let hash = "", bit = 0, ch = 0, isLon = true;
	while (hash.length < precision) {
		const mid = isLon ? (minLon + maxLon) / 2 : (minLat + maxLat) / 2;
		const val = isLon ? lon : lat;
		if (val >= mid) { ch |= (1 << (4 - bit)); isLon ? (minLon = mid) : (minLat = mid); }
		else { isLon ? (maxLon = mid) : (maxLat = mid); }
		if (++bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0; }
		isLon = !isLon;
	}
	return hash;
}

function geohashNeighbors(hash: string): string[] {
	const decoded = decodeGeohash(hash);
	// Cell size depends on precision: p3=~156km, p4=~39km, p5=~5km
	const offsets: Record<number, number> = { 3: 1.5, 4: 0.4, 5: 0.05 };
	const d = offsets[hash.length] || 0.05;
	const neighbors: string[] = [hash];
	for (const latOff of [-d, 0, d]) {
		for (const lonOff of [-d, 0, d]) {
			if (latOff === 0 && lonOff === 0) continue;
			neighbors.push(geohash(decoded.lat + latOff, decoded.lon + lonOff, hash.length));
		}
	}
	return [...new Set(neighbors)];
}

function decodeGeohash(hash: string): { lat: number; lon: number } {
	const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
	let minLat = -90, maxLat = 90, minLon = -180, maxLon = 180;
	let isLon = true;
	for (const c of hash) {
		const idx = BASE32.indexOf(c);
		for (let bit = 4; bit >= 0; bit--) {
			const mid = isLon ? (minLon + maxLon) / 2 : (minLat + maxLat) / 2;
			if (idx & (1 << bit)) { isLon ? (minLon = mid) : (minLat = mid); }
			else { isLon ? (maxLon = mid) : (maxLat = mid); }
			isLon = !isLon;
		}
	}
	return { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
}

function stationHash(lat: number, lon: number, name: string): string {
	const input = `${lat.toFixed(5)}:${lon.toFixed(5)}:${name}`;
	let hash = 5381;
	for (let i = 0; i < input.length; i++) {
		hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
	}
	return hash.toString(36).padStart(7, "0");
}

const app = new Hono<{ Bindings: Bindings }>();

function parseBangchakDate(dateStr: string): string {
	const [d, m, y] = dateStr.split("/");
	return `${y}-${m}-${d}`;
}

app.use("/api/*", cors({
	origin: ["https://fuelthai.com", "https://www.fuelthai.com", "https://fuel.lanta.dev", "https://fuel-staging.lanta.dev", "https://thai-fuel.preview.frst.dev"],
	allowMethods: ["GET", "OPTIONS"],
}));

// Security headers on all API responses
app.use("/api/*", async (c, next) => {
	await next();
	c.header("X-Content-Type-Options", "nosniff");
	c.header("X-Frame-Options", "DENY");
});

// ─── Bangchak Prices ─────────────────────────────────────────────

app.get(
	"/api/prices",
	cache({ cacheName: "fuel-prices", cacheControl: "public, max-age=1800, stale-while-revalidate=3600" }),
	async (c) => {
		const res = await fetch("https://oil-price.bangchak.co.th/apioilprice2/en");
		const data = await res.json();

		if (!Array.isArray(data) || data.length === 0) {
			return c.json({ error: "No data from Bangchak API" }, 502);
		}

		const raw = data[0];
		const oilList = JSON.parse(raw.OilList);

		const prices = oilList.map(
			(item: { OilName: string; PriceToday: number; PriceYesterday: number; PriceTomorrow: number; PriceDifTomorrow: number }) => ({
				name: item.OilName,
				today: item.PriceToday,
				yesterday: item.PriceYesterday,
				tomorrow: item.PriceTomorrow,
				change: item.PriceDifTomorrow,
			}),
		);

		return c.json({
			date: parseBangchakDate(raw.OilDateNow),
			priceSetAt: `${parseBangchakDate(raw.OilPriceDate)}T${raw.OilPriceTime}:00+07:00`,
			effectiveFrom: `${parseBangchakDate(raw.OilDateNow)}T05:00:00+07:00`,
			remark: raw.OilRemark2,
			prices,
			source: "Bangchak Corporation",
		});
	},
);

app.get("/api/diesel", cache({ cacheName: "diesel-price", cacheControl: "public, max-age=1800" }), async (c) => {
	const res = await fetch("https://oil-price.bangchak.co.th/apioilprice2/en");
	const data = await res.json();

	if (!Array.isArray(data) || data.length === 0) {
		return c.json({ error: "No data" }, 502);
	}

	const raw = data[0];
	const oilList = JSON.parse(raw.OilList);
	const diesel =
		oilList.find((item: { OilName: string }) => item.OilName === "Hi Diesel S") ||
		oilList.find((item: { OilName: string }) => item.OilName.includes("Diesel") && !item.OilName.includes("Premium"));

	if (!diesel) {
		return c.json({ error: "Diesel not found in data" }, 404);
	}

	return c.json({
		fuel: diesel.OilName,
		price: diesel.PriceToday,
		yesterday: diesel.PriceYesterday,
		tomorrow: diesel.PriceTomorrow,
		change: diesel.PriceDifTomorrow,
		date: parseBangchakDate(raw.OilDateNow),
		effectiveFrom: `${parseBangchakDate(raw.OilDateNow)}T05:00:00+07:00`,
		unit: "THB/liter",
	});
});

app.get("/api/prices/th", cache({ cacheName: "prices-th", cacheControl: "public, max-age=1800" }), async (c) => {
	const res = await fetch("https://oil-price.bangchak.co.th/apioilprice2/th");
	const data = await res.json();

	if (!Array.isArray(data) || data.length === 0) {
		return c.json({ error: "No data" }, 502);
	}

	const raw = data[0];
	const oilList = JSON.parse(raw.OilList);

	return c.json({
		date: raw.OilDateNow,
		prices: oilList.map(
			(item: { OilName: string; PriceToday: number; PriceDifTomorrow: number }) => ({
				name: item.OilName,
				price: item.PriceToday,
				change: item.PriceDifTomorrow,
			}),
		),
	});
});

// ─── Multi-Brand Prices (thai-oil-api) ───────────────────────────

app.get(
	"/api/brand-prices",
	cache({ cacheName: "brand-prices-v5", cacheControl: "public, max-age=1800" }),
	async (c) => {
		try {
			const res = await fetch("https://api.chnwt.dev/thai-oil-api/latest");
			if (!res.ok) return c.json({ error: "thai-oil-api unavailable" }, 502);
			const data: any = await res.json();

			const brands: any[] = [];
			const stations = data.response?.stations || {};

			for (const [brandId, brandData] of Object.entries(stations)) {
				const bd = brandData as any;
				const fuels: Record<string, number> = {};
				for (const [fuelKey, fuelObj] of Object.entries(bd)) {
					const fo = fuelObj as any;
					if (fo && typeof fo === "object" && fo.price != null && fo.price !== "") {
						const p = Number(fo.price);
						if (p > 0) fuels[fuelKey] = p;
					}
				}

				const dieselPrice = fuels.diesel_b7 || fuels.diesel || fuels.hi_diesel || fuels.diesel_s || null;

				brands.push({
					id: brandId,
					name: brandId,
					diesel: dieselPrice,
					fuels,
				});
			}

			brands.sort((a, b) => (a.diesel || 999) - (b.diesel || 999));

			return c.json({
				date: data.response?.date || null,
				brands,
				count: brands.length,
				source: "thai-oil-api (gasprice.kapook.com)",
			});
		} catch (err) {
			return c.json({ error: "Failed to fetch brand prices", detail: "upstream_error" }, 502);
		}
	},
);

// ─── Brent Crude (Yahoo Finance -> EIA fallback) ────────────────

async function fetchYahooCrude(): Promise<any | null> {
	try {
		const url = "https://query1.finance.yahoo.com/v8/finance/chart/BZ=F?range=3mo&interval=1d";
		const res = await fetch(url, {
			headers: { "User-Agent": "Mozilla/5.0 (compatible; FUEL-TH/2.0)" },
		});
		if (!res.ok) return null;
		const data: any = await res.json();
		const result = data?.chart?.result?.[0];
		if (!result) return null;

		const timestamps = result.timestamp || [];
		const closes = result.indicators?.quote?.[0]?.close || [];
		const observations: { date: string; price: number }[] = [];

		for (let i = 0; i < timestamps.length; i++) {
			const price = closes[i];
			if (price == null || Number.isNaN(price)) continue;
			const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
			observations.push({ date, price: Math.round(price * 100) / 100 });
		}

		// Add real-time price from meta if market is open
		const meta = result.meta;
		if (meta?.regularMarketPrice && meta.regularMarketPrice !== closes[closes.length - 1]) {
			const now = new Date().toISOString().slice(0, 10);
			const lastObs = observations[observations.length - 1];
			if (lastObs && lastObs.date === now) {
				lastObs.price = Math.round(meta.regularMarketPrice * 100) / 100;
			} else {
				observations.push({ date: now, price: Math.round(meta.regularMarketPrice * 100) / 100 });
			}
		}

		return { observations, source: "Yahoo Finance (BZ=F)", marketState: meta?.marketState };
	} catch {
		return null;
	}
}

async function fetchEiaCrude(): Promise<any | null> {
	try {
		const now = new Date();
		const start = new Date(now);
		start.setDate(start.getDate() - 120);
		const startStr = start.toISOString().slice(0, 10);

		const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=DEMO_KEY&frequency=daily&data%5B0%5D=value&facets%5Bseries%5D%5B%5D=RBRTE&sort%5B0%5D%5Bcolumn%5D=period&sort%5B0%5D%5Bdirection%5D=asc&start=${startStr}&length=200`;
		const res = await fetch(url, { headers: { "User-Agent": "FUEL-TH/2.0" } });
		if (!res.ok) return null;
		const data: any = await res.json();

		const observations = (data.response?.data || [])
			.map((o: any) => ({ date: o.period, price: Number.parseFloat(o.value) }))
			.filter((o: any) => !Number.isNaN(o.price));

		return { observations, source: "U.S. Energy Information Administration (EIA)" };
	} catch {
		return null;
	}
}

app.get(
	"/api/crude",
	cache({ cacheName: "crude-prices-v2", cacheControl: "public, max-age=1800, stale-while-revalidate=3600" }),
	async (c) => {
		try {
			// Try Yahoo Finance first (intraday), fallback to EIA (daily)
			const result = await fetchYahooCrude() || await fetchEiaCrude();
			if (!result || result.observations.length === 0) {
				return c.json({ error: "All crude price sources unavailable" }, 502);
			}

			const { observations, source } = result;
			const latest = observations[observations.length - 1];
			const oldest = observations[0];
			const prices = observations.map((o: any) => o.price);
			const high = Math.max(...prices);
			const low = Math.min(...prices);

			return c.json({
				series: "DCOILBRENTEU",
				name: "Brent Crude Oil ($/barrel)",
				count: observations.length,
				latest,
				high,
				low,
				change: Math.round((latest.price - oldest.price) * 100) / 100,
				changePercent: Math.round(((latest.price / oldest.price - 1) * 100) * 10) / 10,
				observations,
				source,
				marketState: result.marketState || null,
			});
		} catch (err) {
			return c.json({ error: "Failed to fetch crude prices", detail: "upstream_error" }, 502);
		}
	},
);

// ─── Exchange Rate (Frankfurter) ─────────────────────────────────

app.get(
	"/api/exchange",
	cache({ cacheName: "exchange-rate-v2", cacheControl: "public, max-age=3600, stale-while-revalidate=7200" }),
	async (c) => {
		try {
			const latestRes = await fetch("https://api.frankfurter.app/latest?from=USD&to=THB", {
				headers: { "User-Agent": "FUEL-TH/2.0" },
			});

			if (!latestRes.ok) {
				const fallbackRes = await fetch("https://open.er-api.com/v6/latest/USD");
				if (!fallbackRes.ok) return c.json({ error: "Exchange rate APIs unavailable" }, 502);
				const fb: any = await fallbackRes.json();
				return c.json({
					rate: fb.rates?.THB,
					date: fb.time_last_update_utc?.slice(0, 10) || null,
					from: "USD",
					to: "THB",
					source: "ExchangeRate-API (fallback)",
				});
			}

			const latest: any = await latestRes.json();

			return c.json({
				rate: latest.rates?.THB,
				date: latest.date,
				from: "USD",
				to: "THB",
				source: "European Central Bank via Frankfurter",
			});
		} catch (err) {
			return c.json({ error: "Failed to fetch exchange rate", detail: "upstream_error" }, 502);
		}
	},
);

// ─── RSS Parsing Helper ─────────────────────────────────────────

interface NewsArticle {
	title: string;
	link: string;
	date: string;
	description: string;
	source: string;
	category: string;
}

function parseRssItems(xml: string, source: string, category: string): NewsArticle[] {
	const articles: NewsArticle[] = [];
	const itemRegex = /<item>([\s\S]*?)<\/item>/g;
	let match: RegExpExecArray | null;
	while ((match = itemRegex.exec(xml)) !== null) {
		const item = match[1];
		const title = item.match(/<title><!\[CDATA\[(.*?)\]\]>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || "";
		const link = item.match(/<link>(.*?)<\/link>/)?.[1] || "";
		const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || "";
		const desc = item.match(/<description><!\[CDATA\[(.*?)\]\]>/)?.[1] || item.match(/<description>(.*?)<\/description>/)?.[1] || "";
		if (!title || !link) continue;
		articles.push({
			title: title.trim(),
			link: link.trim(),
			date: pubDate ? new Date(pubDate).toISOString() : "",
			description: desc.replace(/<[^>]*>/g, "").trim().slice(0, 200),
			source,
			category,
		});
	}
	return articles;
}

async function fetchRss(url: string): Promise<string> {
	try {
		const res = await fetch(url, { headers: { "User-Agent": "FUEL-TH/2.0 (fuel crisis tracker)" } });
		return res.ok ? await res.text() : "";
	} catch {
		return "";
	}
}

// ─── News (Bangkok Post RSS - legacy, still works) ──────────────

app.get(
	"/api/news",
	cache({ cacheName: "fuel-news-v2", cacheControl: "public, max-age=900, stale-while-revalidate=1800" }),
	async (c) => {
		const FUEL_KEYWORDS = /fuel|diesel|oil price|crude|energy crisis|petrol|gasoline|EPPO|Oil Fund|pump|LPG|NGV|Hormuz|refiner|sanctions?|Iran|tanker|shipping|OPEC/i;

		try {
			const feeds = ["most-recent", "business", "thailand"];
			const results = await Promise.all(
				feeds.map((feed) => fetchRss(`https://www.bangkokpost.com/rss/data/${feed}.xml`)),
			);

			const allXml = results.join("\n");
			const articles = parseRssItems(allXml, "Bangkok Post", "thailand");
			const seen = new Set<string>();
			const filtered = articles.filter((a) => {
				if (seen.has(a.link)) return false;
				seen.add(a.link);
				return FUEL_KEYWORDS.test(a.title) || FUEL_KEYWORDS.test(a.description);
			});

			filtered.sort((a, b) => (b.date > a.date ? 1 : -1));

			return c.json({
				count: filtered.length,
				articles: filtered.slice(0, 15),
				source: "Bangkok Post RSS",
			});
		} catch (err) {
			return c.json({ error: "Failed to fetch news", detail: "upstream_error" }, 502);
		}
	},
);

// ─── Multi-Source Energy News ────────────────────────────────────

const ENERGY_RSS_SOURCES = [
	{ url: "https://oilprice.com/rss/main", source: "OilPrice.com", category: "energy" },
	{ url: "https://oilprice.com/rss/breaking_news", source: "OilPrice.com", category: "energy" },
	{ url: "https://gcaptain.com/feed/", source: "gCaptain", category: "shipping" },
	{ url: "https://www.naturalgasintel.com/feed/", source: "Natural Gas Intel", category: "energy" },
	{ url: "https://www.bangkokpost.com/rss/data/business.xml", source: "Bangkok Post", category: "thailand" },
	{ url: "https://www.bangkokpost.com/rss/data/most-recent.xml", source: "Bangkok Post", category: "thailand" },
];

app.get(
	"/api/news/energy",
	cache({ cacheName: "energy-news-v1", cacheControl: "public, max-age=900, stale-while-revalidate=1800" }),
	async (c) => {
		const ENERGY_KEYWORDS = /fuel|diesel|oil|crude|energy|petrol|gasoline|LPG|NGV|OPEC|refiner|tanker|shipping|pipeline|sanction|Iran|Hormuz|barrel|brent|WTI|LNG|natural gas|EPPO|Oil Fund|supply chain|embargo|blockade/i;
		const limit = safeLimit(c.req.query("limit"), 30, 100);
		const sourceFilter = c.req.query("source");

		try {
			const feedResults = await Promise.all(
				ENERGY_RSS_SOURCES.map(async ({ url, source, category }) => {
					const xml = await fetchRss(url);
					return parseRssItems(xml, source, category);
				}),
			);

			const seen = new Set<string>();
			const allArticles: NewsArticle[] = [];

			for (const articles of feedResults) {
				for (const a of articles) {
					if (seen.has(a.link)) continue;
					seen.add(a.link);

					// Bangkok Post gets keyword-filtered, energy sources pass through
					if (a.category === "thailand") {
						if (!ENERGY_KEYWORDS.test(a.title) && !ENERGY_KEYWORDS.test(a.description)) continue;
					}
					allArticles.push(a);
				}
			}

			allArticles.sort((a, b) => (b.date > a.date ? 1 : -1));

			const filtered = sourceFilter
				? allArticles.filter((a) => a.source.toLowerCase().includes(sourceFilter.toLowerCase()))
				: allArticles;

			const sourceCounts: Record<string, number> = {};
			for (const a of allArticles) {
				sourceCounts[a.source] = (sourceCounts[a.source] || 0) + 1;
			}

			return c.json({
				count: filtered.length,
				articles: filtered.slice(0, limit),
				sources: sourceCounts,
			});
		} catch (err) {
			return c.json({ error: "Failed to fetch energy news", detail: "upstream_error" }, 502);
		}
	},
);

// ─── PTT Stations ────────────────────────────────────────────────

app.get("/api/stations", async (c) => {
	const postal = c.req.query("postal");
	const latQ = c.req.query("lat");
	const lngQ = c.req.query("lng");
	const radiusQ = c.req.query("radius");
	const radius = radiusQ ? Number.parseFloat(radiusQ) : 20;

	let lat: number;
	let lng: number;

	if (postal) {
		const entry = postalLookup.get(postal);
		if (!entry) {
			return c.json({ error: `Unknown postal code: ${postal}. Thai postal codes are 5 digits (10000-96000).` }, 400);
		}
		lat = entry.lat;
		lng = entry.lng;
	} else if (latQ && lngQ) {
		lat = Number.parseFloat(latQ);
		lng = Number.parseFloat(lngQ);
		if (Number.isNaN(lat) || Number.isNaN(lng)) {
			return c.json({ error: "Invalid lat/lng values" }, 400);
		}
	} else {
		return c.json({ error: "Provide ?postal=XXXXX or ?lat=X&lng=Y" }, 400);
	}

	if (Number.isNaN(radius) || radius < 1 || radius > 200) {
		return c.json({ error: "Radius must be 1-200 km" }, 400);
	}

	try {
		const pttRes = await fetch("https://www.pttstation.com/mobilecontrol/list_station", {
			method: "POST",
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				authen_key: "1234",
			},
			body: JSON.stringify({
				page: "1", limit: "30", station_type: "OIL", product_id: "", service_id: "",
				keyword: "", province: "", amphur: "", ngv_type: "",
				clat: String(lat), clng: String(lng), station_id: "",
				near_type: "1", bound_type: "", promotion_id: "",
				country_type_id: "1", language: "en",
			}),
		});

		if (!pttRes.ok) {
			return c.json({ error: "PTT Station API unavailable", status: pttRes.status }, 502);
		}

		const pttData: any = await pttRes.json();
		const rawStations: any[] = pttData?.data || [];

		const stations = rawStations
			.map((s: any) => {
				const sLat = Number.parseFloat(s.lat || "0");
				const sLng = Number.parseFloat(s.lng || "0");
				const distance = s.km ? Number.parseFloat(s.km) : haversineKm(lat, lng, sLat, sLng);
				const fuels: string[] = Array.isArray(s.product) ? s.product.map((p: any) => p.name || "Unknown") : [];
				const hasDiesel = fuels.some((f) => f.toLowerCase().includes("diesel"));
				const services: string[] = Array.isArray(s.service) ? s.service.map((svc: any) => svc.name || "").filter(Boolean) : [];

				return {
					name: s.name || "PTT Station",
					brand: "PTT",
					distance: Math.round(distance * 10) / 10,
					lat: sLat, lng: sLng,
					address: s.address || "",
					province: s.province_name || "",
					fuels, hasDiesel,
					phone: s.phone || null,
					openHours: s.open_hours || s.openHours || null,
					selfServe: s.self_serve === "1",
					services,
					link: s.link_share || null,
					source: "PTT Station API",
				};
			})
			.filter((s) => s.distance <= radius)
			.sort((a, b) => a.distance - b.distance);

		return c.json({
			query: { lat, lng, radius, postal: postal || null },
			count: stations.length,
			stations,
			source: "PTT Station API",
		});
	} catch (err) {
		return c.json({ error: "Failed to reach PTT Station API", message: err instanceof Error ? err.message : "Unknown error" }, 502);
	}
});

// DOEB cache kept ONLY for cron handler (not for API queries)
let doebCache: { stations: any[]; fetchedAt: number } | null = null;

// ─── Availability (D1 geohash lookup + PumpRadar overlay) ───────

app.get(
	"/api/availability",
	cache({ cacheName: "availability-v4", cacheControl: "public, max-age=300, stale-if-error=1800" }),
	async (c) => {
		const postal = c.req.query("postal");
		const latQ = c.req.query("lat");
		const lngQ = c.req.query("lng");
		const radiusQ = c.req.query("radius");
		const radius = radiusQ ? Math.min(Number.parseFloat(radiusQ), 50) : 10;

		let lat: number;
		let lng: number;
		let locationName = "";

		if (postal) {
			const entry = postalLookup.get(postal);
			if (!entry) return c.json({ error: `Unknown postal code: ${postal}` }, 400);
			lat = entry.lat;
			lng = entry.lng;
			locationName = `${entry.district}, ${entry.province}`;
		} else if (latQ && lngQ) {
			lat = Number.parseFloat(latQ);
			lng = Number.parseFloat(lngQ);
		} else {
			return c.json({ error: "Provide ?postal=XXXXX or ?lat=X&lng=Y" }, 400);
		}

		try {
			// Geohash lookup: precision 4 (~39km cells) + neighbors for coverage
			const gh4 = geohash(lat, lng, 4);
			const searchHashes = geohashNeighbors(gh4);
			const conditions = searchHashes.map(() => "s.geohash5 LIKE ?").join(" OR ");
			const params = searchHashes.map((gh) => `${gh}%`);

			const result = await c.env.DB.prepare(
				`SELECT s.id, s.name, s.brand_id as brand, s.amphoe, s.lat, s.lon, s.last_diesel_status, s.last_report_at,
					p.name_en as province_en, p.name_th as province_th
				FROM stations s
				LEFT JOIN provinces p ON s.province_id = p.id
				WHERE ${conditions}`,
			).bind(...params).all();

			// Exact haversine filter (geohash is coarse, ~39km cells)
			const nearby = (result.results as any[])
				.map((s) => ({ ...s, _dist: haversineKm(lat, lng, s.lat, s.lon) }))
				.filter((s) => s._dist <= radius);

			// PumpRadar overlay for crowdsourced notes/photos/queue
			const prLookup = new Map<string, any>();
			try {
				const prRes = await fetch(
					`https://thaipumpradar.com/api/stations/nearby?lat=${lat}&lon=${lng}&radius=${Math.min(radius, 30)}`,
					{ headers: { "User-Agent": "FUEL-TH/2.0 (fuel.lanta.dev)" } },
				);
				if (prRes.ok) {
					for (const ps of ((await prRes.json()) as any)?.stations || []) {
						prLookup.set(`${(ps.lat || 0).toFixed(3)},${(ps.lon || 0).toFixed(3)}`, ps);
					}
				}
			} catch { /* PumpRadar down is not fatal */ }

			const STALE_THRESHOLD = 480;
			const stations = nearby.map((s) => {
				const pr = prLookup.get(`${s.lat.toFixed(3)},${s.lon.toFixed(3)}`);
				const prReport = pr?.latestReport || {};
				const doebTime = s.last_report_at ? new Date(s.last_report_at).getTime() : null;
				const reportTime = doebTime || prReport.createdAt || null;
				const reportAge = reportTime ? Math.round((Date.now() - reportTime) / 60000) : null;
				const isStale = reportAge !== null && reportAge > STALE_THRESHOLD;
				const raw = s.last_diesel_status || "unknown";
				const dieselStatus = isStale ? "unknown" : raw;

				return {
					id: s.id,
					name: s.name || "Unknown Station",
					brand: s.brand || "OTHER",
					distance: Math.round(s._dist * 10) / 10,
					lat: s.lat,
					lng: s.lon,
					province: s.province_en || s.province_th || "",
					district: s.amphoe || "",
					verified: pr?.verified || false,
					diesel: { status: dieselStatus, available: dieselStatus === "available" || dieselStatus === "limited", expected: dieselStatus === "pending_delivery", restock: prReport.expectedRestock || null },
					fuelStatus: {} as Record<string, string>,
					queue: { count: isStale ? null : (prReport.queueCount || null), expires: null },
					report: {
						age: reportAge,
						ageText: reportAge !== null ? (reportAge < 60 ? `${reportAge}m ago` : `${Math.round(reportAge / 60)}h ago`) : "no report",
						stale: isStale,
						confidence: isStale ? 0 : (prReport.confidence || (doebTime ? 0.5 : 0)),
						confirms: isStale ? 0 : (prReport.confirmCount || 0),
						denies: isStale ? 0 : (prReport.denyCount || 0),
						note: isStale ? null : (prReport.note || null),
						photo: isStale ? null : (prReport.photoUrl || null),
						expires: null,
					},
					directions: `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=driving`,
					source: doebTime ? "DOEB Fuel Now (official)" : pr ? "PumpRadar (crowdsourced)" : "DOEB directory",
				};
			});

			stations.sort((a, b) => {
				if (a.report.stale !== b.report.stale) return a.report.stale ? 1 : -1;
				const hasData = (s: typeof a) => s.diesel.status !== "unknown";
				if (hasData(a) !== hasData(b)) return hasData(a) ? -1 : 1;
				const order = (s: typeof a) => s.diesel.available ? 0 : s.diesel.expected ? 1 : s.diesel.status === "out" ? 3 : 2;
				const diff = order(a) - order(b);
				return diff !== 0 ? diff : a.distance - b.distance;
			});

			return c.json({
				query: { lat, lng, radius, postal: postal || null, location: locationName || null },
				count: stations.length,
				dieselAvailable: stations.filter((s) => s.diesel.available).length,
				dieselExpected: stations.filter((s) => s.diesel.expected).length,
				dieselOut: stations.filter((s) => s.diesel.status === "out").length,
				stations,
				source: "DOEB Fuel Now (D1 geohash) + PumpRadar (crowdsourced)",
			});
		} catch (err) {
			return c.json({ error: "Availability data temporarily unavailable" }, 502);
		}
	},
);

// ─── Live Feed: chronological status changes ────────────────────

app.get(
	"/api/feed",
	cache({ cacheName: "feed-v5", cacheControl: "public, max-age=300" }),
	async (c) => {
		const db = c.env.DB;
		if (!db) return c.json({ error: "Database not configured" }, 500);

		const limit = safeLimit(c.req.query("limit"), 50, 200);
		const provinceId = c.req.query("province") ? Number(c.req.query("province")) : null;

		let query = `
			SELECT sc.station_id, sc.fuel_code, sc.old_status, sc.new_status, sc.recorded_at, sc.source,
				s.name as station_name, s.brand_id, s.amphoe, s.lat, s.lon,
				p.name_th as province_th, p.name_en as province_en, p.region
			FROM status_changes sc
			JOIN stations s ON sc.station_id = s.id
			LEFT JOIN provinces p ON s.province_id = p.id
		`;

		if (provinceId) {
			query += ` WHERE s.province_id = ? ORDER BY sc.recorded_at DESC LIMIT ?`;
			const results = await db.prepare(query).bind(provinceId, limit).all();
			return c.json({ changes: results.results, count: results.results.length });
		}

		query += ` ORDER BY sc.recorded_at DESC LIMIT ?`;
		const results = await db.prepare(query).bind(limit).all();
		return c.json({ changes: results.results, count: results.results.length });
	},
);

// ─── Station detail (from D1) ─────────────────────────────────────

app.get(
	"/api/station/:id",
	cache({ cacheName: "station-detail-v1", cacheControl: "public, max-age=300" }),
	async (c) => {
		const db = c.env.DB;
		if (!db) return c.json({ error: "Database not configured" }, 500);

		const id = c.req.param("id");
		const station = await db.prepare(`
			SELECT s.*, p.name_th as province_th, p.name_en as province_en, p.region,
				b.name_th as brand_name_th, b.name_en as brand_name_en, b.logo as brand_logo, b.color as brand_color
			FROM stations s
			LEFT JOIN provinces p ON s.province_id = p.id
			LEFT JOIN brands b ON s.brand_id = b.id
			WHERE s.id = ?
		`).bind(id).first();

		if (!station) return c.json({ error: "Station not found" }, 404);

		const changes = await db.prepare(`
			SELECT fuel_code, old_status, new_status, reported_at, recorded_at, source
			FROM status_changes
			WHERE station_id = ?
			ORDER BY recorded_at DESC
			LIMIT 50
		`).bind(id).all();

		return c.json({ station, changes: changes.results });
	},
);

// ─── Province stations (from D1) ─────────────────────────────────

app.get(
	"/api/stations/province/:id",
	cache({ cacheName: "province-stations-v1", cacheControl: "public, max-age=300" }),
	async (c) => {
		const db = c.env.DB;
		if (!db) return c.json({ error: "Database not configured" }, 500);

		const id = Number(c.req.param("id"));
		const includeUnknown = c.req.query("unknown") !== "false";

		const province = await db.prepare("SELECT * FROM provinces WHERE id = ?").bind(id).first();
		if (!province) return c.json({ error: "Province not found" }, 404);

		let query = `
			SELECT s.id, s.name, s.brand_id, s.amphoe, s.lat, s.lon, s.last_diesel_status, s.last_report_at,
				b.name_en as brand_name, b.color as brand_color
			FROM stations s
			LEFT JOIN brands b ON s.brand_id = b.id
			WHERE s.province_id = ?
		`;
		if (!includeUnknown) {
			query += ` AND s.last_diesel_status != 'unknown'`;
		}
		query += ` ORDER BY CASE s.last_diesel_status
			WHEN 'available' THEN 0 WHEN 'limited' THEN 1 WHEN 'pending_delivery' THEN 2 WHEN 'out' THEN 3 ELSE 4 END, s.name`;

		const stations = await db.prepare(query).bind(id).all();

		const summary = {
			available: 0, limited: 0, out: 0, pending: 0, unknown: 0, total: stations.results.length,
		};
		for (const s of stations.results as any[]) {
			const st = s.last_diesel_status || "unknown";
			if (st === "available") summary.available++;
			else if (st === "limited") summary.limited++;
			else if (st === "out") summary.out++;
			else if (st === "pending_delivery") summary.pending++;
			else summary.unknown++;
		}

		return c.json({ province, stations: stations.results, summary });
	},
);

// ─── History API ─────────────────────────────────────────────────

app.get("/api/history/station/:id", cache({ cacheName: "history-station-v1", cacheControl: "public, max-age=300" }), async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const id = c.req.param("id");
	const limit = safeLimit(c.req.query("limit"), 100, 500);

	const station = await db.prepare("SELECT * FROM stations WHERE id = ?").bind(id).first();
	if (!station) return c.json({ error: "Station not found" }, 404);

	const changes = await db.prepare(
		"SELECT fuel_code, old_status, new_status, reported_at, recorded_at, source FROM status_changes WHERE station_id = ? ORDER BY recorded_at DESC LIMIT ?",
	).bind(id, limit).all();

	return c.json({ station, changes: changes.results, count: changes.results.length });
});

app.get("/api/history/province/:id", cache({ cacheName: "history-province-v1", cacheControl: "public, max-age=300" }), async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const id = Number(c.req.param("id"));
	const limit = safeLimit(c.req.query("limit"), 96, 500);

	const province = await db.prepare("SELECT * FROM provinces WHERE id = ?").bind(id).first();
	if (!province) return c.json({ error: "Province not found" }, 404);

	const stats = await db.prepare(
		"SELECT * FROM regional_stats WHERE province_id = ? ORDER BY recorded_at DESC LIMIT ?",
	).bind(id, limit).all();

	return c.json({ province, stats: stats.results, count: stats.results.length });
});

app.get("/api/history/summary", cache({ cacheName: "history-summary-v1", cacheControl: "public, max-age=300" }), async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const limit = safeLimit(c.req.query("limit"), 96, 500);

	const stats = await db.prepare(`
		SELECT recorded_at,
			SUM(total_stations) as total_stations,
			SUM(diesel_available) as diesel_available,
			SUM(diesel_limited) as diesel_limited,
			SUM(diesel_out) as diesel_out,
			SUM(diesel_pending) as diesel_pending,
			SUM(diesel_unknown) as diesel_unknown
		FROM regional_stats
		GROUP BY recorded_at
		ORDER BY recorded_at DESC
		LIMIT ?
	`).bind(limit).all();

	return c.json({ stats: stats.results, count: stats.results.length });
});

app.get("/api/history/provinces", cache({ cacheName: "history-provinces-v1", cacheControl: "public, max-age=300" }), async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const latest = await db.prepare(`
		SELECT r.province_id, p.name_th, p.name_en, p.region,
			r.total_stations, r.diesel_available, r.diesel_limited, r.diesel_out, r.diesel_pending, r.diesel_unknown, r.recorded_at
		FROM regional_stats r
		JOIN provinces p ON r.province_id = p.id
		WHERE r.recorded_at = (SELECT MAX(recorded_at) FROM regional_stats)
		ORDER BY r.diesel_available DESC
	`).all();

	return c.json({ provinces: latest.results, count: latest.results.length });
});

app.get("/api/provinces", cache({ cacheName: "provinces-ref-v1", cacheControl: "public, max-age=86400" }), async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const provinces = await db.prepare("SELECT * FROM provinces ORDER BY id").all();
	return c.json({ provinces: provinces.results, count: provinces.results.length });
});

app.get("/api/brands", cache({ cacheName: "brands-ref-v1", cacheControl: "public, max-age=86400" }), async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);
	const brands = await db.prepare("SELECT * FROM brands ORDER BY id").all();
	return c.json({ brands: brands.results, count: brands.results.length });
});

// ─── Health ──────────────────────────────────────────────────────

app.get("/api/health", async (c) => {
	const dbStatus = c.env.DB ? "ok" : "not configured";
	const r2Status = c.env.R2 ? "ok" : "not configured";
	return c.json({
		status: "ok",
		version: "3.0.0",
		service: "thai-fuel",
		db: dbStatus,
		r2: r2Status,
		doebCache: doebCache ? { stations: doebCache.stations.length, age: Math.round((Date.now() - doebCache.fetchedAt) / 1000) + "s" } : null,
	});
});

// ─── Cron Trigger: DOEB Snapshot + D1 Diff ───────────────────────

async function handleCron(env: Bindings) {
	const now = new Date();
	const isoNow = now.toISOString();
	let logId: number | null = null;

	try {
		// Create log entry
		if (env.DB) {
			const logResult = await env.DB.prepare(
				"INSERT INTO cron_log (started_at, status) VALUES (?, 'running')",
			).bind(isoNow).run();
			logId = logResult.meta.last_row_id as number;
		}

		// 1. Fetch DOEB data
		const res = await fetch("https://fuel-now.doeb.go.th/pump.php?type=admin", {
			headers: { "User-Agent": "FUEL-TH/3.0 (fuel.lanta.dev)" },
		});
		if (!res.ok) {
			const errMsg = `DOEB fetch failed: HTTP ${res.status}`;
			if (env.DB && logId) {
				await env.DB.prepare("UPDATE cron_log SET finished_at = ?, status = 'error', error = ? WHERE id = ?")
					.bind(new Date().toISOString(), errMsg, logId).run();
			}
			return;
		}
		const data: any = await res.json();
		const stations: any[] = data.stations || [];

		// 2. Store snapshot to R2
		const dateKey = now.toISOString().slice(0, 10);
		const timeKey = now.toISOString().slice(11, 16).replace(":", "-");
		const r2Key = `doeb/${dateKey}/${timeKey}.json`;

		if (env.R2) {
			const body = JSON.stringify({ cached_at: data.cached_at, count: stations.length, stations });
			await env.R2.put(r2Key, body, {
				httpMetadata: { contentType: "application/json" },
				customMetadata: { stationCount: String(stations.length), cachedAt: data.cached_at || isoNow },
			});
		}

		if (!env.DB) return;

		// 3. Load province lookup (name_th -> id)
		const provRows = await env.DB.prepare("SELECT id, name_th FROM provinces").all<{ id: number; name_th: string }>();
		const provMap = new Map<string, number>();
		for (const row of provRows.results) {
			provMap.set(row.name_th, row.id);
		}

		// 4. Load previous diesel statuses (one bulk query instead of 24k individual SELECTs)
		const prevRows = await env.DB.prepare("SELECT id, last_diesel_status FROM stations").all<{ id: string; last_diesel_status: string }>();
		const prevMap = new Map<string, string>();
		for (const row of prevRows.results) {
			prevMap.set(row.id, row.last_diesel_status);
		}

		// 5. Process all stations -- diff in JS, ONLY write changes to D1
		const provinceStats: Record<number, { total: number; available: number; limited: number; out: number; pending: number; unknown: number }> = {};
		let changesCount = 0;
		let newStations = 0;
		const newStationStmts: D1PreparedStatement[] = [];
		const updateStmts: D1PreparedStatement[] = [];
		const changeStmts: D1PreparedStatement[] = [];
		const becameAvailable: { id: string; name: string; lat: number; lon: number; geohash5: string }[] = [];

		for (const s of stations) {
			const sLat = Number.parseFloat(s.lat || "0");
			const sLon = Number.parseFloat(s.lon || "0");
			if (!sLat || !sLon) continue;

			const id = stationHash(sLat, sLon, s.name || "");
			const dieselStatus = s.D || "unknown";
			const provinceName = s.province || "";
			const provinceId = provMap.get(provinceName) || null;
			const brandId = s.brand || "OTHER";
			const reportAt = s.lastReport || null;

			// Regional stats (by province_id)
			if (provinceId) {
				if (!provinceStats[provinceId]) {
					provinceStats[provinceId] = { total: 0, available: 0, limited: 0, out: 0, pending: 0, unknown: 0 };
				}
				const ps = provinceStats[provinceId];
				ps.total++;
				if (dieselStatus === "available") ps.available++;
				else if (dieselStatus === "limited") ps.limited++;
				else if (dieselStatus === "out") ps.out++;
				else if (dieselStatus === "pending_delivery") ps.pending++;
				else ps.unknown++;
			}

			const prevStatus = prevMap.get(id);

			const gh5 = geohash(sLat, sLon, 5);

			if (prevStatus === undefined) {
				// New station -- INSERT OR IGNORE (dupes in DOEB data)
				newStations++;
				newStationStmts.push(
					env.DB.prepare(
						"INSERT OR IGNORE INTO stations (id, name, brand_id, province_id, amphoe, lat, lon, geohash5, first_seen, last_seen, last_diesel_status, last_report_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
					).bind(id, s.name || "", brandId, provinceId, s.amphoe || "", sLat, sLon, gh5, isoNow, isoNow, dieselStatus, reportAt),
				);
			} else if (prevStatus !== dieselStatus && dieselStatus !== "unknown") {
				// Status changed -- UPDATE station + INSERT change (with dedup)
				updateStmts.push(
					env.DB.prepare(
						"UPDATE stations SET last_seen = ?, last_diesel_status = ?, last_report_at = ? WHERE id = ?",
					).bind(isoNow, dieselStatus, reportAt, id),
				);
				changeStmts.push(
					env.DB.prepare(
						`INSERT INTO status_changes (station_id, fuel_code, old_status, new_status, reported_at, recorded_at, source)
						SELECT ?, ?, ?, ?, ?, ?, ?
						WHERE NOT EXISTS (
							SELECT 1 FROM status_changes
							WHERE station_id = ? AND new_status = ? AND recorded_at > datetime(?, '-30 minutes')
						)`,
					).bind(id, "D", prevStatus, dieselStatus, reportAt, isoNow, "doeb", id, dieselStatus, isoNow),
				);
				changesCount++;
				if (dieselStatus === "available" || dieselStatus === "limited") {
					becameAvailable.push({ id, name: s.name || "", lat: sLat, lon: sLon, geohash5: gh5 });
				}
			}
			// If status is same -- skip entirely (no write needed)
		}

		// 6. Batch write ONLY the diffs to D1
		const allStmts = [...newStationStmts, ...updateStmts, ...changeStmts];
		const batchSize = 100;
		for (let i = 0; i < allStmts.length; i += batchSize) {
			await env.DB.batch(allStmts.slice(i, i + batchSize));
		}

		// 7. Write regional stats (by province_id)
		const regionStmts: D1PreparedStatement[] = [];
		for (const [pid, ps] of Object.entries(provinceStats)) {
			regionStmts.push(
				env.DB.prepare(
					"INSERT INTO regional_stats (province_id, recorded_at, total_stations, diesel_available, diesel_limited, diesel_out, diesel_pending, diesel_unknown) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
				).bind(Number(pid), isoNow, ps.total, ps.available, ps.limited, ps.out, ps.pending, ps.unknown),
			);
		}
		for (let i = 0; i < regionStmts.length; i += batchSize) {
			await env.DB.batch(regionStmts.slice(i, i + batchSize));
		}

		// 8. Send push notifications for STATION-specific subscribers
		if (changesCount > 0 && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
			try {
				// Get all station IDs that changed
				const changedIds = [...new Set([
					...updateStmts.map((_, i) => {
						// Extract station IDs from the change tracking above
						return null; // Can't easily extract from prepared statements
					}),
				])].filter(Boolean);

				// Better approach: query recent changes from D1
				const recentChanges = await env.DB.prepare(
					"SELECT DISTINCT station_id, new_status FROM status_changes WHERE recorded_at = ? AND new_status IN ('available', 'limited')",
				).bind(isoNow).all();

				for (const change of recentChanges.results as any[]) {
					const subs = await env.DB.prepare(
						`SELECT id, endpoint, keys_p256dh, keys_auth, lang FROM station_subscriptions
						WHERE station_id = ?
						AND (last_notified_at IS NULL OR last_notified_at < datetime(?, '-60 minutes'))
						LIMIT 50`,
					).bind(change.station_id, isoNow).all();

					const stationInfo = await env.DB.prepare("SELECT name FROM stations WHERE id = ?").bind(change.station_id).first<{ name: string }>();

					for (const sub of subs.results as any[]) {
						try {
							await sendWebPush(
								{ endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
								JSON.stringify({
									title: sub.lang === "th" ? "มีดีเซลแล้ว!" : "Diesel Available!",
									body: `${stationInfo?.name || "Station"} -- ${change.new_status === "available" ? (sub.lang === "th" ? "มีดีเซล" : "has diesel") : (sub.lang === "th" ? "ดีเซลจำกัด" : "diesel limited")}`,
									url: `/station/${change.station_id}`,
									tag: `station-${change.station_id}`,
									renotify: true,
								}),
								env.VAPID_PUBLIC_KEY,
								env.VAPID_PRIVATE_KEY,
								env.VAPID_SUBJECT || "mailto:fuel@lanta.dev",
							);
							await env.DB.prepare("UPDATE station_subscriptions SET last_notified_at = ? WHERE id = ?")
								.bind(isoNow, sub.id).run();
						} catch {
							await env.DB.prepare("DELETE FROM station_subscriptions WHERE id = ?").bind(sub.id).run();
						}
					}
				}
			} catch { /* station push errors shouldn't break cron */ }
		}

		// 9. Send push notifications for stations that became available
		if (becameAvailable.length > 0 && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
			try {
				// Collect all geohash cells that need notification
				const notifyGeohashes = new Set<string>();
				for (const station of becameAvailable) {
					for (const gh of geohashNeighbors(station.geohash5)) {
						notifyGeohashes.add(gh);
					}
				}

				// Find subscribers in those cells (not notified in last hour)
				const ghPlaceholders = [...notifyGeohashes].map(() => "?").join(",");
				const subscribers = await env.DB.prepare(
					`SELECT id, endpoint, keys_p256dh, keys_auth, lat, lon, lang
					FROM push_subscriptions
					WHERE geohash5 IN (${ghPlaceholders})
					AND (last_notified_at IS NULL OR last_notified_at < datetime(?, '-60 minutes'))
					LIMIT 100`,
				).bind(...[...notifyGeohashes], isoNow).all();

				let notified = 0;
				for (const sub of subscribers.results as any[]) {
					const nearbyStations = becameAvailable.filter((s) =>
						haversineKm(sub.lat, sub.lon, s.lat, s.lon) <= 30,
					);
					if (nearbyStations.length === 0) continue;

					const title = sub.lang === "th" ? "มีดีเซลใกล้คุณ!" : "Diesel available near you!";
					const body = sub.lang === "th"
						? `${nearbyStations.length} สถานีมีดีเซล -- เช็คเลย`
						: `${nearbyStations.length} station${nearbyStations.length > 1 ? "s" : ""} with diesel -- check now`;
					const url = `https://www.fuelthai.com/availability?lat=${sub.lat}&lng=${sub.lon}&radius=30`;

					try {
						await sendWebPush(
							{ endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
							JSON.stringify({ title, body, url, tag: "diesel-alert", renotify: true }),
							env.VAPID_PUBLIC_KEY,
							env.VAPID_PRIVATE_KEY,
							env.VAPID_SUBJECT || "mailto:fuel@lanta.dev",
						);
						notified++;
						await env.DB.prepare("UPDATE push_subscriptions SET last_notified_at = ? WHERE id = ?")
							.bind(isoNow, sub.id).run();
					} catch {
						// Subscription may be expired -- remove it
						await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(sub.id).run();
					}
				}
			} catch { /* push errors shouldn't break the cron */ }
		}

		// 5. Update log entry
		if (logId) {
			await env.DB.prepare(
				"UPDATE cron_log SET finished_at = ?, status = 'ok', stations_fetched = ?, new_stations = ?, status_changes = ?, provinces = ?, r2_key = ? WHERE id = ?",
			).bind(new Date().toISOString(), stations.length, newStations, changesCount, Object.keys(provinceStats).length, r2Key, logId).run();
		}
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : "Unknown error";
		if (env.DB && logId) {
			await env.DB.prepare("UPDATE cron_log SET finished_at = ?, status = 'error', error = ? WHERE id = ?")
				.bind(new Date().toISOString(), errMsg, logId).run();
		}
	}
}

// ─── Push Notifications ──────────────────────────────────────────

app.get("/api/push/vapid", (c) => {
	return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY || null });
});

app.post("/api/push/subscribe", async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const body: any = await c.req.json();
	const { subscription, lat, lon, radius, lang: userLang } = body;

	if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
		return c.json({ error: "Invalid subscription" }, 400);
	}
	if (!lat || !lon) return c.json({ error: "Location required" }, 400);

	const gh5 = geohash(Number(lat), Number(lon), 5);
	const r = Math.min(Math.max(Number(radius) || 20, 5), 50);

	await db.prepare(
		`INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth, lat, lon, geohash5, radius, lang, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(endpoint) DO UPDATE SET lat=excluded.lat, lon=excluded.lon, geohash5=excluded.geohash5, radius=excluded.radius`,
	).bind(
		subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth,
		Number(lat), Number(lon), gh5, r, userLang || "th", new Date().toISOString(),
	).run();

	return c.json({ ok: true, geohash: gh5 });
});

app.post("/api/push/unsubscribe", async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const body: any = await c.req.json();
	if (!body?.endpoint) return c.json({ error: "Endpoint required" }, 400);

	await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(body.endpoint).run();
	return c.json({ ok: true });
});

// ─── Station-specific push subscriptions ─────────────────────────

app.post("/api/push/subscribe-station", async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const body: any = await c.req.json();
	const { subscription, stationId, lang: userLang } = body;

	if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
		return c.json({ error: "Invalid subscription" }, 400);
	}
	if (!stationId) return c.json({ error: "Station ID required" }, 400);

	const station = await db.prepare("SELECT id, name FROM stations WHERE id = ?").bind(stationId).first();
	if (!station) return c.json({ error: "Station not found" }, 404);

	await db.prepare(
		`INSERT INTO station_subscriptions (endpoint, keys_p256dh, keys_auth, station_id, lang, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(endpoint, station_id) DO UPDATE SET keys_p256dh=excluded.keys_p256dh, keys_auth=excluded.keys_auth`,
	).bind(
		subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth,
		stationId, userLang || "th", new Date().toISOString(),
	).run();

	return c.json({ ok: true, station: station.name });
});

app.post("/api/push/unsubscribe-station", async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const body: any = await c.req.json();
	if (!body?.endpoint || !body?.stationId) return c.json({ error: "Endpoint and stationId required" }, 400);

	await db.prepare("DELETE FROM station_subscriptions WHERE endpoint = ? AND station_id = ?")
		.bind(body.endpoint, body.stationId).run();
	return c.json({ ok: true });
});

app.get("/api/push/station-status", async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ subscribed: false });

	const endpoint = c.req.query("endpoint");
	const stationId = c.req.query("station");
	if (!endpoint || !stationId) return c.json({ subscribed: false });

	const sub = await db.prepare("SELECT id FROM station_subscriptions WHERE endpoint = ? AND station_id = ?")
		.bind(endpoint, stationId).first();
	return c.json({ subscribed: !!sub });
});

// ─── Admin endpoints (protected by CRON_SECRET) ─────────────────

function requireAuth(c: any): boolean {
	const secret = c.env.CRON_SECRET;
	if (!secret) return false;
	const provided = c.req.header("X-Cron-Key") || c.req.query("key");
	return provided === secret;
}

app.get("/api/cron/trigger", async (c) => {
	if (!requireAuth(c)) return c.json({ error: "Unauthorized" }, 401);
	await handleCron(c.env);
	return c.json({ triggered: true, check: "/api/cron/log" });
});

app.get("/api/cron/log", async (c) => {
	if (!requireAuth(c)) return c.json({ error: "Unauthorized" }, 401);
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const limit = safeLimit(c.req.query("limit"), 20, 100);
	const logs = await db.prepare(
		"SELECT id, started_at, finished_at, status, stations_fetched, new_stations, status_changes, provinces, r2_key FROM cron_log ORDER BY id DESC LIMIT ?",
	).bind(limit).all();

	return c.json({ logs: logs.results, count: logs.results.length });
});

app.get("/api/cron/stats", async (c) => {
	if (!requireAuth(c)) return c.json({ error: "Unauthorized" }, 401);
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const stationCount = await db.prepare("SELECT COUNT(*) as count FROM stations").first<{ count: number }>();
	const changeCount = await db.prepare("SELECT COUNT(*) as count FROM status_changes").first<{ count: number }>();
	const regionCount = await db.prepare("SELECT COUNT(*) as count FROM regional_stats").first<{ count: number }>();
	const lastCron = await db.prepare("SELECT id, started_at, finished_at, status, stations_fetched, new_stations, status_changes, provinces FROM cron_log ORDER BY id DESC LIMIT 1").first();

	return c.json({
		db: {
			stations: stationCount?.count || 0,
			statusChanges: changeCount?.count || 0,
			regionalStats: regionCount?.count || 0,
			pushSubscribers: ((await db.prepare("SELECT COUNT(*) as count FROM push_subscriptions").first<{ count: number }>())?.count || 0),
		},
		lastCron,
	});
});

// Test push notification (admin only)
app.get("/api/cron/test-push", async (c) => {
	if (!requireAuth(c)) return c.json({ error: "Unauthorized" }, 401);
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);
	if (!c.env.VAPID_PUBLIC_KEY || !c.env.VAPID_PRIVATE_KEY) return c.json({ error: "VAPID keys not configured" }, 500);

	const subId = c.req.query("id");
	let sub: any;

	if (subId) {
		sub = await db.prepare("SELECT * FROM push_subscriptions WHERE id = ?").bind(Number(subId)).first();
	} else {
		sub = await db.prepare("SELECT * FROM push_subscriptions ORDER BY id DESC LIMIT 1").first();
	}

	if (!sub) return c.json({ error: "No subscribers found. Subscribe first at /availability" }, 404);

	try {
		await sendWebPush(
			{ endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
			JSON.stringify({
				title: "FUEL::TH Test",
				body: "Push notifications are working! Diesel alerts are active.",
				url: "/availability",
				tag: "test",
			}),
			c.env.VAPID_PUBLIC_KEY,
			c.env.VAPID_PRIVATE_KEY,
			c.env.VAPID_SUBJECT || "mailto:fuel@lanta.dev",
		);
		return c.json({ ok: true, sent_to: sub.id, endpoint: sub.endpoint.slice(0, 50) + "..." });
	} catch (err) {
		return c.json({ error: "Push failed", detail: err instanceof Error ? err.message : "Unknown" }, 500);
	}
});

// Backfill geohash for existing stations (one-time admin endpoint)
app.get("/api/cron/backfill-geohash", async (c) => {
	if (!requireAuth(c)) return c.json({ error: "Unauthorized" }, 401);
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const rows = await db.prepare("SELECT id, lat, lon FROM stations WHERE geohash5 IS NULL LIMIT 5000").all();
	const stmts: D1PreparedStatement[] = [];
	for (const row of rows.results as any[]) {
		const gh = geohash(row.lat, row.lon, 5);
		stmts.push(db.prepare("UPDATE stations SET geohash5 = ? WHERE id = ?").bind(gh, row.id));
	}
	for (let i = 0; i < stmts.length; i += 100) {
		await db.batch(stmts.slice(i, i + 100));
	}
	return c.json({ updated: stmts.length, remaining: (rows.results.length >= 5000 ? "more" : 0) });
});

// ─── SPA Fallback (must be LAST route) ───────────────────────────

app.all("*", async (c) => {
	return c.env.ASSETS.fetch(c.req.raw);
});

export default {
	fetch: app.fetch,
	async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
		ctx.waitUntil(handleCron(env));
	},
};
