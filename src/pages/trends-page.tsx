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
		id: "compound",
		icon: "💥",
		title: "THE DOUBLE WHAMMY",
		titleTh: "ผลกระทบทวีคูณ",
		context: "Oil prices are in USD. When the baht weakens AND crude spikes simultaneously, Thailand gets hit from both sides. This chart shows what Thailand ACTUALLY pays for crude oil in baht -- the compound effect is worse than either metric alone.",
		contextTh: "ราคาน้ำมันคิดเป็น USD เมื่อบาทอ่อนและน้ำมันดิบพุ่งพร้อมกัน ไทยโดนจากทั้งสองด้าน กราฟนี้แสดงราคาน้ำมันดิบที่ไทยจ่ายจริงเป็นบาท -- ผลกระทบทวีคูณหนักกว่าตัวชี้วัดแต่ละตัว",
		charts: [
			{
				title: "BRENT CRUDE IN THAI BAHT",
				titleTh: "น้ำมันดิบเบรนท์ (เป็นบาท)",
				subtitle: "Brent USD x THB/USD = what Thailand actually pays",
				subtitleTh: "เบรนท์ USD x อัตราแลกเปลี่ยน = ราคาที่ไทยจ่ายจริง",
				metrics: ["brent_thb"],
				unit: "THB/bbl",
				color: "#f43f5e",
				fillColor: "rgba(244,63,94,0.08)",
			},
		],
	},
	{
		id: "currency",
		icon: "💱",
		title: "CURRENCY PRESSURE",
		titleTh: "แรงกดดันค่าเงิน",
		context: "Energy imports are priced in USD. As oil prices spike, Thailand's trade deficit widens, putting downward pressure on the baht. A weaker baht makes fuel even more expensive -- a vicious cycle. The Oil Fund (established to stabilize retail prices) is bleeding cash to contain the damage.",
		contextTh: "การนำเข้าพลังงานคิดราคาเป็น USD เมื่อราคาน้ำมันพุ่ง ขาดดุลการค้าของไทยกว้างขึ้น กดดันค่าเงินบาท บาทอ่อนทำให้น้ำมันแพงขึ้น -- เป็นวงจรอุบาทว์ กองทุนน้ำมัน (ที่ตั้งขึ้นเพื่อรักษาเสถียรภาพราคาปลีก) กำลังขาดทุนหนัก",
		charts: [
			{
				title: "THB/USD EXCHANGE RATE",
				titleTh: "อัตราแลกเปลี่ยน บาท/ดอลลาร์",
				subtitle: "Official Bank of Thailand mid rate. Higher = weaker baht.",
				subtitleTh: "อัตรากลาง ธปท. ยิ่งสูง = บาทอ่อน = นำเข้าแพงขึ้น",
				metrics: ["thb_usd_bot", "thb_usd"],
				unit: "THB/USD",
				color: "#60a5fa",
				fillColor: "rgba(96,165,250,0.08)",
				invertChange: true,
			},
		],
	},
	{
		id: "electricity",
		icon: "⚡",
		title: "ELECTRICITY RISK",
		titleTh: "ความเสี่ยงค่าไฟ",
		context: "Thailand generates 67% of its electricity from natural gas. Henry Hub is the global benchmark -- when gas prices rise, Thai power bills follow within 3-6 months. The war has disrupted LNG supply chains worldwide.",
		contextTh: "ไทยผลิตไฟฟ้า 67% จากก๊าซธรรมชาติ Henry Hub เป็นราคาอ้างอิงโลก -- เมื่อราคาก๊าซขึ้น ค่าไฟไทยจะตามภายใน 3-6 เดือน สงครามทำให้ห่วงโซ่อุปทาน LNG ทั่วโลกหยุดชะงัก",
		charts: [
			{
				title: "NATURAL GAS (HENRY HUB)",
				titleTh: "ก๊าซธรรมชาติ (Henry Hub)",
				subtitle: "Global benchmark -- drives Thai electricity costs",
				subtitleTh: "ราคาอ้างอิงโลก -- กำหนดต้นทุนไฟฟ้าของไทย",
				metrics: ["natgas_henry_hub"],
				unit: "USD/MMBtu",
				color: "#38bdf8",
				fillColor: "rgba(56,189,248,0.08)",
			},
		],
	},
	{
		id: "supply-chain",
		icon: "🏭",
		title: "SUPPLY CHAIN & BARTER",
		titleTh: "ห่วงโซ่อุปทานและการแลกเปลี่ยน",
		context: "Thailand imports plastic pellets and fertilizer from Iran -- the government is now negotiating food-for-plastics barter deals to bypass sanctions. These US producer price indices track global manufacturing costs for the same commodities. When these indices rise, Thai import costs follow. The Oil Fund levy shows how much the government is subsidizing each litre.",
		contextTh: "ไทยนำเข้าเม็ดพลาสติกและปุ๋ยจากอิหร่าน -- รัฐบาลกำลังเจรจาแลกเปลี่ยนอาหารกับพลาสติก ดัชนี PPI สหรัฐติดตามต้นทุนโลก กองทุนน้ำมันแสดงว่ารัฐบาลอุดหนุนเท่าไรต่อลิตร",
		charts: [
			{
				title: "OIL FUND LEVY (DIESEL)",
				titleTh: "เงินส่งเข้ากองทุนน้ำมัน (ดีเซล)",
				subtitle: "EPPO -- negative = government paying subsidy per litre",
				subtitleTh: "สนพ. -- ติดลบ = รัฐจ่ายเงินอุดหนุนต่อลิตร",
				metrics: ["oilfund_hsd_(b7)", "oilfund_hsd_b7", "oilfund_lsd"],
				unit: "THB/L",
				color: "#fbbf24",
				fillColor: "rgba(251,191,36,0.08)",
			},
			{
				title: "FERTILIZER COST INDEX",
				titleTh: "ดัชนีต้นทุนปุ๋ย",
				subtitle: "Global indicator -- US fertilizer manufacturing PPI (FRED)",
				subtitleTh: "ตัวชี้วัดโลก -- PPI การผลิตปุ๋ยสหรัฐ (FRED)",
				metrics: ["fertilizer_ppi"],
				unit: "Index",
				color: "#a3e635",
				fillColor: "rgba(163,230,53,0.08)",
			},
			{
				title: "PLASTIC RESINS COST INDEX",
				titleTh: "ดัชนีต้นทุนเม็ดพลาสติก",
				subtitle: "Global indicator -- US plastic resins PPI (FRED). Thailand imports pellets from Iran.",
				subtitleTh: "ตัวชี้วัดโลก -- PPI เม็ดพลาสติกสหรัฐ (FRED) ไทยนำเข้าจากอิหร่าน",
				metrics: ["plastic_resins_ppi"],
				unit: "Index",
				color: "#fb923c",
				fillColor: "rgba(251,146,60,0.08)",
			},
		],
	},
	{
		id: "market",
		icon: "📉",
		title: "MARKET CONFIDENCE",
		titleTh: "ความเชื่อมั่นตลาด",
		context: "Thai energy stocks are a real-time barometer. PTT (state oil company) and PTTEP (exploration) are the bellwethers. When investors lose confidence in the energy sector, these stocks drop -- signaling expectations of prolonged disruption.",
		contextTh: "หุ้นพลังงานไทยเป็นตัวชี้วัดแบบเรียลไทม์ PTT (บริษัทน้ำมันรัฐ) และ PTTEP (สำรวจ) เป็นหุ้นนำ เมื่อนักลงทุนขาดความเชื่อมั่น หุ้นเหล่านี้จะร่วง -- ส่งสัญญาณว่าวิกฤตจะยืดเยื้อ",
		charts: [
			{
				title: "PTT PCL",
				titleTh: "บมจ. ปตท.",
				subtitle: "Thailand's state oil company -- SET:PTT",
				subtitleTh: "บริษัทน้ำมันแห่งชาติ -- SET:PTT",
				metrics: ["stock_ptt"],
				unit: "THB",
				color: "#eab308",
				fillColor: "rgba(234,179,8,0.08)",
			},
			{
				title: "PTTEP",
				titleTh: "ปตท.สผ.",
				subtitle: "PTT Exploration & Production -- SET:PTTEP",
				subtitleTh: "ปตท. สำรวจและผลิตปิโตรเลียม -- SET:PTTEP",
				metrics: ["stock_pttep"],
				unit: "THB",
				color: "#22d3ee",
				fillColor: "rgba(34,211,238,0.08)",
			},
			{
				title: "BANGCHAK (BCP)",
				titleTh: "บางจาก (BCP)",
				subtitle: "Major refiner & retailer -- SET:BCP",
				subtitleTh: "ผู้กลั่นและผู้ค้าปลีกรายใหญ่ -- SET:BCP",
				metrics: ["stock_bcp"],
				unit: "THB",
				color: "#22c55e",
				fillColor: "rgba(34,197,94,0.08)",
			},
		],
	},
	{
		id: "brands",
		icon: "⛽",
		title: "DIESEL PRICES BY BRAND",
		titleTh: "ราคาดีเซลรายแบรนด์",
		context: "Different brands set different prices based on their supply chains and subsidy strategies. The spread between cheapest and most expensive tells you how fragmented the market has become under crisis pressure.",
		contextTh: "แต่ละแบรนด์ตั้งราคาต่างกันตามห่วงโซ่อุปทานและกลยุทธ์การอุดหนุน ส่วนต่างระหว่างถูกสุดและแพงสุดบอกว่าตลาดแตกแยกแค่ไหนภายใต้แรงกดดันวิกฤต",
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

function TrendChart({ data, chart, lang, dateRange }: { data: PriceRecord[]; chart: ChartDef; lang: "en" | "th"; dateRange?: [string, string] }) {
	const filtered = data
		.filter((d) => chart.metrics.includes(d.metric))
		.filter((d) => !dateRange || (d.date >= dateRange[0] && d.date <= dateRange[1]))
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

function getSectionDateRange(data: PriceRecord[], section: StorySection): [string, string] | undefined {
	const allMetrics = section.charts.flatMap((c) => c.metrics);
	if (allMetrics.length === 0) return undefined;

	// For each metric, find its date range
	const ranges: { min: string; max: string }[] = [];
	for (const metric of allMetrics) {
		const dates = data.filter((d) => d.metric === metric).map((d) => d.date);
		if (dates.length > 0) {
			ranges.push({ min: dates.reduce((a, b) => a < b ? a : b), max: dates.reduce((a, b) => a > b ? a : b) });
		}
	}
	if (ranges.length === 0) return undefined;

	// Use the LATEST start date and EARLIEST end date (intersection)
	const start = ranges.reduce((a, b) => a.min > b.min ? a : b).min;
	const end = ranges.reduce((a, b) => a.max < b.max ? a : b).max;

	return start <= end ? [start, end] : undefined;
}

const COUNTRY_LABELS: Record<string, { en: string; th: string; flag: string }> = {
	th: { en: "Thailand", th: "ไทย", flag: "🇹🇭" },
	my: { en: "Malaysia", th: "มาเลเซีย", flag: "🇲🇾" },
	sg: { en: "Singapore", th: "สิงคโปร์", flag: "🇸🇬" },
	id: { en: "Indonesia", th: "อินโดนีเซีย", flag: "🇮🇩" },
	vn: { en: "Vietnam", th: "เวียดนาม", flag: "🇻🇳" },
	ph: { en: "Philippines", th: "ฟิลิปปินส์", flag: "🇵🇭" },
	kh: { en: "Cambodia", th: "กัมพูชา", flag: "🇰🇭" },
	mm: { en: "Myanmar", th: "เมียนมา", flag: "🇲🇲" },
	jp: { en: "Japan", th: "ญี่ปุ่น", flag: "🇯🇵" },
	us: { en: "USA", th: "สหรัฐ", flag: "🇺🇸" },
};

function IntlDieselChart({ data, lang }: { data: PriceRecord[]; lang: "en" | "th" }) {
	const intlData = data.filter((d) => d.metric.startsWith("diesel_intl_"));
	if (intlData.length === 0) return null;

	// Get latest price per country
	const latestByCountry: Record<string, PriceRecord> = {};
	for (const d of intlData) {
		const code = d.metric.replace("diesel_intl_", "");
		if (!latestByCountry[code] || d.date > latestByCountry[code].date) {
			latestByCountry[code] = d;
		}
	}

	const sorted = Object.entries(latestByCountry).sort(([, a], [, b]) => a.value - b.value);
	const maxPrice = Math.max(...sorted.map(([, r]) => r.value));
	const thPrice = latestByCountry["th"]?.value;

	return (
		<div className="rounded-xl border border-border bg-card/50 p-5">
			<div className="mb-4">
				<h3 className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">
					{lang === "th" ? "เปรียบเทียบราคาดีเซลในภูมิภาค" : "REGIONAL DIESEL PRICE COMPARISON"}
				</h3>
				<p className="text-[10px] text-muted-foreground">
					{lang === "th" ? "ราคาดีเซล B7 เป็นบาท/ลิตร จาก สนพ." : "Diesel B7 in THB/L from EPPO. Shows where Thailand sits vs neighbors."}
				</p>
			</div>

			<div className="space-y-1.5">
				{sorted.map(([code, record]) => {
					const country = COUNTRY_LABELS[code] || { en: code.toUpperCase(), th: code.toUpperCase(), flag: "" };
					const pct = (record.value / maxPrice) * 100;
					const isTh = code === "th";
					const barColor = isTh ? "rgba(251,191,36,0.6)" : "rgba(255,255,255,0.1)";

					return (
						<div key={code} className={`flex items-center gap-2 ${isTh ? "bg-amber-500/10 rounded px-1 py-0.5 -mx-1" : ""}`}>
							<span className="w-5 text-center text-sm">{country.flag}</span>
							<span className={`w-20 shrink-0 text-right font-mono text-xs ${isTh ? "font-black text-amber-400" : "text-foreground"}`}>
								{lang === "th" ? country.th : country.en}
							</span>
							<div className="flex-1 h-5 rounded bg-muted/20 overflow-hidden relative">
								<div className="h-full rounded" style={{ width: `${pct}%`, backgroundColor: barColor }} />
								<span className={`absolute inset-y-0 right-2 flex items-center font-mono text-[10px] ${isTh ? "font-bold text-amber-400" : "text-muted-foreground"}`}>
									{record.value.toFixed(2)}
								</span>
							</div>
							{thPrice && !isTh && (
								<span className={`w-14 text-right font-mono text-[10px] ${record.value < thPrice ? "text-emerald-400" : "text-red-400"}`}>
									{record.value < thPrice ? "" : "+"}{((record.value / thPrice - 1) * 100).toFixed(0)}%
								</span>
							)}
						</div>
					);
				})}
			</div>

			<div className="mt-2 text-[10px] text-muted-foreground font-mono">
				{sorted[0]?.[1]?.date || ""} | {lang === "th" ? "ที่มา: สนพ." : "Source: EPPO"}
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

						{STORY.map((section) => {
							const dateRange = getSectionDateRange(data, section);
							return (
							<div key={section.id} className="space-y-4">
								<SectionHeader section={section} lang={lang} />
								{dateRange && (
									<div className="text-[10px] text-muted-foreground font-mono px-1">
										{lang === "th" ? "ช่วงเวลา" : "Period"}: {dateRange[0]} -- {dateRange[1]}
									</div>
								)}

								{section.charts.map((chart) => (
									<TrendChart key={chart.title} data={data} chart={chart} lang={lang} dateRange={dateRange} />
								))}

								{section.id === "energy" && (
									<IntlDieselChart data={data} lang={lang} />
								)}

								{section.id === "brands" && (
									<BrandDieselChart data={data} lang={lang} />
								)}
							</div>
							);
						})}

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
