import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useLanguage } from "../lib/language-store";
import { t } from "../lib/translations";
import { SiteHeader } from "../components/site-header";
import { SiteFooter } from "../components/site-footer";
import { SkeletonCard } from "../components/skeleton";
import { BrandBadge } from "../components/brand-badge";
import { getStatusConfig, statusLabel } from "../lib/diesel-status";
import { mapsDirectionsUrl } from "../lib/brand-styles";

interface Province {
	id: number;
	name_th: string;
	name_en: string;
	region: string;
}

interface Station {
	id: string;
	name: string;
	brand_id: string;
	amphoe: string;
	amphoe_en: string;
	lat: number;
	lon: number;
	last_diesel_status: string;
	last_report_at: string | null;
	brand_name: string;
	brand_color: string;
}

interface Summary {
	available: number;
	limited: number;
	out: number;
	pending: number;
	unknown: number;
	total: number;
}


export default function ProvincePage() {
	const { lang } = useLanguage();
	const params = useParams({ strict: false }) as { id?: string };
	const id = params.id;

	const [province, setProvince] = useState<Province | null>(null);
	const [stations, setStations] = useState<Station[]>([]);
	const [summary, setSummary] = useState<Summary | null>(null);
	const [loading, setLoading] = useState(true);
	const [showUnknown, setShowUnknown] = useState(false);

	useEffect(() => {
		if (!id) return;
		setLoading(true);
		fetch(`/api/stations/province/${id}?unknown=${showUnknown}`)
			.then((r) => r.ok ? r.json() : null)
			.then((d) => {
				if (d) {
					setProvince(d.province);
					setStations(d.stations);
					setSummary(d.summary);
				}
			})
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [id, showUnknown]);

	const provinceName = province ? (lang === "th" ? province.name_th : province.name_en) : "";

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader page={province?.name_en || "PROVINCE"} pageTh={province?.name_th} />

			<main className="mx-auto max-w-4xl px-4 py-6 space-y-4">
				{loading && (
					<div className="space-y-3">
						<SkeletonCard />
						<SkeletonCard />
						<SkeletonCard />
					</div>
				)}

				{/* Summary */}
				{!loading && summary && (
					<div className="rounded-xl border border-border bg-card p-4">
						<div className="flex items-center justify-between mb-3">
							<h2 className="font-mono text-sm font-bold text-foreground">
								{provinceName} -- {summary.total} {lang === "th" ? "สถานี" : "stations"}
							</h2>
						</div>
						<div className="flex flex-wrap gap-3 text-xs font-mono">
							{summary.available > 0 && <span className="text-emerald-400">{summary.available} {lang === "th" ? "มี" : "avail"}</span>}
							{summary.limited > 0 && <span className="text-amber-400">{summary.limited} {lang === "th" ? "จำกัด" : "ltd"}</span>}
							{summary.pending > 0 && <span className="text-blue-400">{summary.pending} {lang === "th" ? "รอ" : "pend"}</span>}
							{summary.out > 0 && <span className="text-red-400">{summary.out} {lang === "th" ? "หมด" : "out"}</span>}
							<span className="text-muted-foreground">{summary.unknown} {lang === "th" ? "ไม่ทราบ" : "unknown"}</span>
						</div>

						{/* Toggle unknown */}
						<label className="mt-3 flex items-center gap-2 cursor-pointer">
							<input
								type="checkbox"
								checked={showUnknown}
								onChange={(e) => setShowUnknown(e.target.checked)}
								className="rounded border-border"
							/>
							<span className="font-mono text-xs text-muted-foreground">
								{lang === "th" ? "แสดงสถานีที่ไม่มีข้อมูล" : "Show stations with no data"}
							</span>
						</label>
					</div>
				)}

				{/* Station list */}
				{!loading && stations.map((s) => {
					const cfg = getStatusConfig(s.last_diesel_status);
					const isUnknown = s.last_diesel_status === "unknown";
					const mapsUrl = mapsDirectionsUrl(s.lat, s.lon);

					return (
						<div key={s.id} className={`rounded-lg border p-3 ${isUnknown ? "opacity-40 border-border bg-card" : `${cfg.border} ${cfg.bg}`}`}>
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2 flex-wrap">
										<Link to={`/station/${encodeURIComponent(s.id)}` as any} className="font-mono text-sm font-bold text-foreground truncate hover:text-primary hover:underline">{s.name}</Link>
										<BrandBadge brandId={s.brand_id} />
									</div>
									{(s.amphoe || s.amphoe_en) && <p className="text-[10px] text-muted-foreground mt-0.5">{lang === "th" ? s.amphoe : (s.amphoe_en || s.amphoe)}</p>}
								</div>
								<span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold ${cfg.text}`}>
									{statusLabel(s.last_diesel_status, lang)}
								</span>
							</div>
							<div className="mt-2 flex items-center gap-3 text-xs">
								{s.last_report_at && (
									<span className="font-mono text-[10px] text-muted-foreground">
										{new Date(s.last_report_at).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
									</span>
								)}
								<a href={mapsUrl} target="_blank" rel="noreferrer" className="ml-auto rounded bg-primary/20 px-2 py-0.5 font-mono text-[10px] font-bold text-primary hover:bg-primary/30">
									{t("directions", lang)} &rarr;
								</a>
							</div>
						</div>
					);
				})}

				{!loading && stations.length === 0 && (
					<div className="rounded-lg border border-border bg-card p-8 text-center">
						<p className="font-mono text-sm text-muted-foreground">
							{showUnknown
								? (lang === "th" ? "ไม่พบสถานีในจังหวัดนี้" : "No stations found in this province")
								: (lang === "th" ? "ไม่มีสถานีที่มีข้อมูล -- ลองเปิด \"แสดงสถานีที่ไม่มีข้อมูล\"" : "No stations with data -- try enabling \"Show stations with no data\"")
							}
						</p>
					</div>
				)}
			</main>

			<SiteFooter text="Data from DOEB Fuel Now" textTh="ข้อมูลจาก DOEB Fuel Now" />
		</div>
	);
}
