import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../lib/language-store";
import { t } from "../lib/translations";
import { SiteHeader } from "../components/site-header";
import { BrandBadge } from "../components/brand-badge";
import { ShareButtons } from "../components/share-buttons";
import { PushSubscribe } from "../components/push-subscribe";
import { getPosition } from "../lib/geolocation";

// ─── Types ───────────────────────────────────────────────────────

interface DieselInfo {
	status: "available" | "limited" | "out" | "pending_delivery" | "unknown";
	available: boolean;
	expected: boolean;
	restock: string | null;
}

interface StationReport {
	age: number | null;
	ageText: string;
	confidence: number;
	confirms: number;
	denies: number;
	note: string | null;
	photo: string | null;
	expires: string | null;
}

interface Station {
	name: string;
	brand: string;
	distance: number;
	lat: number;
	lng: number;
	province: string;
	district: string;
	districtTh: string;
	verified: boolean;
	diesel: DieselInfo;
	fuelStatus: Record<string, string>;
	stationFuels: string[];
	queue: {
		count: number | null;
		expires: string | null;
	};
	report: StationReport;
	directions: string;
	source: string;
}

interface AvailabilityResponse {
	query: { lat: number; lng: number; radius: number; postal: string | null; location: string | null };
	count: number;
	dieselAvailable: number;
	dieselExpected: number;
	dieselOut: number;
	stations: Station[];
	source: string;
	note: string;
	error?: string;
}

// ─── Constants ───────────────────────────────────────────────────

const RADIUS_OPTIONS = [5, 10, 20, 30] as const;
const POLL_INTERVAL = 5 * 60 * 1000;
const LS_POSTAL = "fuel-th:postal";
const LS_RADIUS = "fuel-th:radius";

const BRAND_STYLES: Record<string, { bg: string; text: string; label: string }> = {
	PTT: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "PTT" },
	SHELL: { bg: "bg-red-500/20", text: "text-red-400", label: "Shell" },
	BANGCHAK: { bg: "bg-green-500/20", text: "text-green-400", label: "Bangchak" },
	PT: { bg: "bg-blue-500/20", text: "text-blue-400", label: "PT" },
	ESSO: { bg: "bg-blue-600/20", text: "text-blue-300", label: "Esso" },
	CALTEX: { bg: "bg-red-600/20", text: "text-red-300", label: "Caltex" },
	SUSCO: { bg: "bg-orange-500/20", text: "text-orange-400", label: "SUSCO" },
	OTHER: { bg: "bg-muted", text: "text-muted-foreground", label: "Other" },
};

const FUEL_LABELS: Record<string, string> = {
	D: "D", B20: "B20", G95: "G95", G91: "G91", E20: "E20", E85: "E85", LPG: "LPG", NGV: "NGV", EV: "EV",
};

const FUEL_DOT_COLORS: Record<string, string> = {
	available: "bg-emerald-400",
	limited: "bg-amber-400",
	out: "bg-red-400",
	pending_delivery: "bg-blue-400",
	unknown: "bg-gray-500",
};

// ─── Helpers ─────────────────────────────────────────────────────

function reportAgeColor(age: number | null): string {
	if (age === null) return "text-muted-foreground";
	if (age < 60) return "text-emerald-400";
	if (age < 180) return "text-amber-400";
	return "text-red-400";
}

function getBrand(brand: string) {
	return BRAND_STYLES[brand.toUpperCase()] || BRAND_STYLES.OTHER;
}

function confidenceColor(confidence: number): string {
	if (confidence >= 0.7) return "text-emerald-400";
	if (confidence >= 0.4) return "text-amber-400";
	return "text-red-400";
}

function expiryText(expires: string | null, lang: "en" | "th"): string | null {
	if (!expires) return null;
	const diff = new Date(expires).getTime() - Date.now();
	if (diff <= 0) return t("expired", lang);
	const mins = Math.round(diff / 60000);
	if (mins < 60) return `${t("expiresIn", lang)} ${mins}m`;
	const hours = Math.round(mins / 60);
	return `${t("expiresIn", lang)} ${hours}h`;
}

