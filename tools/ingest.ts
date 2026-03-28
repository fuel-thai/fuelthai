#!/usr/bin/env bun
/**
 * FUEL::TH Data Ingest -- standalone bun script for NAS/local cron
 *
 * Fetches data from APIs that don't work well from CF Workers
 * (geo-restricted, slow, need scraping) and pushes to /api/ingest.
 *
 * Usage:
 *   bun tools/ingest.ts                    # run all collectors
 *   bun tools/ingest.ts --dry-run          # show what would be sent
 *   bun tools/ingest.ts --collector=eppo   # run one collector
 *
 * Env vars:
 *   FUELTHAI_URL      Target API (default: https://www.fuelthai.com)
 *   FUELTHAI_KEY      X-Cron-Key for /api/ingest auth
 *   FRED_API_KEY      FRED API key (optional, for fertilizer/plastics indices)
 */

const FUELTHAI_URL = process.env.FUELTHAI_URL || "https://www.fuelthai.com";
const FUELTHAI_KEY = process.env.FUELTHAI_KEY || "";
const FRED_API_KEY = process.env.FRED_API_KEY || "";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const collectorFilter = args.find((a) => a.startsWith("--collector="))?.split("=")[1];

interface Metric {
	date: string;
	source: string;
	metric: string;
	value: number;
	unit?: string;
}

function today(): string {
	return new Date().toISOString().slice(0, 10);
}

async function safeFetch(url: string, opts?: RequestInit): Promise<Response | null> {
	try {
		const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(15000) });
		return res.ok ? res : null;
	} catch {
		return null;
	}
}

// ─── Collectors ──────────────────────────────────────────────────

async function collectEppoRetailPrices(): Promise<Metric[]> {
	console.log("  [eppo] Fetching EPPO retail fuel price history...");
	const url = "https://catalog.eppo.go.th/dataset/33ee54ae-0967-46a5-945d-40cdb12cda4f/resource/079c3c22-d46d-4c05-965f-17d44b922e53/download/dataset_11_58.csv";
	const res = await safeFetch(url, {
		headers: { "User-Agent": "Mozilla/5.0 (compatible; FUEL-TH/2.0)" },
	});
	if (!res) { console.log("  [eppo] Failed to fetch"); return []; }

	const text = await res.text();
	const lines = text.trim().split("\n");
	// CSV: Year, Month, Products, Price (MIN/WT.AVG/MAX), Value, Unit
	const metrics: Metric[] = [];
	const months: Record<string, string> = {
		january: "01", february: "02", march: "03", april: "04",
		may: "05", june: "06", july: "07", august: "08",
		september: "09", october: "10", november: "11", december: "12",
	};

	for (let i = 1; i < lines.length; i++) {
		const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
		if (cols.length < 6) continue;

		const year = Number(cols[0]);
		const monthStr = cols[1].toLowerCase().trim();
		const product = cols[2].toLowerCase().replace(/\s+/g, "_");
		const priceType = cols[3].trim();
		const value = Number(cols[4]);

		// Only weighted average
		if (!priceType.includes("WT.AVG") && !priceType.includes("AVG")) continue;
		if (!year || !value || Number.isNaN(value)) continue;

		const mm = months[monthStr];
		if (!mm) continue;

		const ceYear = year > 2500 ? year - 543 : year;
		const date = `${ceYear}-${mm}-01`;

		// Only capture the last 3 years
		if (ceYear < new Date().getFullYear() - 3) continue;

		// Capture all fuel types, not just diesel
		metrics.push({ date, source: "eppo", metric: `eppo_${product}`, value, unit: "THB/L" });
	}

	console.log(`  [eppo] Parsed ${metrics.length} diesel price records`);
	return metrics;
}

