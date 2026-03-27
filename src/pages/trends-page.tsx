import { useEffect, useState } from "react";
import { useLanguage } from "../lib/language-store";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { AreaChart } from "../components/svg-chart";
import { SkeletonChart } from "../components/skeleton";

interface PriceRecord {
	date: string;
	source: string;
	metric: string;
	value: number;
	unit: string | null;
}

interface ChartSection {
	title: string;
	titleTh: string;
	subtitle: string;
	subtitleTh: string;
	metrics: string[];
	unit: string;
	color: string;
	fillColor: string;
}

const SECTIONS: ChartSection[] = [
	{
		title: "BRENT CRUDE OIL",
		titleTh: "น้ำมันดิบเบรนท์",
		subtitle: "Daily closing price from Yahoo Finance + FRED",
		subtitleTh: "ราคาปิดรายวัน จาก Yahoo Finance + FRED",
		metrics: ["brent_crude_usd", "brent_crude_fred"],
		unit: "USD/bbl",
		color: "#f87171",
		fillColor: "rgba(248,113,113,0.08)",
	},
	{
		title: "THB/USD EXCHANGE RATE",
		titleTh: "อัตราแลกเปลี่ยน บาท/ดอลลาร์",
		subtitle: "Daily rate from Frankfurter (ECB)",
		subtitleTh: "อัตรารายวัน จาก Frankfurter (ECB)",
		metrics: ["thb_usd"],
		unit: "THB/USD",
		color: "#60a5fa",
		fillColor: "rgba(96,165,250,0.08)",
	},
	{
		title: "DIESEL B7 RETAIL PRICE",
		titleTh: "ราคาขายปลีกดีเซล B7",
		subtitle: "Monthly weighted average from EPPO",
		subtitleTh: "ค่าเฉลี่ยถ่วงน้ำหนักรายเดือน จาก สนพ.",
		metrics: ["eppo_hsd_b7"],
		unit: "THB/L",
		color: "#34d399",
		fillColor: "rgba(52,211,153,0.08)",
	},
	{
		title: "GASOHOL 95 RETAIL PRICE",
		titleTh: "ราคาขายปลีกแก๊สโซฮอล์ 95",
		subtitle: "Monthly weighted average from EPPO",
		subtitleTh: "ค่าเฉลี่ยถ่วงน้ำหนักรายเดือน จาก สนพ.",
		metrics: ["eppo_e10"],
		unit: "THB/L",
		color: "#a78bfa",
		fillColor: "rgba(167,139,250,0.08)",
	},
	{
		title: "FERTILIZER COST INDEX",
		titleTh: "ดัชนีต้นทุนปุ๋ย",
		subtitle: "Global supply indicator -- US fertilizer manufacturing PPI (FRED)",
		subtitleTh: "ตัวชี้วัดอุปทานโลก -- PPI การผลิตปุ๋ยสหรัฐ (FRED)",
		metrics: ["fertilizer_ppi"],
		unit: "Index",
		color: "#fbbf24",
		fillColor: "rgba(251,191,36,0.08)",
	},
	{
		title: "PLASTIC RESINS COST INDEX",
		titleTh: "ดัชนีต้นทุนเม็ดพลาสติก",
		subtitle: "Global supply indicator -- US plastic resins PPI (FRED). Thailand imports pellets from Iran.",
		subtitleTh: "ตัวชี้วัดอุปทานโลก -- PPI เม็ดพลาสติกสหรัฐ (FRED) ไทยนำเข้าเม็ดพลาสติกจากอิหร่าน",
		metrics: ["plastic_resins_ppi"],
		unit: "Index",
		color: "#fb923c",
		fillColor: "rgba(251,146,60,0.08)",
	},
];

const BRAND_COLORS: Record<string, { color: string; label: string }> = {
	diesel_ptt: { color: "#eab308", label: "PTT" },
	diesel_bcp: { color: "#22c55e", label: "Bangchak" },
	diesel_shell: { color: "#ef4444", label: "Shell" },
	diesel_caltex: { color: "#dc2626", label: "Caltex" },
	diesel_pt: { color: "#3b82f6", label: "PT" },
	diesel_pure: { color: "#8b5cf6", label: "Pure" },
	diesel_susco_dealers: { color: "#f97316", label: "SUSCO" },
};

