import { useEffect, useState } from "react";
import { useLanguage } from "../lib/language-store";
import { t } from "../lib/translations";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { AreaChart, BarChart } from "../components/svg-chart";
import { SkeletonChart } from "../components/skeleton";

interface CrudeData {
	latest: { date: string; price: number } | null;
	high: number;
	low: number;
	change: number | null;
	changePercent: number | null;
	observations: { date: string; price: number }[];
	source: string;
}

interface ExchangeData {
	rate: number;
	date: string;
	source: string;
}

interface BrandData {
	date: string | null;
	brands: { id: string; name: string; diesel: number | null; fuels: Record<string, number> }[];
	count: number;
	source: string;
}

export default function StatsPage() {
	const { lang } = useLanguage();
	const [crude, setCrude] = useState<CrudeData | null>(null);
	const [exchange, setExchange] = useState<ExchangeData | null>(null);
	const [brands, setBrands] = useState<BrandData | null>(null);

	useEffect(() => {
		// Fire independently -- render each as it arrives
		fetch("/api/crude?days=90").then((r) => r.ok ? r.json() : null).then(setCrude).catch(() => {});
		fetch("/api/exchange").then((r) => r.ok ? r.json() : null).then(setExchange).catch(() => {});
		fetch("/api/brand-prices").then((r) => r.ok ? r.json() : null).then(setBrands).catch(() => {});
	}, []);

	const crudeChartData = crude?.observations.map((o) => ({ label: o.date, value: o.price })) || [];
	const brandsWithDiesel = brands?.brands.filter((b) => b.diesel != null) || [];
	const brandsNoDiesel = brands?.brands.filter((b) => b.diesel == null) || [];
	const brandBars = brandsWithDiesel.map((b, i) => ({ label: (b.name || b.id).slice(0, 8), value: b.diesel as number, highlight: i === 0 }));

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader page="STATS" pageTh="สถิติ" subtitle={t("statsSubtitle", lang)} />

			<main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
				{/* Brent Crude Chart */}
				{!crude ? <SkeletonChart /> : (
					<div className="rounded-xl border border-border bg-card p-5">
						<div className="flex items-start justify-between mb-4">
							<div>
								<h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-wider">
									{t("brentCrudeChart", lang)}
								</h2>
								<p className="text-xs text-muted-foreground">{t("brentCrudeSub", lang)}</p>
							</div>
							{crude.latest && (
								<div className="text-right">
									<div className="font-mono text-2xl font-black text-foreground">
										${crude.latest.price.toFixed(2)}
									</div>
									{crude.changePercent != null && (
										<span className={`font-mono text-xs font-bold ${crude.changePercent >= 0 ? "text-red-400" : "text-emerald-400"}`}>
											{crude.changePercent >= 0 ? "+" : ""}{crude.changePercent}%
										</span>
									)}
								</div>
							)}
						</div>
						<AreaChart
							data={crudeChartData}
							height={220}
							color={crude.changePercent && crude.changePercent >= 0 ? "#f87171" : "#34d399"}
							fillColor={crude.changePercent && crude.changePercent >= 0 ? "rgba(248,113,113,0.08)" : "rgba(52,211,153,0.08)"}
							yLabel="$/bbl"
						/>
						<div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground font-mono">
							<span>{t("high", lang)}: ${crude.high.toFixed(2)}</span>
							<span>{t("low", lang)}: ${crude.low.toFixed(2)}</span>
							{crude.latest && <span>{lang === "th" ? "ล่าสุด" : "Latest"}: {crude.latest.date}</span>}
						</div>
						<div className="mt-2 text-[10px] text-muted-foreground">{t("source", lang)}: {crude.source}</div>
					</div>
				)}

				{/* Exchange Rate */}
				{!exchange ? <SkeletonChart /> : (
					<div className="rounded-xl border border-border bg-card p-5">
						<div className="flex items-start justify-between">
							<div>
								<h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-wider">
									{t("exchangeChart", lang)}
								</h2>
								<p className="text-xs text-muted-foreground">{t("exchangeChartSub", lang)}</p>
							</div>
							<div className="text-right">
								<div className="font-mono text-3xl font-black text-foreground">
									{exchange.rate?.toFixed(2)}
								</div>
								<span className="font-mono text-xs text-muted-foreground">THB/USD</span>
							</div>
						</div>
						<div className="mt-2 text-[10px] text-muted-foreground">{t("source", lang)}: {exchange.source}</div>
					</div>
				)}

				{/* Diesel by Brand */}
				{!brands ? <SkeletonChart /> : brandBars.length > 0 && (
					<div className="rounded-xl border border-border bg-card p-5">
						<div className="mb-4">
							<h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-wider">
								{t("dieselByBrand", lang)}
							</h2>
							<p className="text-xs text-muted-foreground">{t("dieselByBrandSub", lang)}</p>
						</div>
						<BarChart data={brandBars} height={200} formatValue={(v) => v.toFixed(2)} />

						{/* Detailed table */}
						<div className="mt-4 rounded-lg border border-border overflow-hidden">
							<table className="w-full text-xs">
								<thead>
									<tr className="bg-muted/50">
										<th className="text-left px-3 py-2 font-mono font-bold text-muted-foreground">{lang === "th" ? "แบรนด์" : "Brand"}</th>
										<th className="text-right px-3 py-2 font-mono font-bold text-muted-foreground">{lang === "th" ? "ดีเซล B7" : "Diesel B7"}</th>
										<th className="text-right px-3 py-2 font-mono font-bold text-muted-foreground hidden sm:table-cell">{lang === "th" ? "แก๊สโซฮอล์ 95" : "G95"}</th>
										<th className="text-right px-3 py-2 font-mono font-bold text-muted-foreground hidden sm:table-cell">{lang === "th" ? "แก๊สโซฮอล์ 91" : "G91"}</th>
									</tr>
								</thead>
								<tbody>
									{brands.brands.filter((b) => b.diesel != null).map((brand, i) => (
										<tr key={brand.id} className={i === 0 ? "bg-emerald-500/5" : i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
											<td className="px-3 py-2 font-mono font-bold text-foreground">
												<span className="inline-flex items-center gap-2">
													<img src={`/brands/${brand.id.toLowerCase()}.svg`} alt="" className="h-5 w-5" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
													{brand.name || brand.id}
												</span>
												{i === 0 && <span className="ml-2 text-[10px] text-emerald-400">{t("cheapest", lang)}</span>}
											</td>
											<td className="px-3 py-2 text-right font-mono text-foreground">
												{brand.diesel?.toFixed(2)}
											</td>
											<td className="px-3 py-2 text-right font-mono text-muted-foreground hidden sm:table-cell">
												{brand.fuels.gasohol_95 ? brand.fuels.gasohol_95.toFixed(2) : "--"}
											</td>
											<td className="px-3 py-2 text-right font-mono text-muted-foreground hidden sm:table-cell">
												{brand.fuels.gasohol_91 ? brand.fuels.gasohol_91.toFixed(2) : "--"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
						{/* Brands with no diesel */}
						{brandsNoDiesel.length > 0 && (
							<div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
								<span className="font-mono text-xs font-bold text-red-400 uppercase tracking-wider">
									{lang === "th" ? "ไม่มีราคาดีเซล" : "NO DIESEL PRICE LISTED"}
								</span>
								<div className="mt-2 flex flex-wrap gap-2">
									{brandsNoDiesel.map((b) => (
										<span key={b.id} className="inline-flex items-center gap-1.5 rounded bg-red-500/10 px-2 py-1 text-xs font-mono text-red-300">
											<img src={`/brands/${b.id.toLowerCase()}.svg`} alt="" className="h-4 w-4 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
											{b.id}
										</span>
									))}
								</div>
							</div>
						)}
						<div className="mt-2 text-[10px] text-muted-foreground">{t("source", lang)}: {brands.source}</div>
					</div>
				)}

			</main>

			<SiteFooter />
		</div>
	);
}