async function collectFredIndices(): Promise<Metric[]> {
	if (!FRED_API_KEY) { console.log("  [fred] No FRED_API_KEY, skipping"); return []; }
	console.log("  [fred] Fetching FRED economic indices...");

	const series = [
		{ id: "PCU3253132531", metric: "fertilizer_ppi", unit: "index" },
		{ id: "WPU066", metric: "plastic_resins_ppi", unit: "index" },
		{ id: "DCOILBRENTEU", metric: "brent_crude_fred", unit: "USD/bbl" },
	];

	const metrics: Metric[] = [];

	for (const s of series) {
		const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=12`;
		const res = await safeFetch(url);
		if (!res) { console.log(`  [fred] Failed to fetch ${s.id}`); continue; }

		const data = await res.json() as any;
		for (const obs of data?.observations || []) {
			if (obs.value === "." || !obs.value) continue;
			metrics.push({
				date: obs.date,
				source: "fred",
				metric: s.metric,
				value: Number(obs.value),
				unit: s.unit,
			});
		}
	}

	console.log(`  [fred] Collected ${metrics.length} observations`);
	return metrics;
}

async function collectWfpFoodPrices(): Promise<Metric[]> {
	console.log("  [wfp] Fetching WFP Thailand food prices...");

	const csvUrl = "https://data.humdata.org/dataset/c957cef8-ef98-4e71-b88a-7842cf1dba72/resource/ac698f6d-bfee-40ad-a442-2781c4033c27/download/wfp_food_prices_tha.csv";
	const csvRes = await safeFetch(csvUrl, {
		headers: { "User-Agent": "Mozilla/5.0 (compatible; FUEL-TH/2.0)" },
	});
	if (!csvRes) { console.log("  [wfp] Failed to fetch CSV"); return []; }

	const text = await csvRes.text();
	const lines = text.trim().split("\n");
	const header = lines[0].split(",");

	// WFP CSV columns: date, admin1, admin2, market, latitude, longitude, category, commodity, unit, priceflag, pricetype, currency, price, usdprice
	const dateIdx = header.indexOf("date");
	const commodityIdx = header.indexOf("commodity");
	const priceIdx = header.indexOf("price");
	const currencyIdx = header.indexOf("currency");

	if (dateIdx < 0 || commodityIdx < 0 || priceIdx < 0) {
		console.log("  [wfp] Unexpected CSV format");
		return [];
	}

	const metrics: Metric[] = [];
	const seen = new Set<string>();
	const cutoff = new Date();
	cutoff.setFullYear(cutoff.getFullYear() - 3);

	// Key commodities to track
	const targetCommodities = ["rice", "oil", "sugar", "eggs", "chicken", "pork", "fish"];

	for (let i = lines.length - 1; i >= 1; i--) {
		const cols = lines[i].split(",");
		if (cols.length <= priceIdx) continue;

		const date = cols[dateIdx];
		const commodity = cols[commodityIdx].toLowerCase();
		const price = Number(cols[priceIdx]);
		const currency = cols[currencyIdx] || "THB";

		if (!date || Number.isNaN(price) || price <= 0) continue;
		if (new Date(date) < cutoff) continue;

		const matched = targetCommodities.find((t) => commodity.includes(t));
		if (!matched) continue;

		const key = `${date}-${matched}`;
		if (seen.has(key)) continue;
		seen.add(key);

		metrics.push({
			date,
			source: "wfp",
			metric: `food_${matched}`,
			value: price,
			unit: `${currency}/kg`,
		});
	}

	console.log(`  [wfp] Collected ${metrics.length} food price records`);
	return metrics;
}

async function collectEfinancePrices(): Promise<Metric[]> {
	console.log("  [efinance] Fetching efinancethai fuel prices...");
	const res = await safeFetch("https://www.efinancethai.com/val.aspx?key=01");
	if (!res) { console.log("  [efinance] Failed to fetch"); return []; }

	const buffer = await res.arrayBuffer();
	// efinancethai uses TIS-620 encoding -- try to decode
	let text: string;
	try {
		const decoder = new TextDecoder("tis-620");
		text = decoder.decode(buffer);
	} catch {
		text = new TextDecoder("utf-8").decode(buffer);
	}

	const data = JSON.parse(text) as any;
	const metrics: Metric[] = [];
	const d = today();

	for (const row of data?.Table || []) {
		const code = String(row.product_code || "").trim();
		const price = Number(row.set_price);
		if (!code || Number.isNaN(price) || price <= 0) continue;

		// Map product codes to readable names
		const name = code.toLowerCase().replace(/\s+/g, "_");
		metrics.push({
			date: d,
			source: "efinancethai",
			metric: `efinance_${name}`,
			value: price,
			unit: "THB/L",
		});
	}

	console.log(`  [efinance] Collected ${metrics.length} fuel prices`);
	return metrics;
}

async function collectBotExchangeRate(): Promise<Metric[]> {
	const key = process.env.BOT_EXCHANGE_KEY;
	if (!key) { console.log("  [bot] No BOT_EXCHANGE_KEY, skipping"); return []; }
	console.log("  [bot] Fetching BOT exchange rates...");

	const d = today();
	const start = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
	const url = `https://gateway.api.bot.or.th/Stat-ExchangeRate/v2/DAILY_AVG_EXG_RATE/?start_period=${start}&end_period=${d}&currency=USD`;
	const res = await safeFetch(url, { headers: { Authorization: key } });
	if (!res) { console.log("  [bot] Failed to fetch"); return []; }

	const data = await res.json() as any;
	const details = data?.result?.data?.data_detail || [];
	const metrics: Metric[] = [];

	for (const row of details) {
		if (!row.period || !row.mid_rate) continue;
		metrics.push({
			date: row.period,
			source: "bot",
			metric: "thb_usd_bot",
			value: Number(row.mid_rate),
			unit: "THB/USD",
		});
	}

	console.log(`  [bot] Collected ${metrics.length} exchange rate records`);
	return metrics;
}

async function collectOilFundLevy(): Promise<Metric[]> {
	console.log("  [oilfund] Fetching EPPO Oil Fund levy data...");
	const url = "https://catalog.eppo.go.th/dataset/52571ec1-9f80-489a-9b4d-e8a16e199a2c/resource/c43dfeb0-d0eb-489c-86c7-153c40df72c0/download/dataset_11_56.csv";
	const res = await safeFetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; FUEL-TH/2.0)" } });
	if (!res) { console.log("  [oilfund] Failed to fetch"); return []; }

	const text = await res.text();
	const lines = text.trim().split("\n");
	const months: Record<string, string> = {
		january: "01", february: "02", march: "03", april: "04",
		may: "05", june: "06", july: "07", august: "08",
		september: "09", october: "10", november: "11", december: "12",
	};
	const metrics: Metric[] = [];

	for (let i = 1; i < lines.length; i++) {
		const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
		if (cols.length < 5) continue;
		const year = Number(cols[0]);
		const mm = months[cols[1].toLowerCase().trim()];
		const product = cols[2].toLowerCase().replace(/\s+/g, "_");
		const value = Number(cols[3]);
		if (!year || !mm || Number.isNaN(value)) continue;
		const ceYear = year > 2500 ? year - 543 : year;
		if (ceYear < new Date().getFullYear() - 3) continue;

		// Diesel B7 and LSD are the key products
		if (product.includes("hsd") || product.includes("lsd") || product.includes("diesel")) {
			metrics.push({ date: `${ceYear}-${mm}-01`, source: "eppo_oilfund", metric: `oilfund_${product}`, value, unit: "THB/L" });
		}
	}

	console.log(`  [oilfund] Parsed ${metrics.length} levy records`);
	return metrics;
}

