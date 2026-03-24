import { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useLanguage } from "../lib/language-store";
import { t } from "../lib/translations";
import { SiteHeader } from "../components/site-header";
import { BrandBadge } from "../components/brand-badge";
import { SkeletonCard } from "../components/skeleton";
import { DistanceBadge } from "../components/distance-badge";
import { ShareButtons } from "../components/share-buttons";
import { StationSubscribe } from "../components/station-subscribe";

interface StationDetail {
	id: string;
	name: string;
	brand_id: string;
	province_id: number;
	amphoe: string;
	lat: number;
	lon: number;
	first_seen: string;
	last_seen: string;
	last_diesel_status: string;
	last_report_at: string | null;
	province_th: string;
	province_en: string;
	region: string;
	brand_name_th: string;
	brand_name_en: string;
	brand_logo: string | null;
	brand_color: string;
}

interface StatusChange {
	fuel_code: string;
	old_status: string;
	new_status: string;
	reported_at: string | null;
	recorded_at: string;
	source: string;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label_en: string; label_th: string }> = {
	available: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30", label_en: "DIESEL AVAILABLE", label_th: "มีดีเซล" },
	limited: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30", label_en: "DIESEL LIMITED", label_th: "ดีเซลจำกัด" },
	out: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30", label_en: "DIESEL OUT", label_th: "ดีเซลหมด" },
	pending_delivery: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30", label_en: "DELIVERY EXPECTED", label_th: "รอเติม" },
	unknown: { bg: "bg-card", text: "text-muted-foreground", border: "border-border", label_en: "NO DATA", label_th: "ไม่มีข้อมูล" },
};

