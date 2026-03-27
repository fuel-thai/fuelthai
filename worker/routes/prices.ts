import { Hono } from "hono";
import { cache } from "hono/cache";
import type { Bindings } from "../shared";

const app = new Hono<{ Bindings: Bindings }>();

function parseBangchakDate(dateStr: string): string {
	const [d, m, y] = dateStr.split("/");
	return `${y}-${m}-${d}`;
}

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

app.get(
	"/api/crude",
	cache({ cacheName: "crude-prices-v2", cacheControl: "public, max-age=1800, stale-while-revalidate=3600" }),
	async (c) => {
		try {
			// Fetch both in parallel, prefer Yahoo (intraday) over EIA (daily)
			const [yahoo, eia] = await Promise.all([fetchYahooCrude(), fetchEiaCrude()]);
			const result = yahoo || eia;
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

export default app;