async function collectIntlComparison(): Promise<Metric[]> {
	console.log("  [intl] Fetching EPPO international price comparison...");
	const url = "https://catalog.eppo.go.th/dataset/b15f2fe3-14f0-4de5-b90e-2a5b63b4e717/resource/7d56918d-adbf-42b7-bd36-e4b33d425027/download/dataset_11_86.csv";
	const res = await safeFetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; FUEL-TH/2.0)" } });
	if (!res) { console.log("  [intl] Failed to fetch"); return []; }

	const text = await res.text();
	const lines = text.trim().split("\n");
	const months: Record<string, string> = {
		january: "01", february: "02", march: "03", april: "04",
		may: "05", june: "06", july: "07", august: "08",
		september: "09", october: "10", november: "11", december: "12",
	};
	const metrics: Metric[] = [];

	// Focus on ASEAN + key comparators for diesel
	const targetCountries = ["TH-THAILAND", "MY-MALAYSIA", "SG-SINGAPORE", "ID-INDONESIA", "VN-VIETNAM",
		"PH-PHILIPPINES", "KH-KINGDOM OF CAMBODIA", "MM-MYANMAR", "JP-JAPAN", "US-UNITED STATES"];

	for (let i = 1; i < lines.length; i++) {
		// Handle quoted fields with commas inside
		const cols: string[] = [];
		let inQuote = false;
		let field = "";
		for (const ch of lines[i]) {
			if (ch === '"') { inQuote = !inQuote; continue; }
			if (ch === "," && !inQuote) { cols.push(field.trim()); field = ""; continue; }
			field += ch;
		}
		cols.push(field.trim());

		if (cols.length < 6) continue;
		const year = Number(cols[0]);
		const mm = months[cols[1].toLowerCase().trim()];
		const item = cols[3];
		const country = cols[4];
		const price = Number(cols[5]);

		if (!year || !mm || Number.isNaN(price) || price <= 0) continue;
		if (!item.includes("HSD")) continue; // Diesel only
		const ceYear = year > 2500 ? year - 543 : year;
		if (ceYear < new Date().getFullYear() - 2) continue;

		const matched = targetCountries.find((t) => country.startsWith(t.split("-")[0]));
		if (!matched) continue;
		const countryCode = matched.split("-")[0].toLowerCase();

		metrics.push({
			date: `${ceYear}-${mm}-01`,
			source: "eppo_intl",
			metric: `diesel_intl_${countryCode}`,
			value: price,
			unit: "THB/L",
		});
	}

	console.log(`  [intl] Parsed ${metrics.length} international comparison records`);
	return metrics;
}