function TrendChart({ data, section, lang }: { data: PriceRecord[]; section: ChartSection; lang: "en" | "th" }) {
	const filtered = data
		.filter((d) => section.metrics.includes(d.metric))
		.sort((a, b) => a.date.localeCompare(b.date));

	if (filtered.length < 2) {
		return (
			<div className="rounded-xl border border-border bg-card p-5">
				<h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-wider">
					{lang === "th" ? section.titleTh : section.title}
				</h2>
				<p className="mt-2 text-xs text-muted-foreground">
					{lang === "th" ? "ยังไม่มีข้อมูลเพียงพอ -- ข้อมูลจะสะสมทุกวัน" : "Not enough data yet -- data accumulates daily from cron capture"}
				</p>
			</div>
		);
	}

	const latest = filtered[filtered.length - 1];
	const first = filtered[0];
	const change = latest.value - first.value;
	const changePct = ((change / first.value) * 100).toFixed(1);

	const chartData = filtered.map((d) => ({
		label: d.date,
		value: d.value,
	}));

	return (
		<div className="rounded-xl border border-border bg-card p-5">
			<div className="flex items-start justify-between mb-4">
				<div>
					<h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-wider">
						{lang === "th" ? section.titleTh : section.title}
					</h2>
					<p className="text-xs text-muted-foreground">
						{lang === "th" ? section.subtitleTh : section.subtitle}
					</p>
				</div>
				<div className="text-right">
					<div className="font-mono text-2xl font-black text-foreground">
						{latest.value.toFixed(latest.value >= 100 ? 0 : 2)}
					</div>
					<span className={`font-mono text-xs font-bold ${change >= 0 ? "text-red-400" : "text-emerald-400"}`}>
						{change >= 0 ? "+" : ""}{changePct}%
					</span>
					<span className="ml-1 text-[10px] text-muted-foreground">{section.unit}</span>
				</div>
			</div>
			<AreaChart
				data={chartData}
				height={200}
				color={section.color}
				fillColor={section.fillColor}
				yLabel={section.unit}
			/>
			<div className="mt-2 flex gap-4 text-[10px] text-muted-foreground font-mono">
				<span>{filtered.length} data points</span>
				<span>{first.date} to {latest.date}</span>
			</div>
		</div>
	);
}

function BrandDieselChart({ data, lang }: { data: PriceRecord[]; lang: "en" | "th" }) {
	const brandMetrics = Object.keys(BRAND_COLORS);
	const brandData = data.filter((d) => brandMetrics.includes(d.metric));

	if (brandData.length < 2) {
		return (
			<div className="rounded-xl border border-border bg-card p-5">
				<h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-wider">
					{lang === "th" ? "ดีเซลรายแบรนด์" : "DIESEL BY BRAND"}
				</h2>
				<p className="mt-2 text-xs text-muted-foreground">
					{lang === "th" ? "ยังไม่มีข้อมูลเพียงพอ -- ข้อมูลจะสะสมทุกวัน" : "Not enough data yet -- daily prices accumulate from cron"}
				</p>
			</div>
		);
	}

	// Get latest price per brand for the bar display
	const latestByBrand: Record<string, PriceRecord> = {};
	for (const d of brandData) {
		if (!latestByBrand[d.metric] || d.date > latestByBrand[d.metric].date) {
			latestByBrand[d.metric] = d;
		}
	}

	const sorted = Object.entries(latestByBrand)
		.sort(([, a], [, b]) => a.value - b.value);

	return (
		<div className="rounded-xl border border-border bg-card p-5">
			<div className="mb-4">
				<h2 className="font-mono text-sm font-bold text-foreground uppercase tracking-wider">
					{lang === "th" ? "ดีเซล B7 รายแบรนด์" : "DIESEL B7 BY BRAND"}
				</h2>
				<p className="text-xs text-muted-foreground">
					{lang === "th" ? "ราคาล่าสุดจาก thai-oil-api" : "Latest daily snapshot from thai-oil-api"}
				</p>
			</div>

			<div className="space-y-2">
				{sorted.map(([metric, record], i) => {
					const brand = BRAND_COLORS[metric] || { color: "#6b7280", label: metric };
					const maxPrice = Math.max(...sorted.map(([, r]) => r.value));
					const pct = (record.value / maxPrice) * 100;

					return (
						<div key={metric} className="flex items-center gap-3">
							<span className="w-16 shrink-0 text-right font-mono text-xs font-bold text-foreground">
								{brand.label}
							</span>
							<div className="flex-1 h-6 rounded bg-muted/30 overflow-hidden relative">
								<div
									className="h-full rounded transition-all"
									style={{ width: `${pct}%`, backgroundColor: brand.color, opacity: 0.6 }}
								/>
								<span className="absolute inset-y-0 right-2 flex items-center font-mono text-xs font-bold text-foreground">
									{record.value.toFixed(2)}
								</span>
							</div>
							{i === 0 && (
								<span className="text-[10px] text-emerald-400 font-mono font-bold">
									{lang === "th" ? "ถูกสุด" : "LOWEST"}
								</span>
							)}
						</div>
					);
				})}
			</div>

			<div className="mt-3 text-[10px] text-muted-foreground font-mono">
				{lang === "th" ? "หน่วย: บาท/ลิตร" : "Unit: THB/L"} | {sorted[0]?.[1]?.date || ""}
			</div>
		</div>
	);
}

