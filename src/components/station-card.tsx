import { Link } from "@tanstack/react-router";
import type { Lang } from "../lib/language-store";
import { t } from "../lib/translations";
import { BrandBadge } from "./brand-badge";
import { getStatusConfig, FUEL_LABELS, FUEL_DOT_COLORS } from "../lib/diesel-status";

// ─── Types ───────────────────────────────────────────────────────

export interface StationCardData {
	name: string;
	id?: string;
	brand: string;
	distance: number;
	lat: number;
	lng: number;
	province: string;
	district: string;
	districtTh?: string;
	verified: boolean;
	diesel: {
		status: string;
		available: boolean;
		expected: boolean;
		restock: string | null;
	};
	fuelStatus: Record<string, string>;
	queue: { count: number | null; expires?: string | null };
	report: {
		age: number | null;
		ageText: string;
		confidence: number;
		confirms?: number;
		denies?: number;
		note: string | null;
		photo: string | null;
		expires?: string | null;
	};
	directions: string;
	source?: string;
	stationFuels?: string[];
}

export interface StationCardProps {
	station: StationCardData;
	lang: Lang;
	showConfidence?: boolean;
	showSourceBadge?: boolean;
	showExpiry?: boolean;
	variant?: "full" | "compact";
}

// ─── Helpers ─────────────────────────────────────────────────────

function reportAgeColor(age: number | null): string {
	if (age === null) return "text-muted-foreground";
	if (age < 60) return "text-emerald-400";
	if (age < 180) return "text-amber-400";
	return "text-red-400";
}

function confidenceColor(confidence: number): string {
	if (confidence >= 0.7) return "text-emerald-400";
	if (confidence >= 0.4) return "text-amber-400";
	return "text-red-400";
}

function expiryText(expires: string | null, lang: Lang): string | null {
	if (!expires) return null;
	const diff = new Date(expires).getTime() - Date.now();
	if (diff <= 0) return t("expired", lang);
	const mins = Math.round(diff / 60000);
	if (mins < 60) return `${t("expiresIn", lang)} ${mins}m`;
	const hours = Math.round(mins / 60);
	return `${t("expiresIn", lang)} ${hours}h`;
}

function FuelDots({ fuelStatus }: { fuelStatus: Record<string, string> }) {
	const entries = Object.entries(fuelStatus).filter(([code]) => code !== "D");
	if (entries.length === 0) return null;

	return (
		<div className="flex flex-wrap gap-1.5">
			{entries.map(([code, status]) => (
				<span
					key={code}
					className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
					title={`${FUEL_LABELS[code] || code}: ${status}`}
				>
					<span className={`inline-block h-1.5 w-1.5 rounded-full ${FUEL_DOT_COLORS[status] || FUEL_DOT_COLORS.unknown}`} />
					{FUEL_LABELS[code] || code}
				</span>
			))}
		</div>
	);
}

// ─── Component ───────────────────────────────────────────────────

