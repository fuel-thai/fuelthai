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

interface ChartDef {
	title: string;
	titleTh: string;
	subtitle: string;
	subtitleTh: string;
	metrics: string[];
	unit: string;
	color: string;
	fillColor: string;
	invertChange?: boolean;
}

// ─── Story Sections ──────────────────────────────────────────────

interface StorySection {
	id: string;
	icon: string;
	title: string;
	titleTh: string;
	context: string;
	contextTh: string;
	charts: ChartDef[];
}

const STORY: StorySection[] = [
	{
		id: "energy",
		icon: "🛢",
		title: "ENERGY CRISIS",
		titleTh: "วิกฤตพลังงาน",
		context: "The Strait of Hormuz blockade has disrupted global oil supply. Brent crude surged past $100/bbl in March 2026. Thailand imports ~80% of its crude oil -- domestic fuel prices track international markets with a lag from the Oil Fund subsidy buffer.",
		contextTh: "การปิดล้อมช่องแคบฮอร์มุซทำให้อุปทานน้ำมันโลกหยุดชะงัก น้ำมันดิบเบรนท์พุ่งเกิน $100/บาร์เรล ในมีนาคม 2569 ไทยนำเข้าน้ำมันดิบ ~80% -- ราคาน้ำมันในประเทศตามตลาดโลกโดยมีกองทุนน้ำมันเป็นตัวพยุง",
		charts: [
			{
				title: "BRENT CRUDE OIL",
				titleTh: "น้ำมันดิบเบรนท์",
				subtitle: "Global benchmark price",
				subtitleTh: "ราคาอ้างอิงโลก",
				metrics: ["brent_crude_usd", "brent_crude_fred"],
				unit: "USD/bbl",
				color: "#f87171",
				fillColor: "rgba(248,113,113,0.08)",
			},
			{
				title: "DIESEL B7 -- THAILAND RETAIL",
				titleTh: "ดีเซล B7 -- ราคาขายปลีกไทย",
				subtitle: "Monthly weighted average from EPPO (official)",
				subtitleTh: "ค่าเฉลี่ยถ่วงน้ำหนักรายเดือน จาก สนพ. (ข้อมูลทางการ)",
				metrics: ["eppo_hsd_b7"],
				unit: "THB/L",
				color: "#34d399",
				fillColor: "rgba(52,211,153,0.08)",
			},
			{
				title: "GASOHOL 95 -- THAILAND RETAIL",
				titleTh: "แก๊สโซฮอล์ 95 -- ราคาขายปลีกไทย",
				subtitle: "Monthly weighted average from EPPO (official)",
				subtitleTh: "ค่าเฉลี่ยถ่วงน้ำหนักรายเดือน จาก สนพ. (ข้อมูลทางการ)",
				metrics: ["eppo_e10"],
				unit: "THB/L",
				color: "#a78bfa",
				fillColor: "rgba(167,139,250,0.08)",
			},
		],
	},
	{
		id: "currency",
		icon: "💱",
		title: "CURRENCY & TRADE",
		titleTh: "ค่าเงินและการค้า",
		context: "Energy imports are priced in USD. As oil prices spike, Thailand's trade deficit widens, putting downward pressure on the baht. A weaker baht makes fuel even more expensive -- a vicious cycle. The Oil Fund (established to stabilize retail prices) is bleeding cash to contain the damage.",
		contextTh: "การนำเข้าพลังงานคิดราคาเป็น USD เมื่อราคาน้ำมันพุ่ง ขาดดุลการค้าของไทยกว้างขึ้น กดดันค่าเงินบาท บาทอ่อนทำให้น้ำมันแพงขึ้น -- เป็นวงจรอุบาทว์ กองทุนน้ำมัน (ที่ตั้งขึ้นเพื่อรักษาเสถียรภาพราคาปลีก) กำลังขาดทุนหนัก",
		charts: [
			{
				title: "THB/USD EXCHANGE RATE",
				titleTh: "อัตราแลกเปลี่ยน บาท/ดอลลาร์",
				subtitle: "Higher = weaker baht = more expensive imports",
				subtitleTh: "ยิ่งสูง = บาทอ่อน = นำเข้าแพงขึ้น",
				metrics: ["thb_usd"],
				unit: "THB/USD",
				color: "#60a5fa",
				fillColor: "rgba(96,165,250,0.08)",
				invertChange: true,
			},
		],
	},
	{
		id: "supply-chain",
		icon: "🏭",
		title: "SUPPLY CHAIN INDICATORS",
		titleTh: "ตัวชี้วัดห่วงโซ่อุปทาน",
		context: "Thailand imports plastic pellets and fertilizer from Iran -- the government is now negotiating food-for-plastics barter deals to bypass sanctions. These US producer price indices track global manufacturing costs for the same commodities. When these indices rise, Thai import costs follow.",
		contextTh: "ไทยนำเข้าเม็ดพลาสติกและปุ๋ยจากอิหร่าน -- รัฐบาลกำลังเจรจาแลกเปลี่ยนอาหารกับพลาสติกเพื่อหลีกเลี่ยงมาตรการคว่ำบาตร ดัชนี PPI สหรัฐเหล่านี้ติดตามต้นทุนการผลิตโลก เมื่อดัชนีเหล่านี้ขึ้น ต้นทุนนำเข้าของไทยก็ขึ้นตาม",
		charts: [
			{
				title: "FERTILIZER COST INDEX",
				titleTh: "ดัชนีต้นทุนปุ๋ย",
				subtitle: "Global indicator -- US fertilizer manufacturing PPI (FRED)",
				subtitleTh: "ตัวชี้วัดโลก -- PPI การผลิตปุ๋ยสหรัฐ (FRED)",
				metrics: ["fertilizer_ppi"],
				unit: "Index",
				color: "#fbbf24",
				fillColor: "rgba(251,191,36,0.08)",
			},
			{
				title: "PLASTIC RESINS COST INDEX",
				titleTh: "ดัชนีต้นทุนเม็ดพลาสติก",
				subtitle: "Global indicator -- US plastic resins PPI (FRED)",
				subtitleTh: "ตัวชี้วัดโลก -- PPI เม็ดพลาสติกสหรัฐ (FRED)",
				metrics: ["plastic_resins_ppi"],
				unit: "Index",
				color: "#fb923c",
				fillColor: "rgba(251,146,60,0.08)",
			},
		],
	},
	{
		id: "brands",
		icon: "⛽",
		title: "DIESEL PRICES BY BRAND",
		titleTh: "ราคาดีเซลรายแบรนด์",
		context: "Different brands set different prices based on their supply chains and subsidy strategies. The spread between cheapest and most expensive tells you how fragmented the market has become.",
		contextTh: "แต่ละแบรนด์ตั้งราคาต่างกันตามห่วงโซ่อุปทานและกลยุทธ์การอุดหนุน ส่วนต่างระหว่างถูกสุดและแพงสุดบอกว่าตลาดแตกแยกแค่ไหน",
		charts: [],
	},
];