async function collectSetStocks(): Promise<Metric[]> {
	console.log("  [set] Fetching SET energy stocks...");
	const symbols = [
		{ ticker: "PTT.BK", metric: "stock_ptt", label: "PTT" },
		{ ticker: "BCP.BK", metric: "stock_bcp", label: "Bangchak" },
		{ ticker: "TOP.BK", metric: "stock_top", label: "Thai Oil" },
		{ ticker: "PTTEP.BK", metric: "stock_pttep", label: "PTTEP" },
	];

	const metrics: Metric[] = [];

	for (const sym of symbols) {
		const res = await safeFetch(
			`https://query1.finance.yahoo.com/v8/finance/chart/${sym.ticker}?range=1mo&interval=1d`,
			{ headers: { "User-Agent": "Mozilla/5.0 (compatible; FUEL-TH/2.0)" } },
		);
		if (!res) { console.log(`  [set] Failed to fetch ${sym.ticker}`); continue; }

		const data = await res.json() as any;
		const result = data?.chart?.result?.[0];
		if (!result) continue;

		const timestamps = result.timestamp || [];
		const closes = result.indicators?.quote?.[0]?.close || [];

		for (let i = 0; i < timestamps.length; i++) {
			if (closes[i] == null) continue;
			const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
			metrics.push({ date, source: "yahoo_finance", metric: sym.metric, value: closes[i], unit: "THB" });
		}
	}

	console.log(`  [set] Collected ${metrics.length} stock price records`);
	return metrics;
}