export function StationCard({ station, lang, showConfidence = false, showSourceBadge = false, showExpiry = false, variant = "full" }: StationCardProps) {
	const cfg = getStatusConfig(station.diesel.status);
	const isStale = station.report.age !== null && station.report.age > 480;
	const isFull = variant === "full";

	const dieselLabel = station.diesel.status === "available" ? t("dieselAvailable", lang)
		: station.diesel.status === "limited" ? t("dieselLimited", lang)
		: station.diesel.status === "out" ? t("dieselOut", lang)
		: station.diesel.status === "pending_delivery" ? t("deliveryExpected", lang)
		: station.diesel.expected ? (lang === "th" ? "รอเติม" : "RESTOCK EXPECTED")
		: station.diesel.status === "unknown" ? ""
		: t("noData", lang);

	const dieselPulse = station.diesel.status === "limited" || station.diesel.status === "pending_delivery";
	const expiry = showExpiry ? expiryText(station.report.expires || null, lang) : null;

	const stationLink = station.id ? `/station/${encodeURIComponent(station.id)}` : null;

	return (
		<div
			className={`rounded-xl border ${isFull ? "p-5" : "p-4"} transition-all ${isStale ? "opacity-40 border-border bg-card" :
				station.diesel.available
					? "border-emerald-500/30 bg-emerald-500/5"
					: station.diesel.expected
						? "border-blue-500/30 bg-blue-500/5"
						: station.diesel.status === "limited"
							? "border-amber-500/30 bg-amber-500/5"
							: "border-border bg-card"
			}`}
		>
			{/* Header: name + brand + distance */}
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 flex-wrap">
						<h3 className="font-mono text-sm font-bold text-foreground truncate">
							{stationLink ? (
								<Link to={stationLink as any} className="hover:text-primary hover:underline">{station.name}</Link>
							) : station.name}
						</h3>
						<BrandBadge brandId={station.brand} />
						{station.verified && (
							<span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">
								VERIFIED
							</span>
						)}
					</div>
					{station.province && (
						<p className="mt-0.5 text-xs text-muted-foreground">
							{lang === "th" && station.districtTh ? station.districtTh : station.district}{(station.district || station.districtTh) && station.province ? ", " : ""}{station.province}
						</p>
					)}
				</div>
				<div className="shrink-0 text-right">
					<div className="font-mono text-2xl font-black tracking-tight text-foreground">
						{station.distance}
					</div>
					<div className="text-[10px] text-muted-foreground uppercase">km</div>
				</div>
			</div>

			{/* Diesel status pill + queue */}
			{dieselLabel && (
				<div className={`${isFull ? "mt-4" : "mt-3"} flex flex-wrap items-center gap-${isFull ? "3" : "2"}`}>
					<span
						className={`inline-block rounded-full border ${isFull ? "px-5 py-2.5 font-mono text-base" : "px-3 py-1 font-mono text-xs"} font-bold tracking-wider ${cfg.pill} ${!isStale && dieselPulse ? "animate-pulse" : ""}`}
					>
						{dieselLabel}
					</span>
					{isStale && (
						<span className={`rounded-full border border-amber-500/30 bg-amber-500/10 ${isFull ? "px-3 py-1" : "px-2 py-0.5"} font-mono text-[10px] font-bold text-amber-400`}>
							{lang === "th" ? "อาจไม่เป็นปัจจุบัน" : "POSSIBLY OUTDATED"}
						</span>
					)}
					{station.queue.count != null && station.queue.count > 0 && (
						isFull ? (
							<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 font-mono text-sm font-bold text-amber-400">
								<span className="text-base">&#128663;</span>
								{t("queueCount", lang, { count: station.queue.count })}
							</span>
						) : (
							<span className="font-mono text-[10px] text-amber-400">
								{t("queueCount", lang, { count: station.queue.count })}
							</span>
						)
					)}
					{station.diesel.restock && (
						<span className="text-sm text-blue-400">
							Restock: {station.diesel.restock}
						</span>
					)}
				</div>
			)}

			{/* Reporter note */}
			{station.report.note && (
				<div className={`${isFull ? "mt-3" : "mt-2"} rounded-lg border border-accent/30 bg-accent/5 ${isFull ? "px-4 py-3" : "px-3 py-2"}`}>
					{isFull ? (
						<div className="flex items-start gap-2">
							<span className="shrink-0 text-accent text-sm">&#9998;</span>
							<p className="text-sm text-accent leading-relaxed">{station.report.note}</p>
						</div>
					) : (
						<p className="text-xs text-accent leading-relaxed">{station.report.note}</p>
					)}
				</div>
			)}

			{/* Other fuel statuses */}
			{Object.keys(station.fuelStatus).length > 1 && (
				<div className={`${isFull ? "mt-3" : "mt-2"}`}>
					<FuelDots fuelStatus={station.fuelStatus} />
				</div>
			)}

			{/* Footer: report age, confidence, expiry, directions */}
			<div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
				{station.report.age !== null ? (
					<span className={`font-mono font-bold ${reportAgeColor(station.report.age)}`}>
						{station.report.ageText}
					</span>
				) : isFull ? (
					<span className="font-mono font-bold text-muted-foreground">{t("noReport", lang)}</span>
				) : null}

				{showSourceBadge && station.source && (
					<span className="font-mono text-[10px] text-muted-foreground/60">
						{station.source.includes("DOEB") ? "DOEB" : station.source.includes("PumpRadar") ? "PumpRadar" : ""}
					</span>
				)}

				{showConfidence && station.report.confidence > 0 && (
					<span className={`font-mono ${confidenceColor(station.report.confidence)}`}>
						{Math.round(station.report.confidence * 100)}% {t("confidence", lang)}
					</span>
				)}

				{showConfidence && (station.report.confirms ?? 0) + (station.report.denies ?? 0) > 0 && (
					<span className="text-muted-foreground">
						{(station.report.confirms ?? 0) > 0 && (
							<span className="text-emerald-400">+{station.report.confirms}</span>
						)}
						{(station.report.confirms ?? 0) > 0 && (station.report.denies ?? 0) > 0 && " / "}
						{(station.report.denies ?? 0) > 0 && (
							<span className="text-red-400">-{station.report.denies}</span>
						)}
					</span>
				)}

				{expiry && (
					<span className="font-mono text-muted-foreground">{expiry}</span>
				)}

				{station.report.photo && (
					<a
						href={station.report.photo}
						target="_blank"
						rel="noreferrer"
						className="text-primary hover:underline"
					>
						{t("photo", lang)}
					</a>
				)}

				<a
					href={station.directions}
					target="_blank"
					rel="noreferrer"
					className="ml-auto rounded bg-primary/20 px-3 py-1 font-mono font-bold text-primary hover:bg-primary/30 transition-colors"
				>
					{t("directions", lang)} &rarr;
				</a>
			</div>
		</div>
	);
}