// ─── Brand chart config ──────────────────────────────────────────

const BRAND_COLORS: Record<string, { color: string; label: string }> = {
	diesel_ptt: { color: "#eab308", label: "PTT" },
	diesel_bcp: { color: "#22c55e", label: "Bangchak" },
	diesel_shell: { color: "#ef4444", label: "Shell" },
	diesel_caltex: { color: "#dc2626", label: "Caltex" },
	diesel_pt: { color: "#3b82f6", label: "PT" },
	diesel_pure: { color: "#8b5cf6", label: "Pure" },
	diesel_susco_dealers: { color: "#f97316", label: "SUSCO" },
};

// ─── Components ──────────────────────────────────────────────────

function TrendChart({ data, chart, lang }: { data: PriceRecord[]; chart: ChartDef; lang: "en" | "th" }) {
	const filtered = data
		.filter((d) => chart.metrics.includes(d.metric))
		.sort((a, b) => a.date.localeCompare(b.date));

	if (filtered.length < 2) {
		return (
			<div className="rounded-xl border border-border bg-card/50 p-5">
				<h3 className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">
					{lang === "th" ? chart.titleTh : chart.title}
				</h3>
				<p className="mt-2 text-xs text-muted-foreground">
					{lang === "th" ? "ยังไม่มีข้อมูลเพียงพอ -- ข้อมูลจะสะสมทุกวัน" : "Not enough data yet -- accumulates daily from cron"}
				</p>
			</div>
		);
	}

	const latest = filtered[filtered.length - 1];
	const first = filtered[0];
	const change = latest.value - first.value;
	const changePct = ((change / first.value) * 100).toFixed(1);
	const isUp = change >= 0;
	const isBad = chart.invertChange ? !isUp : isUp;

	return (
		<div className="rounded-xl border border-border bg-card/50 p-5">
			<div className="flex items-start justify-between mb-3">
				<div>
					<h3 className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">
						{lang === "th" ? chart.titleTh : chart.title}
					</h3>
					<p className="text-[10px] text-muted-foreground">
						{lang === "th" ? chart.subtitleTh : chart.subtitle}
					</p>
				</div>
				<div className="text-right">
					<div className="font-mono text-xl font-black text-foreground">
						{latest.value.toFixed(latest.value >= 100 ? 0 : 2)}
					</div>
					<span className={`font-mono text-xs font-bold ${isBad ? "text-red-400" : "text-emerald-400"}`}>
						{isUp ? "+" : ""}{changePct}%
					</span>
					<span className="ml-1 text-[10px] text-muted-foreground">{chart.unit}</span>
				</div>
			</div>
			<AreaChart
				data={filtered.map((d) => ({ label: d.date, value: d.value }))}
				height={180}
				color={chart.color}
				fillColor={chart.fillColor}
				yLabel={chart.unit}
			/>
			<div className="mt-2 flex gap-4 text-[10px] text-muted-foreground font-mono">
				<span>{filtered.length} pts</span>
				<span>{first.date} -- {latest.date}</span>
			</div>
		</div>
	);
}