async function collectNatGas(): Promise<Metric[]> {
	console.log("  [natgas] Fetching Henry Hub natural gas...");
	const res = await safeFetch(
		"https://query1.finance.yahoo.com/v8/finance/chart/NG=F?range=1mo&interval=1d",
		{ headers: { "User-Agent": "Mozilla/5.0 (compatible; FUEL-TH/2.0)" } },
	);
	if (!res) { console.log("  [natgas] Failed to fetch"); return []; }

	const data = await res.json() as any;
	const result = data?.chart?.result?.[0];
	if (!result) return [];

	const timestamps = result.timestamp || [];
	const closes = result.indicators?.quote?.[0]?.close || [];
	const metrics: Metric[] = [];

	for (let i = 0; i < timestamps.length; i++) {
		if (closes[i] == null) continue;
		const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
		metrics.push({ date, source: "yahoo_finance", metric: "natgas_henry_hub", value: closes[i], unit: "USD/MMBtu" });
	}

	console.log(`  [natgas] Collected ${metrics.length} natural gas prices`);
	return metrics;
}

// ─── Main ────────────────────────────────────────────────────────

const collectors: Record<string, () => Promise<Metric[]>> = {
	bot: collectBotExchangeRate,
	eppo: collectEppoRetailPrices,
	oilfund: collectOilFundLevy,
	intl: collectIntlComparison,
	set: collectSetStocks,
	natgas: collectNatGas,
	fred: collectFredIndices,
	efinance: collectEfinancePrices,
};

async function main() {
	console.log(`FUEL::TH Ingest ${dryRun ? "(DRY RUN)" : ""}`);
	console.log(`Target: ${FUELTHAI_URL}/api/ingest`);
	console.log(`Auth: ${FUELTHAI_KEY ? "configured" : "MISSING -- set FUELTHAI_KEY"}`);
	console.log("");

	if (!FUELTHAI_KEY && !dryRun) {
		console.error("ERROR: FUELTHAI_KEY is required. Set it in env or .env");
		process.exit(1);
	}

	const allMetrics: Metric[] = [];
	const toRun = collectorFilter ? [collectorFilter] : Object.keys(collectors);

	for (const name of toRun) {
		const fn = collectors[name];
		if (!fn) { console.error(`Unknown collector: ${name}`); continue; }
		try {
			const metrics = await fn();
			allMetrics.push(...metrics);
		} catch (err) {
			console.error(`  [${name}] ERROR: ${err}`);
		}
	}

	console.log(`\nTotal: ${allMetrics.length} metrics collected`);

	if (dryRun) {
		for (const m of allMetrics.slice(0, 20)) {
			console.log(`  ${m.date} ${m.source}/${m.metric}: ${m.value} ${m.unit || ""}`);
		}
		if (allMetrics.length > 20) console.log(`  ... and ${allMetrics.length - 20} more`);
		return;
	}

	if (allMetrics.length === 0) {
		console.log("Nothing to ingest.");
		return;
	}

	// Push in batches of 100
	let ingested = 0;
	for (let i = 0; i < allMetrics.length; i += 100) {
		const batch = allMetrics.slice(i, i + 100);
		const res = await fetch(`${FUELTHAI_URL}/api/ingest`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Cron-Key": FUELTHAI_KEY,
			},
			body: JSON.stringify({ metrics: batch }),
		});

		if (res.ok) {
			const data = await res.json() as any;
			ingested += data.ingested || 0;
			console.log(`  Batch ${Math.floor(i / 100) + 1}: ${data.ingested} ingested`);
		} else {
			console.error(`  Batch ${Math.floor(i / 100) + 1}: FAILED (${res.status} ${await res.text()})`);
		}
	}

	console.log(`\nDone! ${ingested}/${allMetrics.length} metrics ingested.`);
}

main().catch((err) => {
	console.error("Fatal:", err);
	process.exit(1);
});
