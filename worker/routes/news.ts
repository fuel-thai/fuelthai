import { Hono } from "hono";
import { cache } from "hono/cache";
import { XMLParser } from "fast-xml-parser";
import type { Bindings } from "../shared";
import { safeLimit } from "../shared";

const app = new Hono<{ Bindings: Bindings }>();

interface NewsArticle {
	title: string;
	link: string;
	date: string;
	description: string;
	source: string;
	category: string;
}

const rssParser = new XMLParser({
	ignoreAttributes: false,
	processEntities: true,
	trimValues: true,
});

function parseRssItems(xml: string, source: string, category: string): NewsArticle[] {
	try {
		const feed = rssParser.parse(xml);
		const items = feed?.rss?.channel?.item || feed?.feed?.entry || [];
		const list = Array.isArray(items) ? items : [items];
		return list
			.filter((item: any) => item.title && item.link)
			.map((item: any) => ({
				title: String(item.title).trim(),
				link: String(typeof item.link === "object" ? item.link["@_href"] || item.link["#text"] : item.link).trim(),
				date: item.pubDate ? new Date(item.pubDate).toISOString() : item.published || item.updated || "",
				description: String(item.description || item.summary || item.content || "").replace(/<[^>]*>/g, "").trim().slice(0, 200),
				source,
				category,
			}));
	} catch {
		return [];
	}
}

async function fetchRss(url: string): Promise<string> {
	try {
		const res = await fetch(url, { headers: { "User-Agent": "FUEL-TH/2.0 (fuel crisis tracker)" } });
		return res.ok ? await res.text() : "";
	} catch {
		return "";
	}
}

const ENERGY_RSS_SOURCES = [
	{ url: "https://oilprice.com/rss/main", source: "OilPrice.com", category: "energy" },
	{ url: "https://oilprice.com/rss/breaking_news", source: "OilPrice.com", category: "energy" },
	{ url: "https://gcaptain.com/feed/", source: "gCaptain", category: "shipping" },
	{ url: "https://www.naturalgasintel.com/feed/", source: "Natural Gas Intel", category: "energy" },
	{ url: "https://www.bangkokpost.com/rss/data/business.xml", source: "Bangkok Post", category: "thailand" },
	{ url: "https://www.bangkokpost.com/rss/data/most-recent.xml", source: "Bangkok Post", category: "thailand" },
];

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

			const articles = results.flatMap((xml) => parseRssItems(xml, "Bangkok Post", "thailand"));
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

export default app;