function BrandDieselChart({ data, lang }: { data: PriceRecord[]; lang: "en" | "th" }) {
	const brandMetrics = Object.keys(BRAND_COLORS);
	const brandData = data.filter((d) => brandMetrics.includes(d.metric));

	if (brandData.length < 1) {
		return (
			<div className="rounded-xl border border-border bg-card/50 p-5">
				<p className="text-xs text-muted-foreground">
					{lang === "th" ? "ยังไม่มีข้อมูล" : "No brand data yet"}
				</p>
			</div>
		);
	}

	const latestByBrand: Record<string, PriceRecord> = {};
	for (const d of brandData) {
		if (!latestByBrand[d.metric] || d.date > latestByBrand[d.metric].date) {
			latestByBrand[d.metric] = d;
		}
	}

	const sorted = Object.entries(latestByBrand).sort(([, a], [, b]) => a.value - b.value);
	const spread = sorted.length > 1 ? sorted[sorted.length - 1][1].value - sorted[0][1].value : 0;

	return (
		<div className="rounded-xl border border-border bg-card/50 p-5">
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
									className="h-full rounded"
									style={{ width: `${pct}%`, backgroundColor: brand.color, opacity: 0.5 }}
								/>
								<span className="absolute inset-y-0 right-2 flex items-center font-mono text-xs font-bold text-foreground">
									{record.value.toFixed(2)}
								</span>
							</div>
							{i === 0 && <span className="text-[10px] text-emerald-400 font-mono font-bold shrink-0">{lang === "th" ? "ถูกสุด" : "LOWEST"}</span>}
							{i === sorted.length - 1 && sorted.length > 1 && <span className="text-[10px] text-red-400 font-mono font-bold shrink-0">{lang === "th" ? "แพงสุด" : "HIGHEST"}</span>}
						</div>
					);
				})}
			</div>
			{spread > 0 && (
				<div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
					<span className="font-mono text-xs text-amber-400">
						{lang === "th" ? `ส่วนต่าง: ฿${spread.toFixed(2)}/ลิตร` : `Spread: ฿${spread.toFixed(2)}/litre`}
					</span>
				</div>
			)}
			<div className="mt-2 text-[10px] text-muted-foreground font-mono">
				{lang === "th" ? "บาท/ลิตร" : "THB/L"} | {sorted[0]?.[1]?.date || ""}
			</div>
		</div>
	);
}

