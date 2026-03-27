import { useEffect, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { useLanguage } from "../lib/language-store";
import { t } from "../lib/translations";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { Sparkline } from "../components/svg-chart";
import { StatusFeed } from "../components/status-feed";
import { Skeleton, SkeletonHero, SkeletonPriceCard, SkeletonChart, SkeletonBrandGrid } from "../components/skeleton";
import { InfoModal, BrentInfoContent } from "../components/info-modal";

interface FuelPrice {
	name: string;
	today: number;
	yesterday: number;
	tomorrow: number;
	change: number;
	price?: number; // Thai endpoint uses `price` instead of `today`
}

interface PriceData {
	date: string;
	priceSetAt: string;
	effectiveFrom: string;
	remark: string;
	prices: FuelPrice[];
	source: string;
}

interface BrandInfo {
	id: string;
	name: string;
	diesel: number | null;
}

interface CrudeInfo {
	latest: { date: string; price: number } | null;
	high: number;
	low: number;
	changePercent: number | null;
	observations: { date: string; price: number }[];
}

interface ExchangeInfo {
	rate: number;
	date: string;
}

interface NewsArticle {
	title: string;
	link: string;
	date: string;
	description: string;
	source?: string;
	category?: string;
}

function PriceChange({ value }: { value: number }) {
	if (value === 0) return <span className="text-sm text-muted-foreground">--</span>;
	if (value > 0)
		return <span className="price-up text-sm font-bold">+{value.toFixed(2)}</span>;
	return <span className="price-down text-sm font-bold">{value.toFixed(2)}</span>;
}

function FuelCard({ fuel, lang }: { fuel: FuelPrice; lang: "en" | "th" }) {
	const isDiesel = fuel.name.toLowerCase().includes("diesel") || fuel.name.includes("ดีเซล");
	const price = fuel.today || fuel.price || 0;
	const isUp = fuel.yesterday ? price > fuel.yesterday : false;
	const isDown = fuel.yesterday ? price < fuel.yesterday : false;

	return (
		<div
			className={`rounded-lg border p-4 transition-all hover:scale-[1.02] ${
				isDiesel
					? "border-accent/50 bg-accent/5"
					: "border-border bg-card"
			}`}
		>
			<div className="flex items-start justify-between">
				<div>
					<h3 className={`font-mono text-sm ${isDiesel ? "text-accent font-bold" : "text-muted-foreground"}`}>
						{fuel.name}
					</h3>
					<div className="mt-2 flex items-baseline gap-2">
						<span className="font-mono text-3xl font-bold tracking-tight">
							{price.toFixed(2)}
						</span>
						<span className="text-sm text-muted-foreground">{t("thbPerLiter", lang)}</span>
					</div>
				</div>
				<div className="text-right">
					{isUp && <span className="text-xs text-destructive">UP</span>}
					{isDown && <span className="text-xs text-primary">DOWN</span>}
					{fuel.yesterday && (
						<div className="mt-1">
							<PriceChange value={price - fuel.yesterday} />
						</div>
					)}
				</div>
			</div>

			{fuel.change !== 0 && fuel.change != null && (
				<div className="mt-3 rounded border border-dashed border-accent/30 bg-accent/5 px-3 py-2">
					<span className="text-xs text-muted-foreground">{t("tomorrow", lang)}: </span>
					<span className="font-mono text-sm font-bold text-accent">
						{fuel.tomorrow?.toFixed(2)}
					</span>
					<span className="ml-2">
						<PriceChange value={fuel.change} />
					</span>
				</div>
			)}
		</div>
	);
}

export default function HomePage() {
	const { lang } = useLanguage();
	const [data, setData] = useState<PriceData | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [lastFetch, setLastFetch] = useState<Date | null>(null);
	const [brands, setBrands] = useState<BrandInfo[]>([]);
	const [crude, setCrude] = useState<CrudeInfo | null>(null);
	const [exchange, setExchange] = useState<ExchangeInfo | null>(null);
	const [news, setNews] = useState<NewsArticle[]>([]);
	const [showBrentInfo, setShowBrentInfo] = useState(false);

	useEffect(() => {
		Promise.all([
			fetch("/api/brand-prices").then((r) => r.ok ? r.json() : null).catch(() => null),
			fetch("/api/crude?days=30").then((r) => r.ok ? r.json() : null).catch(() => null),
			fetch("/api/exchange").then((r) => r.ok ? r.json() : null).catch(() => null),
			fetch("/api/news/energy?limit=10").then((r) => r.ok ? r.json() : null).catch(() => null),
		]).then(([brandsData, crudeData, exchangeData, newsData]) => {
			if (brandsData?.brands) setBrands(brandsData.brands.filter((b: BrandInfo) => b.diesel != null));
			if (crudeData) setCrude(crudeData);
			if (exchangeData) setExchange(exchangeData);
			if (newsData?.articles) setNews(newsData.articles);
		});
	}, []);

	async function fetchPrices() {
		try {
			setLoading(true);
			const endpoint = lang === "th" ? "/api/prices/th" : "/api/prices";
			const res = await fetch(endpoint);
			if (!res.ok) throw new Error(`API error: ${res.status}`);
			const json = await res.json();
			setData(json);
			setError(null);
			setLastFetch(new Date());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to fetch");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		fetchPrices();
		const interval = setInterval(fetchPrices, 5 * 60 * 1000);
		return () => clearInterval(interval);
	}, [lang]);

	const diesel = data?.prices.find((p) => p.name === "Hi Diesel S" || p.name === "ไฮดีเซล เอส")
		|| data?.prices.find((p) => p.name.includes("Diesel S") && !p.name.includes("Premium"))
		|| data?.prices.find((p) => p.name.includes("ดีเซล") && !p.name.includes("พรีเมียม"));
	const dieselPrice = diesel ? (diesel.today || diesel.price || 0) : 0;

	return (
		<div className="min-h-screen bg-background">
			{/* HERO CTA -- the killer feature */}
			<Link
				to="/availability"
				className="block border-b-2 border-accent/40 bg-accent/10 px-4 py-4 transition-colors hover:bg-accent/20"
			>
				<div className="mx-auto flex max-w-4xl items-center justify-between">
					<div>
						<span className="font-mono text-lg font-black text-accent">{t("heroTitle", lang)}</span>
						<p className="text-sm text-muted-foreground">{t("heroSubtitle", lang)}</p>
					</div>
					<span className="rounded-lg bg-accent px-4 py-2 font-mono text-sm font-bold text-accent-foreground">{t("checkNow", lang)} &rarr;</span>
				</div>
			</Link>

			<SiteHeader subtitle={t("livePrices", lang)} />

			<main className="mx-auto max-w-4xl px-4 py-6">
				{diesel && (
					<div className="mb-8 rounded-xl border-2 border-accent/40 bg-accent/5 p-6">
						<div className="flex items-center gap-3">
							<div className="rounded-lg bg-accent/20 px-3 py-1">
								<span className="font-mono text-sm font-bold text-accent">{t("dieselB7", lang)}</span>
							</div>
							<span className="text-xs text-muted-foreground">
								{t("primaryFuel", lang)}
							</span>
						</div>
						<div className="mt-4 flex items-baseline gap-3">
							<span className="font-mono text-6xl font-black tracking-tighter text-foreground">
								{dieselPrice.toFixed(2)}
							</span>
							<span className="text-xl text-muted-foreground">{t("thbPerLiter", lang)}</span>
						</div>
						<div className="mt-2 flex flex-wrap gap-6 text-sm">
							{diesel.yesterday && (
								<div>
									<span className="text-muted-foreground">{t("yesterday", lang)}: </span>
									<span className="font-mono">{diesel.yesterday.toFixed(2)}</span>
								</div>
							)}
							{diesel.change !== 0 && diesel.change != null && (
								<div>
									<span className="text-muted-foreground">{t("tomorrow", lang)}: </span>
									<span className="font-mono font-bold text-accent">
										{diesel.tomorrow?.toFixed(2)}
									</span>
								</div>
							)}
							<div>
								<span className="text-muted-foreground">{t("preWarCap", lang)}: </span>
								<span className="font-mono">29.94</span>
								<span className="ml-2 text-xs text-destructive">
									+{((dieselPrice / 29.94 - 1) * 100).toFixed(1)}%
								</span>
							</div>
						</div>
					</div>
				)}

				{/* Inline CTA after diesel card */}
				{diesel && (
					<Link
						to="/availability"
						className="mb-6 flex items-center justify-between rounded-lg border border-dashed border-accent/30 bg-accent/5 px-4 py-3 transition-colors hover:bg-accent/10"
					>
						<div>
							<span className="font-mono text-sm font-bold text-accent">{t("butAvailable", lang)}</span>
							<p className="text-xs text-muted-foreground">{t("checkAvailability", lang)}</p>
						</div>
						<span className="font-mono text-xs text-accent">&rarr;</span>
					</Link>
				)}

				{loading && !data && (
					<div className="space-y-6">
						<SkeletonHero />
						<div className="grid gap-3 sm:grid-cols-2">
							<SkeletonPriceCard />
							<SkeletonPriceCard />
							<SkeletonPriceCard />
							<SkeletonPriceCard />
						</div>
					</div>
				)}

				{error && (
					<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
						{error}
					</div>
				)}

				{data && (
					<>
						<h2 className="mb-4 font-mono text-sm font-bold text-muted-foreground uppercase tracking-wider">
							{t("allFuelTypes", lang)}
						</h2>
						<div className="grid gap-3 sm:grid-cols-2">
							{data.prices.map((fuel) => (
								<FuelCard key={fuel.name} fuel={fuel} lang={lang} />
							))}
						</div>
					</>
				)}

				{/* Global Context: Crude + Exchange */}
				{!crude && !exchange && data && (
					<div className="mt-6 grid gap-3 sm:grid-cols-2">
						<SkeletonChart />
						<SkeletonChart />
					</div>
				)}
				{(crude || exchange) && (
					<div className="mt-6 grid gap-3 sm:grid-cols-2">
						{crude?.latest && (
							<Link to="/stats" className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
								<div className="flex items-center justify-between">
									<span className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("brentCrude", lang)}</span>
									<button type="button" onClick={(e) => { e.preventDefault(); setShowBrentInfo(true); }} className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full border border-muted-foreground/30 text-[9px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">i</button>
									{crude.changePercent != null && (
										<span className={`font-mono text-xs font-bold ${crude.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
											{crude.changePercent >= 0 ? "+" : ""}{crude.changePercent}%
										</span>
									)}
								</div>
								<div className="mt-2 flex items-baseline gap-2">
									<span className="font-mono text-2xl font-black text-foreground">${crude.latest.price.toFixed(2)}</span>
									<span className="text-xs text-muted-foreground">{t("perBarrel", lang)}</span>
								</div>
								{crude.observations.length > 2 && (
									<div className="mt-2">
										<Sparkline
											data={crude.observations.map((o) => ({ label: o.date, value: o.price }))}
											height={40}
											color={crude.changePercent && crude.changePercent >= 0 ? "#f87171" : "#34d399"}
											fillColor={crude.changePercent && crude.changePercent >= 0 ? "rgba(248,113,113,0.1)" : "rgba(52,211,153,0.1)"}
										/>
									</div>
								)}
								<div className="mt-1 text-[10px] text-muted-foreground">
									{t("high", lang)}: ${crude.high.toFixed(2)} / {t("low", lang)}: ${crude.low.toFixed(2)}
								</div>
							</Link>
						)}
						{exchange && (
							<div className="rounded-xl border border-border bg-card p-4">
								<span className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("exchangeRate", lang)}</span>
								<div className="mt-2 flex items-baseline gap-2">
									<span className="font-mono text-2xl font-black text-foreground">{exchange.rate?.toFixed(2)}</span>
									<span className="text-xs text-muted-foreground">THB/USD</span>
								</div>
								<p className="mt-2 text-[10px] text-muted-foreground">{t("source", lang)}: European Central Bank</p>
							</div>
						)}
					</div>
				)}

				{/* Brand Comparison */}
				{!brands.length && data && (
					<div className="mt-6 rounded-xl border border-border bg-card p-4">
						<Skeleton className="h-3 w-32 mb-3" />
						<SkeletonBrandGrid />
					</div>
				)}
				{brands.length > 0 && (
					<div className="mt-6 rounded-xl border border-border bg-card p-4">
						<div className="flex items-center justify-between mb-3">
							<div>
								<h2 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("brandComparison", lang)}</h2>
								<p className="text-[10px] text-muted-foreground">{t("brandComparisonSub", lang)}</p>
							</div>
							<Link to="/stats" className="font-mono text-xs text-primary hover:underline">{t("stats", lang)} &rarr;</Link>
						</div>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
							{brands.slice(0, 8).map((brand, i) => (
								<div key={brand.id} className={`rounded-lg border px-3 py-2 ${i === 0 ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"}`}>
									<span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold text-muted-foreground uppercase">
										<img src={`/brands/${brand.id.toLowerCase()}.svg`} alt="" className="h-4 w-4" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
										{brand.id}
									</span>
									<div className="font-mono text-lg font-black text-foreground">{brand.diesel?.toFixed(2)}</div>
									{i === 0 && <span className="text-[10px] text-emerald-400">{t("cheapest", lang)}</span>}
								</div>
							))}
						</div>
						<div className="mt-2 text-[10px] text-muted-foreground">{t("source", lang)}: thai-oil-api</div>
					</div>
				)}

				{/* Live Status Feed */}
				<div className="mt-6 rounded-xl border border-border bg-card p-4">
					<div className="flex items-center justify-between mb-3">
						<h2 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
							{lang === "th" ? "สถานะล่าสุด" : "LIVE STATUS CHANGES"}
						</h2>
						<Link to="/feed" className="font-mono text-xs text-primary hover:underline">
							{lang === "th" ? "ดูทั้งหมด" : "View all"} &rarr;
						</Link>
					</div>
					<StatusFeed lang={lang} limit={10} />
				</div>

				{/* Energy News */}
				{news.length > 0 && (
					<div className="mt-6 rounded-xl border border-border bg-card p-4">
						<div className="flex items-center justify-between mb-3">
							<h2 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">{t("crisisNews", lang)}</h2>
							<Link to="/news" className="font-mono text-xs text-primary hover:underline">
								{lang === "th" ? "ดูทั้งหมด" : "View all"} &rarr;
							</Link>
						</div>
						<div className="space-y-3">
							{news.slice(0, 5).map((article) => (
								<a
									key={article.link}
									href={article.link}
									target="_blank"
									rel="noreferrer"
									className="block rounded-lg border border-border px-3 py-2 transition-colors hover:bg-muted/50"
								>
									<h3 className="text-sm font-bold text-foreground leading-tight">{article.title}</h3>
									<p className="mt-1 text-xs text-muted-foreground line-clamp-2">{article.description}</p>
									<div className="mt-1 flex items-center gap-2">
										{article.source && (
											<span className="font-mono text-[10px] text-primary/70">{article.source}</span>
										)}
										<span className="text-[10px] text-muted-foreground">
											{article.date ? new Date(article.date).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
										</span>
									</div>
								</a>
							))}
						</div>
						<div className="mt-2 text-[10px] text-muted-foreground">{t("source", lang)}: OilPrice, gCaptain, Natural Gas Intel, Bangkok Post</div>
					</div>
				)}

				{/* Bangchak remark */}
				{data?.remark && (
					<div className="mt-6 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
						<span className="font-mono text-xs font-bold text-accent uppercase tracking-wider">Bangchak</span>
						<p className="mt-1 text-sm text-muted-foreground">{data.remark}</p>
					</div>
				)}

				<div className="mt-8 rounded-lg border border-border bg-card p-4">
					<h3 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
						{t("context", lang)}
					</h3>
					<div className="mt-3 space-y-2 text-sm text-muted-foreground">
						<p>{t("contextP1", lang)}</p>
						<p>{t("contextP2", lang)}</p>
					</div>
					<div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
						<span>{t("source", lang)}: {data?.source || "Bangchak API"}</span>
						<span>{t("updated", lang)}: {lastFetch?.toLocaleTimeString(lang === "th" ? "th-TH" : "en-GB") || "--"}</span>
						<span>fuel.lanta.dev</span>
					</div>
				</div>

				<div className="mt-6 rounded-lg border border-border bg-card p-4">
					<h3 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
						{t("api", lang)}
					</h3>
					<div className="mt-3 space-y-2 font-mono text-xs">
						<div className="rounded bg-muted px-3 py-2">
							<span className="text-primary">GET</span> /api/prices
						</div>
						<div className="rounded bg-muted px-3 py-2">
							<span className="text-primary">GET</span> /api/diesel
						</div>
						<div className="rounded bg-muted px-3 py-2">
							<span className="text-primary">GET</span> /api/prices/th
						</div>
						<div className="rounded bg-muted px-3 py-2">
							<span className="text-primary">GET</span> /api/stations?postal=81150
						</div>
					</div>
				</div>
			</main>

			<InfoModal open={showBrentInfo} onClose={() => setShowBrentInfo(false)} title={t("brentCrude", lang)}>
				<BrentInfoContent lang={lang} />
			</InfoModal>

			<SiteFooter text="Real-time Thailand fuel prices via Bangchak API. Built during the 2026 Iran war energy crisis." textTh="ราคาน้ำมันไทยแบบเรียลไทม์จาก Bangchak API สร้างในช่วงวิกฤตพลังงานจากสงครามอิหร่าน 2569" />
		</div>
	);
}
