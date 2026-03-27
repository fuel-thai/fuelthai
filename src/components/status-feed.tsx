import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import type { Lang } from "../lib/language-store";
import { getPosition } from "../lib/geolocation";
import { distanceKm } from "../lib/location-store";
import { DistanceBadge } from "./distance-badge";
import { getStatusConfig, statusLabel } from "../lib/diesel-status";
import { mapsDirectionsUrl, timeAgo } from "../lib/brand-styles";

interface FeedItem {
	station_id: string;
	fuel_code: string;
	old_status: string;
	new_status: string;
	recorded_at: string;
	source: string;
	station_name: string;
	brand_id: string;
	amphoe: string;
	amphoe_en: string;
	lat: number;
	lon: number;
	province_th: string;
	province_en: string;
	region: string;
}


export function StatusFeed({ lang, limit = 30 }: { lang: Lang; limit?: number }) {
	const [items, setItems] = useState<FeedItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [myLoc, setMyLoc] = useState<{ lat: number; lon: number } | null>(null);
	const [filterNearby, setFilterNearby] = useState(false);
	const [locating, setLocating] = useState(false);

	useEffect(() => {
		fetch(`/api/feed?limit=${limit}`)
			.then((r) => r.ok ? r.json() : null)
			.then((d) => { if (d?.changes) setItems(d.changes); })
			.catch(() => {})
			.finally(() => setLoading(false));
	}, [limit]);

	async function toggleNearby() {
		if (filterNearby) {
			setFilterNearby(false);
			return;
		}
		if (myLoc) {
			setFilterNearby(true);
			return;
		}
		setLocating(true);
		try {
			const pos = await getPosition();
			setMyLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude });
			setFilterNearby(true);
		} catch { /* silent */ }
		finally { setLocating(false); }
	}

	const filtered = filterNearby && myLoc
		? items.filter((item) => item.lat && item.lon && distanceKm(myLoc.lat, myLoc.lon, item.lat, item.lon) <= 50)
		: items;

	if (loading) {
		return (
			<div className="animate-pulse space-y-2">
				{Array.from({ length: 5 }).map((_, i) => (
					<div key={i} className="h-8 rounded bg-muted" />
				))}
			</div>
		);
	}

	if (items.length === 0) {
		return <p className="text-xs text-muted-foreground font-mono">{lang === "th" ? "ยังไม่มีการเปลี่ยนแปลง" : "No status changes recorded yet"}</p>;
	}

	return (
		<div className="space-y-1">
			<div className="mb-2">
				<button
					type="button"
					onClick={toggleNearby}
					disabled={locating}
					className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[10px] font-bold transition-colors ${
						filterNearby
							? "bg-primary/20 text-primary border border-primary/40"
							: "bg-muted text-muted-foreground hover:text-foreground"
					}`}
				>
					<MapPin className="h-3 w-3" />
					{locating ? "..." : filterNearby
						? (lang === "th" ? "ใกล้ฉัน (50km)" : "Near me (50km)")
						: (lang === "th" ? "กรองตามตำแหน่ง" : "Filter by my location")}
				</button>
				{filterNearby && filtered.length === 0 && (
					<p className="mt-1 text-[10px] text-muted-foreground font-mono">
						{lang === "th" ? "ไม่มีการเปลี่ยนแปลงใกล้คุณ" : "No recent changes near you"}
					</p>
				)}
			</div>
			{filtered.map((item, i) => {
				const oldLabel = statusLabel(item.old_status, lang);
				const newLabel = statusLabel(item.new_status, lang);
				const province = lang === "th" ? item.province_th : item.province_en;

				const mapsUrl = item.lat && item.lon
					? mapsDirectionsUrl(item.lat, item.lon)
					: null;
				const isGoodNews = item.new_status === "available" || item.new_status === "limited";

				return (
					<div key={`${item.station_id}-${item.recorded_at}-${i}`} className={`rounded-lg border px-3 py-2 ${isGoodNews ? "border-emerald-500/20 bg-emerald-500/5" : "border-border"}`}>
						<div className="flex items-start justify-between gap-2">
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-1.5 flex-wrap">
									<img src={`/brands/${(item.brand_id || "other").toLowerCase()}.svg`} alt="" className="h-4 w-4 shrink-0 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
									<Link to={`/station/${encodeURIComponent(item.station_id)}` as any} className="font-mono text-xs font-bold text-foreground truncate hover:text-primary hover:underline">
										{item.station_name}
									</Link>
								</div>
								<div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
									<span>{lang === "th" ? item.amphoe : item.amphoe_en}{(item.amphoe || item.amphoe_en) && province ? ", " : ""}{province}</span>
									{item.lat && item.lon && <DistanceBadge lat={item.lat} lon={item.lon} />}
								</div>
							</div>
							<span className="shrink-0 font-mono text-[10px] text-muted-foreground">{timeAgo(item.recorded_at, lang)}</span>
						</div>
						<div className="mt-1.5 flex items-center justify-between">
							<span className="flex items-center gap-1.5 font-mono text-xs">
								<span className={getStatusConfig(item.old_status).text}>{oldLabel}</span>
								<span className="text-muted-foreground">&rarr;</span>
								<span className={`font-bold ${getStatusConfig(item.new_status).text}`}>{newLabel}</span>
							</span>
							{mapsUrl && (
								<a href={mapsUrl} target="_blank" rel="noreferrer" className="rounded bg-primary/20 px-2 py-0.5 font-mono text-[10px] font-bold text-primary hover:bg-primary/30">
									{lang === "th" ? "นำทาง" : "DIRECTIONS"} &rarr;
								</a>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}