function SectionHeader({ section, lang }: { section: StorySection; lang: "en" | "th" }) {
	return (
		<div className="pt-4">
			<div className="flex items-center gap-3 mb-2">
				<span className="text-2xl">{section.icon}</span>
				<h2 className="font-mono text-lg font-black text-foreground uppercase tracking-wider">
					{lang === "th" ? section.titleTh : section.title}
				</h2>
			</div>
			<p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
				{lang === "th" ? section.contextTh : section.context}
			</p>
		</div>
	);
}

function MetricsSummary({ data, lang }: { data: PriceRecord[]; lang: "en" | "th" }) {
	const latest: Record<string, PriceRecord> = {};
	for (const d of data) {
		if (!latest[d.metric] || d.date > latest[d.metric].date) {
			latest[d.metric] = d;
		}
	}

	const uniqueMetrics = Object.keys(latest).length;
	const totalRecords = data.length;
	const sources = [...new Set(data.map((d) => d.source))];
	const earliestDate = data.length > 0 ? data.reduce((a, b) => a.date < b.date ? a : b).date : "--";

	return (
		<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
			{[
				{ value: uniqueMetrics, label: lang === "th" ? "ตัวชี้วัด" : "Metrics" },
				{ value: totalRecords.toLocaleString(), label: lang === "th" ? "จุดข้อมูล" : "Data Points" },
				{ value: sources.length, label: lang === "th" ? "แหล่งข้อมูล" : "Sources" },
				{ value: earliestDate, label: lang === "th" ? "ตั้งแต่" : "Since", small: true },
			].map((card) => (
				<div key={card.label} className="rounded-lg border border-border bg-card p-3 text-center">
					<div className={`font-mono font-black text-foreground ${card.small ? "text-lg" : "text-2xl"}`}>{card.value}</div>
					<div className="text-[10px] text-muted-foreground uppercase tracking-wider">{card.label}</div>
				</div>
			))}
		</div>
	);
}

// ─── Page ────────────────────────────────────────────────────────

export default function TrendsPage() {
	const { lang } = useLanguage();
	const [data, setData] = useState<PriceRecord[] | null>(null);

	useEffect(() => {
		fetch("/api/history/prices?days=1095")
			.then((r) => r.ok ? r.json() : null)
			.then((d) => setData(d?.data || []))
			.catch(() => setData([]));
	}, []);

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader
				page="TRENDS"
				pageTh="แนวโน้ม"
				subtitle={lang === "th" ? "ผลกระทบทางเศรษฐกิจจากสงครามอิหร่าน" : "Economic impact of the Iran war on Thailand"}
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

						{STORY.map((section) => (
							<div key={section.id} className="space-y-4">
								<SectionHeader section={section} lang={lang} />

								{section.charts.map((chart) => (
									<TrendChart key={chart.title} data={data} chart={chart} lang={lang} />
								))}

								{section.id === "brands" && (
									<BrandDieselChart data={data} lang={lang} />
								)}
							</div>
						))}

						<div className="rounded-xl border border-dashed border-muted-foreground/20 bg-muted/5 p-6 text-center">
							<p className="text-sm text-muted-foreground">
								{lang === "th"
									? "ข้อมูลสะสมทุกวันจาก cron อัตโนมัติ กราฟจะสมบูรณ์ขึ้นเมื่อมีข้อมูลมากขึ้น"
									: "Data accumulates daily from automated cron. Charts fill in as more data points are captured."
								}
							</p>
							<p className="mt-1 text-[10px] text-muted-foreground/60">
								{lang === "th"
									? "แหล่งข้อมูล: สนพ., FRED, Yahoo Finance, Frankfurter, thai-oil-api, efinancethai"
									: "Sources: EPPO, FRED, Yahoo Finance, Frankfurter, thai-oil-api, efinancethai"
								}
							</p>
						</div>
					</>
				)}
			</main>

			<SiteFooter
				text="Open source crisis data. Built during the 2026 Iran war."
				textTh="ข้อมูลวิกฤตแบบเปิด สร้างในช่วงสงครามอิหร่าน 2569"
			/>
		</div>
	);
}