function getDieselStatusConfig(lang: "en" | "th") {
	return {
		available: { pill: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40", label: t("dieselAvailable", lang), pulse: false },
		limited: { pill: "bg-amber-500/20 text-amber-400 border-amber-500/40", label: t("dieselLimited", lang), pulse: true },
		out: { pill: "bg-red-500/20 text-red-400 border-red-500/40", label: t("dieselOut", lang), pulse: false },
		pending_delivery: { pill: "bg-blue-500/20 text-blue-400 border-blue-500/40", label: t("deliveryExpected", lang), pulse: true },
		unknown: { pill: "bg-muted text-muted-foreground border-border", label: t("noData", lang), pulse: false },
	} as Record<string, { pill: string; label: string; pulse: boolean }>;
}

// ─── Components ──────────────────────────────────────────────────

function SkeletonCard() {
	return (
		<div className="animate-pulse rounded-xl border border-border bg-card p-5">
			<div className="flex items-start justify-between">
				<div className="space-y-2">
					<div className="h-4 w-48 rounded bg-muted" />
					<div className="h-3 w-24 rounded bg-muted" />
				</div>
				<div className="h-6 w-16 rounded bg-muted" />
			</div>
			<div className="mt-4 h-10 w-56 rounded-full bg-muted" />
			<div className="mt-3 flex gap-2">
				<div className="h-5 w-8 rounded bg-muted" />
				<div className="h-5 w-8 rounded bg-muted" />
				<div className="h-5 w-8 rounded bg-muted" />
			</div>
		</div>
	);
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

function StationCard({ station, lang }: { station: Station; lang: "en" | "th" }) {
	const brand = getBrand(station.brand);
	const dieselCfg = getDieselStatusConfig(lang)[station.diesel.status] || getDieselStatusConfig(lang).unknown;
	const expiry = expiryText(station.report.expires, lang);
	const isStale = station.report.age !== null && station.report.age > 480;

	return (
		<div
			className={`rounded-xl border p-5 transition-all ${isStale ? "opacity-40 border-border bg-card" :
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
							{station.name}
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
							{lang === "th" ? station.districtTh : station.district}{(station.district || station.districtTh) && station.province ? ", " : ""}{station.province}
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

			{/* BIG DIESEL STATUS PILL + QUEUE */}
			<div className="mt-4 flex flex-wrap items-center gap-3">
				<span
					className={`inline-block rounded-full border px-5 py-2.5 font-mono text-base font-black tracking-wider ${dieselCfg.pill} ${!isStale && dieselCfg.pulse ? "animate-pulse" : ""}`}
				>
					{dieselCfg.label}
				</span>
				{isStale && (
					<span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 font-mono text-[10px] font-bold text-amber-400">
						{lang === "th" ? "อาจไม่เป็นปัจจุบัน" : "POSSIBLY OUTDATED"}
					</span>
				)}
				{station.queue.count != null && station.queue.count > 0 && (
					<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 font-mono text-sm font-bold text-amber-400">
						<span className="text-base">&#128663;</span>
						{t("queueCount", lang, { count: station.queue.count })}
					</span>
				)}
				{station.diesel.restock && (
					<span className="text-sm text-blue-400">
						Restock: {station.diesel.restock}
					</span>
				)}
			</div>

			{/* Reporter note */}
			{station.report.note && (
				<div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
					<div className="flex items-start gap-2">
						<span className="shrink-0 text-accent text-sm">&#9998;</span>
						<p className="text-sm text-accent leading-relaxed">
							{station.report.note}
						</p>
					</div>
				</div>
			)}

			{/* Other fuel statuses */}
			{Object.keys(station.fuelStatus).length > 1 && (
				<div className="mt-3">
					<FuelDots fuelStatus={station.fuelStatus} />
				</div>
			)}

			{/* Footer: report age, confidence, expiry, directions */}
			<div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
				<span className={`font-mono font-bold ${reportAgeColor(station.report.age)}`}>
					{station.report.age !== null ? station.report.ageText : t("noReport", lang)}
				</span>

				{station.source && (
					<span className="font-mono text-[10px] text-muted-foreground/60">
						{station.source.includes("DOEB") ? "DOEB" : station.source.includes("PumpRadar") ? "PumpRadar" : ""}
					</span>
				)}

				{station.report.confidence > 0 && (
					<span className={`font-mono ${confidenceColor(station.report.confidence)}`}>
						{Math.round(station.report.confidence * 100)}% {t("confidence", lang)}
					</span>
				)}

				{(station.report.confirms > 0 || station.report.denies > 0) && (
					<span className="text-muted-foreground">
						{station.report.confirms > 0 && (
							<span className="text-emerald-400">+{station.report.confirms}</span>
						)}
						{station.report.confirms > 0 && station.report.denies > 0 && " / "}
						{station.report.denies > 0 && (
							<span className="text-red-400">-{station.report.denies}</span>
						)}
					</span>
				)}

				{expiry && (
					<span className="font-mono text-muted-foreground">
						{expiry}
					</span>
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

function SummaryBar({ data, lang }: { data: AvailabilityResponse; lang: "en" | "th" }) {
	const limited = data.stations.filter((s) => s.diesel.status === "limited").length;
	const unknown = data.count - data.dieselAvailable - limited - data.dieselOut - data.dieselExpected;

	return (
		<div className="rounded-xl border border-border bg-card p-4">
			<div className="flex items-center justify-between flex-wrap gap-2">
				{data.query.location && (
					<span className="font-mono text-sm font-bold text-foreground">
						{data.query.location}
					</span>
				)}
				<span className="text-xs text-muted-foreground">
					{data.count} {t("stationsWithin", lang)} {data.query.radius}km
				</span>
			</div>
			<div className="mt-3 flex flex-wrap gap-3">
				{data.dieselAvailable > 0 && (
					<span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-400">
						{data.dieselAvailable} {t("available", lang)}
					</span>
				)}
				{limited > 0 && (
					<span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold text-amber-400">
						{limited} {t("limited", lang)}
					</span>
				)}
				{data.dieselOut > 0 && (
					<span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-bold text-red-400">
						{data.dieselOut} {t("out", lang)}
					</span>
				)}
				{data.dieselExpected > 0 && (
					<span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-400">
						{data.dieselExpected} {t("expected", lang)}
					</span>
				)}
				{unknown > 0 && (
					<span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">
						{unknown} {t("unknown", lang)}
					</span>
				)}
			</div>
		</div>
	);
}

// ─── Main Page ───────────────────────────────────────────────────

export default function AvailabilityPage() {
	const { lang } = useLanguage();
	const [postal, setPostal] = useState(() => localStorage.getItem(LS_POSTAL) || "");
	const [radius, setRadius] = useState<number>(() => {
		const saved = localStorage.getItem(LS_RADIUS);
		const n = saved ? Number(saved) : 10;
		return RADIUS_OPTIONS.includes(n as (typeof RADIUS_OPTIONS)[number]) ? n : 10;
	});
	const [data, setData] = useState<AvailabilityResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [searchMethod, setSearchMethod] = useState<"postal" | "gps" | null>(null);
	const [countdown, setCountdown] = useState(300);
	const [lastSearch, setLastSearch] = useState<{ type: "postal" | "gps"; postal?: string; lat?: number; lng?: number; radius: number } | null>(null);
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const fetchData = useCallback(async (params: { postal?: string; lat?: number; lng?: number; radius: number }) => {
		setLoading(true);
		setError(null);
		try {
			const queryParts: string[] = [`radius=${params.radius}`];
			if (params.postal) queryParts.push(`postal=${params.postal}`);
			else if (params.lat != null && params.lng != null) queryParts.push(`lat=${params.lat}&lng=${params.lng}`);

			const res = await fetch(`/api/availability?${queryParts.join("&")}`);
			const json = await res.json();
			if (!res.ok) {
				setError(json.error || `API error: ${res.status}`);
				setData(null);
			} else {
				setData(json);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Network error");
		} finally {
			setLoading(false);
		}
	}, []);

	function startPolling(params: typeof lastSearch) {
		if (pollRef.current) clearInterval(pollRef.current);
		if (countdownRef.current) clearInterval(countdownRef.current);

		setCountdown(300);
		countdownRef.current = setInterval(() => {
			setCountdown((prev) => (prev <= 1 ? 300 : prev - 1));
		}, 1000);

		pollRef.current = setInterval(() => {
			if (params) fetchData(params);
			setCountdown(300);
		}, POLL_INTERVAL);
	}

	useEffect(() => {
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
			if (countdownRef.current) clearInterval(countdownRef.current);
		};
	}, []);

	async function searchByPostal() {
		const trimmed = postal.trim();
		if (!/^\d{5}$/.test(trimmed)) {
			setError(t("invalidPostal", lang));
			return;
		}
		localStorage.setItem(LS_POSTAL, trimmed);
		localStorage.setItem(LS_RADIUS, String(radius));
		setSearchMethod("postal");
		const params = { postal: trimmed, radius };
		setLastSearch({ type: "postal", ...params });
		await fetchData(params);
		startPolling({ type: "postal", ...params });
	}

	async function searchByLocation() {
		setSearchMethod("gps");
		setLoading(true);
		setError(null);
		try {
			const pos = await getPosition();
			const { latitude, longitude } = pos.coords;
			const params = { lat: latitude, lng: longitude, radius };
			setLastSearch({ type: "gps", ...params });
			await fetchData(params);
			startPolling({ type: "gps", ...params });
		} catch (err: any) {
			const geoMessages: Record<number, string> = {
				1: t("geoDenied", lang),
				2: t("geoUnavailable", lang),
				3: t("geoTimeout", lang),
			};
			setError(err?.code ? geoMessages[err.code] || "Geolocation error" : err?.message || "Failed to get location");
			setLoading(false);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") searchByPostal();
	}

	const closestExpected = data?.stations.find((s) => s.diesel.expected);
	const noDieselAnywhere = data && data.dieselAvailable === 0 && data.stations.filter((s) => s.diesel.status === "limited").length === 0;

	const countdownMin = Math.floor(countdown / 60);
	const countdownSec = countdown % 60;

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader page="DIESEL CHECK" pageTh="เช็คดีเซล" subtitle={t("availSubtitle", lang)} />

			<main className="mx-auto max-w-4xl px-4 py-6">
				{/* Search controls */}
				<div className="rounded-xl border border-border bg-card p-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
						<div className="flex-1">
							<label
								htmlFor="postal"
								className="mb-1 block font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider"
							>
								{t("postalCode", lang)}
							</label>
							<input
								id="postal"
								type="text"
								inputMode="numeric"
								pattern="[0-9]{5}"
								maxLength={5}
								placeholder="81150"
								value={postal}
								onChange={(e) => setPostal(e.target.value.replace(/\D/g, "").slice(0, 5))}
								onKeyDown={handleKeyDown}
								className="w-full rounded-lg border border-border bg-background px-4 py-3 font-mono text-lg text-foreground placeholder:text-muted-foreground/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
							/>
						</div>

						<div>
							<label className="mb-1 block font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
								{t("radius", lang)}
							</label>
							<div className="flex gap-1">
								{RADIUS_OPTIONS.map((r) => (
									<button
										key={r}
										type="button"
										onClick={() => { setRadius(r); localStorage.setItem(LS_RADIUS, String(r)); }}
										className={`rounded-lg px-3 py-3 font-mono text-sm font-bold transition-colors ${
											radius === r
												? "bg-accent/20 text-accent border border-accent/40"
												: "bg-muted text-muted-foreground border border-transparent hover:text-foreground"
										}`}
									>
										{r}km
									</button>
								))}
							</div>
						</div>

						<button
							type="button"
							onClick={searchByPostal}
							disabled={loading || postal.length !== 5}
							className="rounded-lg bg-accent px-6 py-3 font-mono text-sm font-black text-accent-foreground transition-colors hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading && searchMethod === "postal" ? t("checking", lang) : t("checkDiesel", lang)}
						</button>

						<button
							type="button"
							onClick={searchByLocation}
							disabled={loading}
							className="rounded-lg border border-primary/50 bg-primary/10 px-6 py-3 font-mono text-sm font-bold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading && searchMethod === "gps" ? t("locating", lang) : t("useMyLocation", lang)}
						</button>
					</div>
				</div>

				{/* Notify button -- top of results */}
				{data && data.query.lat && (
					<div className="mt-4">
						<PushSubscribe lat={data.query.lat} lng={data.query.lng} radius={radius} lang={lang} />
					</div>
				)}

				{/* Loading skeletons */}
				{loading && !data && (
					<div className="mt-6 space-y-4">
						<div className="h-20 animate-pulse rounded-xl border border-border bg-card" />
						<SkeletonCard />
						<SkeletonCard />
						<SkeletonCard />
					</div>
				)}

				{/* Error */}
				{error && !loading && (
					<div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
						{error}
					</div>
				)}

				{/* NO DIESEL warning */}
				{noDieselAnywhere && data && !loading && (
					<div className="mt-6 rounded-xl border-2 border-red-500/50 bg-red-500/10 p-6 text-center">
						<div className="font-mono text-2xl font-black text-red-400 tracking-wider">
							{t("noDieselAvailable", lang)}
						</div>
						<p className="mt-2 text-sm text-red-300">
							{t("noDieselWithin", lang, { radius: data.query.radius })}
						</p>
						{closestExpected && (
							<p className="mt-2 text-sm text-blue-400">
								{t("closestDelivery", lang)} <strong>{closestExpected.name}</strong>
								{closestExpected.diesel.restock && ` -- ${closestExpected.diesel.restock}`}
								{` (${closestExpected.distance}km)`}
							</p>
						)}
					</div>
				)}

				{/* Summary bar */}
				{data && !loading && !noDieselAnywhere && (
					<div className="mt-6">
						<SummaryBar data={data} lang={lang} />
					</div>
				)}

				{/* Station cards */}
				{data && !loading && data.count > 0 && (
					<div className="mt-4 space-y-3">
						{data.stations.map((station, i) => (
							<StationCard key={`${station.name}-${station.lat}-${i}`} station={station} lang={lang} />
						))}
					</div>
				)}

				{/* No results */}
				{data && !loading && data.count === 0 && !noDieselAnywhere && (
					<div className="mt-6 rounded-lg border border-border bg-card p-8 text-center">
						<p className="font-mono text-sm text-muted-foreground">
							{t("noStationsFound", lang, { radius: data.query.radius })}
						</p>
					</div>
				)}

				{/* Empty state */}
				{!data && !loading && !error && (
					<div className="py-16 text-center">
						<div className="font-mono text-6xl text-destructive/30">&#9981;</div>
						<p className="mt-4 font-mono text-lg font-bold text-foreground">
							{t("isDieselNearYou", lang)}
						</p>
						<p className="mt-2 text-sm text-muted-foreground">
							{t("enterPostal", lang)}
						</p>
						<p className="mt-1 text-xs text-muted-foreground">
							{t("crowdsourcedReports", lang)}
						</p>
					</div>
				)}

				{/* Source */}
				{data && (
					<div className="mt-6 space-y-3">
						<ShareButtons
							lang={lang}
							title={lang === "th" ? `ดีเซลใกล้ ${data.query.location || data.query.postal || "คุณ"}` : `Diesel near ${data.query.location || data.query.postal || "you"}`}
							text={lang === "th"
								? `${data.dieselAvailable} สถานีมีดีเซล จาก ${data.count} สถานี | FUEL::TH`
								: `${data.dieselAvailable} stations with diesel out of ${data.count} | FUEL::TH`
							}
						/>
						<div className="rounded-lg border border-border bg-card p-4">
							<div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
								<span>{t("source", lang)}: {data.source}</span>
								<span>fuel.lanta.dev</span>
							</div>
						</div>
					</div>
				)}
			</main>

			<footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
				<p>{t("footerAvail", lang)}</p>
				<a href="mailto:fuel@lanta.dev" className="mt-1 inline-block text-[10px] text-muted-foreground/60 hover:text-muted-foreground">fuel@lanta.dev</a>
			</footer>
		</div>
	);
}