function MetricsSummary({ data, lang }: { data: PriceRecord[]; lang: "en" | "th" }) {
	// Get unique metrics and their latest values
	const latest: Record<string, PriceRecord> = {};
	for (const d of data) {
		if (!latest[d.metric] || d.date > latest[d.metric].date) {
			latest[d.metric] = d;
		}
	}

	const uniqueMetrics = Object.keys(latest).length;
	const totalRecords = data.length;
	const sources = [...new Set(data.map((d) => d.source))];
	const dateRange = data.length > 0
		? `${data.reduce((a, b) => a.date < b.date ? a : b).date} to ${data.reduce((a, b) => a.date > b.date ? a : b).date}`
		: "";

	return (
		<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
			<div className="rounded-lg border border-border bg-card p-3 text-center">
				<div className="font-mono text-2xl font-black text-foreground">{uniqueMetrics}</div>
				<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
					{lang === "th" ? "ตัวชี้วัด" : "Metrics"}
				</div>
			</div>
			<div className="rounded-lg border border-border bg-card p-3 text-center">
				<div className="font-mono text-2xl font-black text-foreground">{totalRecords.toLocaleString()}</div>
				<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
					{lang === "th" ? "จุดข้อมูล" : "Data Points"}
				</div>
			</div>
			<div className="rounded-lg border border-border bg-card p-3 text-center">
				<div className="font-mono text-2xl font-black text-foreground">{sources.length}</div>
				<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
					{lang === "th" ? "แหล่งข้อมูล" : "Sources"}
				</div>
			</div>
			<div className="rounded-lg border border-border bg-card p-3 text-center">
				<div className="font-mono text-lg font-bold text-foreground truncate">{dateRange.split(" to ")[0] || "--"}</div>
				<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
					{lang === "th" ? "ตั้งแต่" : "Since"}
				</div>
			</div>
		</div>
	);
}

export default function TrendsPage() {
	const { lang } = useLanguage();
	const [data, setData] = useState<PriceRecord[] | null>(null);

	useEffect(() => {
		fetch("/api/history/prices?days=365")
			.then((r) => r.ok ? r.json() : null)
			.then((d) => setData(d?.data || []))
			.catch(() => setData([]));
	}, []);

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader
				page="TRENDS"
				pageTh="แนวโน้ม"
				subtitle={lang === "th" ? "ข้อมูลราคาย้อนหลัง" : "Historical price data & economic indicators"}
			/>

			<main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
				{!data ? (
					<div className="space-y-6">
						<SkeletonChart />
						<SkeletonChart />
						<SkeletonChart />
					</div>
				) : (
					<>
						<MetricsSummary data={data} lang={lang} />

						{SECTIONS.map((section) => (
							<TrendChart key={section.title} data={data} section={section} lang={lang} />
						))}

						<BrandDieselChart data={data} lang={lang} />
					</>
				)}
			</main>

			<SiteFooter
				text="Historical data from EPPO, FRED, Yahoo Finance, Frankfurter, thai-oil-api"
				textTh="ข้อมูลย้อนหลังจาก สนพ., FRED, Yahoo Finance, Frankfurter, thai-oil-api"
			/>
		</div>
	);
}
