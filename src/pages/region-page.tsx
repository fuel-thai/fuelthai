import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useLanguage } from "../lib/language-store";
import { t } from "../lib/translations";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { Skeleton, SkeletonProvinceRow } from "../components/skeleton";

interface ProvinceStats {
	province_id: number;
	name_th: string;
	name_en: string;
	region: string;
	total_stations: number;
	diesel_available: number;
	diesel_limited: number;
	diesel_out: number;
	diesel_pending: number;
	diesel_unknown: number;
	recorded_at: string;
}

const REGION_ORDER = ["Central", "East", "North", "Northeast", "South"];
const REGION_LABELS: Record<string, { en: string; th: string }> = {
	Central: { en: "Central", th: "ภาคกลาง" },
	East: { en: "Eastern", th: "ภาคตะวันออก" },
	North: { en: "Northern", th: "ภาคเหนือ" },
	Northeast: { en: "Northeastern (Isan)", th: "ภาคตะวันออกเฉียงเหนือ (อีสาน)" },
	South: { en: "Southern", th: "ภาคใต้" },
};

function availPercent(p: ProvinceStats): number {
	const reporting = p.total_stations - p.diesel_unknown;
	if (reporting === 0) return -1;
	return Math.round(((p.diesel_available + p.diesel_limited) / reporting) * 100);
}

function availColor(pct: number): string {
	if (pct < 0) return "text-muted-foreground";
	if (pct >= 60) return "text-emerald-400";
	if (pct >= 30) return "text-amber-400";
	return "text-red-400";
}

function availBg(pct: number): string {
	if (pct < 0) return "bg-muted/30";
	if (pct >= 60) return "bg-emerald-500/5 border-emerald-500/20";
	if (pct >= 30) return "bg-amber-500/5 border-amber-500/20";
	return "bg-red-500/5 border-red-500/20";
}

function BarSegment({ value, total, color }: { value: number; total: number; color: string }) {
	const pct = total > 0 ? (value / total) * 100 : 0;
	if (pct < 1) return null;
	return <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />;
}

function ProvinceRow({ p, lang }: { p: ProvinceStats; lang: "en" | "th" }) {
	const pct = availPercent(p);
	const reporting = p.total_stations - p.diesel_unknown;
	const noData = reporting === 0;

	return (
		<div className={`rounded-lg p-3 transition-all hover:scale-[1.01] ${noData ? "opacity-20 border border-muted bg-muted/10" : `border ${availBg(pct)}`}`}>
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0 flex-1">
					<h3 className="font-mono text-sm font-bold text-foreground truncate">
						{lang === "th" ? p.name_th : p.name_en}
					</h3>
					<span className="text-[10px] text-muted-foreground">
						{reporting} {lang === "th" ? "รายงาน" : "reporting"} / {p.total_stations} {lang === "th" ? "สถานี" : "stations"}
					</span>
				</div>
				<div className="shrink-0 text-right">
					{pct >= 0 ? (
						<div className={`font-mono text-xl font-black ${availColor(pct)}`}>{pct}%</div>
					) : (
						<div className="font-mono text-sm text-muted-foreground">--</div>
					)}
				</div>
			</div>

			{/* Stacked bar */}
			{reporting > 0 && (
				<div className="mt-2 flex gap-0.5 overflow-hidden rounded-full">
					<BarSegment value={p.diesel_available} total={reporting} color="bg-emerald-500" />
					<BarSegment value={p.diesel_limited} total={reporting} color="bg-amber-500" />
					<BarSegment value={p.diesel_pending} total={reporting} color="bg-blue-500" />
					<BarSegment value={p.diesel_out} total={reporting} color="bg-red-500" />
				</div>
			)}

			{/* Numbers row */}
			<div className="mt-1.5 flex flex-wrap gap-3 text-[10px] font-mono">
				{p.diesel_available > 0 && <span className="text-emerald-400">{p.diesel_available} {lang === "th" ? "มี" : "avail"}</span>}
				{p.diesel_limited > 0 && <span className="text-amber-400">{p.diesel_limited} {lang === "th" ? "จำกัด" : "ltd"}</span>}
				{p.diesel_pending > 0 && <span className="text-blue-400">{p.diesel_pending} {lang === "th" ? "รอ" : "pend"}</span>}
				{p.diesel_out > 0 && <span className="text-red-400">{p.diesel_out} {lang === "th" ? "หมด" : "out"}</span>}
			</div>
		</div>
	);
}