function timeAgo(iso: string): string {
	const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.round(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.round(hours / 24)}d ago`;
}

export default function StationPage() {
	const { lang } = useLanguage();
	const params = useParams({ strict: false }) as { id?: string };
	const id = params.id ? decodeURIComponent(params.id) : null;

	const [station, setStation] = useState<StationDetail | null>(null);
	const [changes, setChanges] = useState<StatusChange[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!id) return;
		setLoading(true);
		fetch(`/api/station/${encodeURIComponent(id)}`)
			.then((r) => {
				if (!r.ok) throw new Error(r.status === 404 ? "Station not found" : "Failed to load");
				return r.json();
			})
			.then((d) => {
				setStation(d.station);
				setChanges(d.changes || []);
			})
			.catch((err) => setError(err.message))
			.finally(() => setLoading(false));
	}, [id]);

	const cfg = STATUS_CONFIG[station?.last_diesel_status || "unknown"] || STATUS_CONFIG.unknown;
	const mapsUrl = station ? `https://www.google.com/maps/dir/?api=1&destination=${station.lat},${station.lon}&travelmode=driving` : null;
	const mapsEmbed = station ? `https://www.google.com/maps?q=${station.lat},${station.lon}&z=15&output=embed` : null;
	const province = station ? (lang === "th" ? station.province_th : station.province_en) : "";

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader page="STATION" pageTh="สถานี" />

			<main className="mx-auto max-w-4xl px-4 py-6 space-y-4">
				{loading && (
					<div className="space-y-4">
						<SkeletonCard />
						<SkeletonCard />
					</div>
				)}

				{error && !loading && (
					<div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
						<p className="font-mono text-sm text-destructive">{error}</p>
						<Link to="/availability" className="mt-3 inline-block font-mono text-xs text-primary hover:underline">
							&larr; {lang === "th" ? "กลับไปค้นหา" : "Back to search"}
						</Link>
					</div>
				)}

				{station && !loading && (
					<>
						{/* Station header */}
						<div className={`rounded-xl border-2 ${cfg.border} ${cfg.bg} p-5`}>
							<div className="flex items-start justify-between gap-3">
								<div>
									<div className="flex items-center gap-2 flex-wrap">
										{station.brand_logo && (
											<img src={station.brand_logo} alt="" className="h-8 w-8" />
										)}
										<h2 className="font-mono text-lg font-bold text-foreground">{station.name}</h2>
									</div>
									<div className="mt-1 flex items-center gap-2">
										<BrandBadge brandId={station.brand_id} />
										<DistanceBadge lat={station.lat} lon={station.lon} />
										{station.amphoe && (
											<span className="text-xs text-muted-foreground">{station.amphoe}, {province}</span>
										)}
									</div>
								</div>
							</div>

							{/* Big diesel status */}
							<div className="mt-4">
								<span className={`inline-block rounded-full border px-6 py-3 font-mono text-lg font-black tracking-wider ${cfg.border} ${cfg.text}`}>
									{lang === "th" ? cfg.label_th : cfg.label_en}
								</span>
							</div>

							{station.last_report_at && (
								<p className="mt-2 font-mono text-xs text-muted-foreground">
									{lang === "th" ? "รายงานล่าสุด" : "Last report"}: {timeAgo(station.last_report_at)}
									{" -- "}
									{new Date(station.last_report_at).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
								</p>
							)}
						</div>

						{/* Notify for THIS station */}
						<StationSubscribe stationId={station.id} stationName={station.name} lang={lang} />

						{/* Actions */}
						<div className="space-y-3">
							{mapsUrl && (
								<a
									href={mapsUrl}
									target="_blank"
									rel="noreferrer"
									className="block rounded-lg bg-primary px-4 py-3 text-center font-mono text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors"
								>
									{t("directions", lang)} &rarr;
								</a>
							)}
							<ShareButtons
								lang={lang}
								title={`${station.name} -- ${lang === "th" ? cfg.label_th : cfg.label_en}`}
								text={lang === "th"
									? `${station.name} (${station.brand_id}) -- ${cfg.label_th} | FUEL::TH`
									: `${station.name} (${station.brand_id}) -- ${cfg.label_en} | FUEL::TH`
								}
							/>
						</div>

						{/* Map embed */}
						{mapsEmbed && (
							<div className="rounded-xl border border-border overflow-hidden">
								<iframe
									src={mapsEmbed}
									width="100%"
									height="250"
									style={{ border: 0 }}
									loading="lazy"
									referrerPolicy="no-referrer-when-downgrade"
									title="Station location"
								/>
							</div>
						)}

						{/* Station info */}
						<div className="rounded-xl border border-border bg-card p-4">
							<h3 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
								{lang === "th" ? "ข้อมูลสถานี" : "STATION INFO"}
							</h3>
							<div className="grid grid-cols-2 gap-3 text-xs">
								<div>
									<span className="text-muted-foreground">{lang === "th" ? "แบรนด์" : "Brand"}</span>
									<p className="font-mono font-bold text-foreground">{lang === "th" ? station.brand_name_th : station.brand_name_en}</p>
								</div>
								<div>
									<span className="text-muted-foreground">{lang === "th" ? "จังหวัด" : "Province"}</span>
									<p className="font-mono font-bold text-foreground">{province}</p>
								</div>
								<div>
									<span className="text-muted-foreground">{lang === "th" ? "อำเภอ" : "District"}</span>
									<p className="font-mono font-bold text-foreground">{station.amphoe || "--"}</p>
								</div>
								<div>
									<span className="text-muted-foreground">{lang === "th" ? "ภูมิภาค" : "Region"}</span>
									<p className="font-mono font-bold text-foreground">{station.region}</p>
								</div>
								<div>
									<span className="text-muted-foreground">{lang === "th" ? "พิกัด" : "Coordinates"}</span>
									<p className="font-mono text-foreground">{station.lat.toFixed(5)}, {station.lon.toFixed(5)}</p>
								</div>
								<div>
									<span className="text-muted-foreground">{lang === "th" ? "แหล่งข้อมูล" : "Source"}</span>
									<p className="font-mono text-foreground">DOEB Fuel Now</p>
								</div>
							</div>
						</div>

						{/* Status history */}
						<div className="rounded-xl border border-border bg-card p-4">
							<h3 className="font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
								{lang === "th" ? "ประวัติสถานะดีเซล" : "DIESEL STATUS HISTORY"}
							</h3>
							{changes.length === 0 ? (
								<p className="text-xs text-muted-foreground font-mono">
									{lang === "th" ? "ยังไม่มีการเปลี่ยนแปลง" : "No status changes recorded yet"}
								</p>
							) : (
								<div className="space-y-1">
									{changes.map((c, i) => {
										const oldCfg = STATUS_CONFIG[c.old_status] || STATUS_CONFIG.unknown;
										const newCfg = STATUS_CONFIG[c.new_status] || STATUS_CONFIG.unknown;
										return (
											<div key={i} className="flex items-center gap-3 rounded px-2 py-1.5 text-xs hover:bg-muted/30">
												<span className="shrink-0 font-mono text-[10px] text-muted-foreground w-16">
													{timeAgo(c.recorded_at)}
												</span>
												<span className="flex items-center gap-1.5 font-mono">
													<span className={oldCfg.text}>{lang === "th" ? oldCfg.label_th : oldCfg.label_en}</span>
													<span className="text-muted-foreground">&rarr;</span>
													<span className={`font-bold ${newCfg.text}`}>{lang === "th" ? newCfg.label_th : newCfg.label_en}</span>
												</span>
												<span className="text-[9px] text-muted-foreground ml-auto">{c.source}</span>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{/* First/last seen */}
						<div className="text-[10px] text-muted-foreground font-mono text-center">
							{lang === "th" ? "พบครั้งแรก" : "First seen"}: {new Date(station.first_seen).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB")}
							{" -- "}
							{lang === "th" ? "อัปเดตล่าสุด" : "Last updated"}: {timeAgo(station.last_seen)}
						</div>
					</>
				)}
			</main>

			<footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
				<p>FUEL::TH -- {lang === "th" ? "ข้อมูลจาก DOEB Fuel Now" : "Data from DOEB Fuel Now"}</p>
				<a href="mailto:fuel@lanta.dev" className="mt-1 inline-block text-[10px] text-muted-foreground/60 hover:text-muted-foreground">fuel@lanta.dev</a>
			</footer>
		</div>
	);
}