export default function RegionPage() {
	const { lang } = useLanguage();
	const [data, setData] = useState<ProvinceStats[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		fetch("/api/history/provinces")
			.then((r) => r.ok ? r.json() : null)
			.then((d) => { if (d?.provinces) setData(d.provinces); })
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	const grouped = REGION_ORDER.map((region) => ({
		region,
		label: REGION_LABELS[region],
		provinces: data.filter((p) => p.region === region).sort((a, b) => availPercent(b) - availPercent(a)),
	})).filter((g) => g.provinces.length > 0);

	// Nationwide totals
	const totals = data.reduce(
		(acc, p) => ({
			stations: acc.stations + p.total_stations,
			available: acc.available + p.diesel_available,
			limited: acc.limited + p.diesel_limited,
			out: acc.out + p.diesel_out,
			pending: acc.pending + p.diesel_pending,
			unknown: acc.unknown + p.diesel_unknown,
		}),
		{ stations: 0, available: 0, limited: 0, out: 0, pending: 0, unknown: 0 },
	);
	const reporting = totals.stations - totals.unknown;
	const nationalPct = reporting > 0 ? Math.round(((totals.available + totals.limited) / reporting) * 100) : 0;

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader page="REGIONS" pageTh="ภูมิภาค" subtitle="Province-level diesel status -- data from DOEB Fuel Now" subtitleTh="สถานะดีเซลรายจังหวัด -- ข้อมูลจาก DOEB Fuel Now" />

			<main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
				{loading && (
					<div className="space-y-6">
						<div className="rounded-xl border-2 border-muted bg-card p-5 space-y-3">
							<Skeleton className="h-4 w-24" />
							<Skeleton className="h-10 w-16" />
							<Skeleton className="h-3 w-full rounded-full" />
						</div>
						<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{Array.from({ length: 9 }).map((_, i) => <SkeletonProvinceRow key={i} />)}
						</div>
					</div>
				)}

				{/* National summary */}
				{!loading && data.length > 0 && (
					<div className="rounded-xl border-2 border-accent/40 bg-accent/5 p-5">
						<div className="flex items-center justify-between">
							<div>
								<h2 className="font-mono text-sm font-bold text-accent uppercase tracking-wider">
									{lang === "th" ? "ภาพรวมทั้งประเทศ" : "NATIONWIDE"}
								</h2>
								<p className="text-xs text-muted-foreground">
									{reporting.toLocaleString()} {lang === "th" ? "สถานีรายงาน จาก" : "reporting of"} {totals.stations.toLocaleString()} {lang === "th" ? "สถานี" : "stations"}
								</p>
							</div>
							<div className={`font-mono text-4xl font-black ${availColor(nationalPct)}`}>
								{nationalPct}%
							</div>
						</div>
						<div className="mt-3 flex gap-0.5 overflow-hidden rounded-full h-3">
							<BarSegment value={totals.available} total={reporting} color="bg-emerald-500" />
							<BarSegment value={totals.limited} total={reporting} color="bg-amber-500" />
							<BarSegment value={totals.pending} total={reporting} color="bg-blue-500" />
							<BarSegment value={totals.out} total={reporting} color="bg-red-500" />
						</div>
						<div className="mt-2 flex flex-wrap gap-4 text-xs font-mono">
							<span className="text-emerald-400">{totals.available} {lang === "th" ? "มี" : "available"}</span>
							<span className="text-amber-400">{totals.limited} {lang === "th" ? "จำกัด" : "limited"}</span>
							<span className="text-blue-400">{totals.pending} {lang === "th" ? "รอเติม" : "pending"}</span>
							<span className="text-red-400">{totals.out} {lang === "th" ? "หมด" : "out"}</span>
							<span className="text-muted-foreground">{totals.unknown} {lang === "th" ? "ไม่ทราบ" : "unknown"}</span>
						</div>
						{data.length > 0 && data[0].recorded_at && (
							<p className="mt-2 text-[10px] text-muted-foreground">
								{t("updated", lang)}: {new Date(data[0].recorded_at).toLocaleString(lang === "th" ? "th-TH" : "en-GB")}
							</p>
						)}
					</div>
				)}

				{/* Legend */}
				{!loading && data.length > 0 && (
					<div className="flex flex-wrap gap-3 text-[10px] font-mono text-muted-foreground">
						<span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> {lang === "th" ? "มีดีเซล" : "Available"}</span>
						<span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> {lang === "th" ? "จำกัด" : "Limited"}</span>
						<span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-blue-500" /> {lang === "th" ? "รอเติม" : "Pending"}</span>
						<span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> {lang === "th" ? "หมด" : "Out"}</span>
					</div>
				)}

				{/* Regions */}
				{!loading && grouped.map((group) => (
					<div key={group.region}>
						<div className="mb-3 flex items-center gap-2">
							<div className="h-px flex-1 bg-border" />
							<span className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-widest">
								{lang === "th" ? group.label.th : group.label.en} ({group.provinces.length})
							</span>
							<div className="h-px flex-1 bg-border" />
						</div>
						<div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
							{group.provinces.map((p) => (
								<Link key={p.province_id} to={`/regions/${p.province_id}` as any} className="block">
									<ProvinceRow p={p} lang={lang} />
								</Link>
							))}
						</div>
					</div>
				))}

				{/* Source */}
				{!loading && data.length > 0 && (
					<div className="rounded-lg border border-border bg-card p-3 text-[10px] text-muted-foreground">
						{t("source", lang)}: DOEB Fuel Now ({lang === "th" ? "กรมธุรกิจพลังงาน" : "Department of Energy Business"}) -- {totals.stations.toLocaleString()} {lang === "th" ? "สถานี" : "stations"}, 77 {lang === "th" ? "จังหวัด" : "provinces"}
					</div>
				)}
			</main>

			<SiteFooter text="Data from DOEB Fuel Now. Built during the 2026 Iran war energy crisis." textTh="ข้อมูลจาก DOEB Fuel Now สร้างในช่วงวิกฤตพลังงาน 2569" />
		</div>
	);
}
