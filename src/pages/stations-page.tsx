import { useState } from "react";
import { useLanguage } from "../lib/language-store";
import { t } from "../lib/translations";
import { SiteHeader } from "../components/site-header";
import { BrandBadge } from "../components/brand-badge";
import { getPosition } from "../lib/geolocation";
import { PushSubscribe } from "../components/push-subscribe";

interface Station {
	name: string;
	brand: string;
	distance: number;
	lat: number;
	lng: number;
	province: string;
	district: string;
	verified: boolean;
	diesel: { status: string; available: boolean; expected: boolean; restock: string | null };
	fuelStatus: Record<string, string>;
	queue: { count: number | null };
	report: { age: number | null; ageText: string; confidence: number; note: string | null; photo: string | null };
	directions: string;
}

interface StationsResponse {
	query: { lat: number; lng: number; radius: number; postal: string | null; location: string | null };
	count: number;
	stations: Station[];
}

const BRAND_STYLES: Record<string, { bg: string; text: string; label: string }> = {
	PTT: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "PTT" },
	SHELL: { bg: "bg-red-500/20", text: "text-red-400", label: "Shell" },
	BANGCHAK: { bg: "bg-green-500/20", text: "text-green-400", label: "Bangchak" },
	BCP: { bg: "bg-green-500/20", text: "text-green-400", label: "Bangchak" },
	PT: { bg: "bg-blue-500/20", text: "text-blue-400", label: "PT" },
	ESSO: { bg: "bg-blue-600/20", text: "text-blue-300", label: "Esso" },
	CALTEX: { bg: "bg-red-600/20", text: "text-red-300", label: "Caltex" },
	SUSCO: { bg: "bg-orange-500/20", text: "text-orange-400", label: "SUSCO" },
	OTHER: { bg: "bg-muted", text: "text-muted-foreground", label: "Other" },
};

const DIESEL_BADGE: Record<string, { bg: string; text: string }> = {
	available: { bg: "bg-emerald-500/20 border-emerald-500/40", text: "text-emerald-400" },
	limited: { bg: "bg-amber-500/20 border-amber-500/40", text: "text-amber-400" },
	out: { bg: "bg-red-500/20 border-red-500/40", text: "text-red-400" },
	pending_delivery: { bg: "bg-blue-500/20 border-blue-500/40", text: "text-blue-400" },
};

const FUEL_DOT_COLORS: Record<string, string> = {
	available: "bg-emerald-400",
	limited: "bg-amber-400",
	out: "bg-red-400",
	pending_delivery: "bg-blue-400",
};

const FUEL_LABELS: Record<string, string> = {
	D: "D", B20: "B20", G95: "G95", G91: "G91", E20: "E20", E85: "E85", LPG: "LPG", NGV: "NGV", EV: "EV",
};

function getBrand(brand: string) {
	return BRAND_STYLES[brand.toUpperCase()] || BRAND_STYLES.OTHER;
}

function StationCard({ station, lang }: { station: Station; lang: "en" | "th" }) {
	const brand = getBrand(station.brand);
	const dieselBadge = DIESEL_BADGE[station.diesel.status];
	const isStale = station.report.age !== null && station.report.age > 480;
	const fuelEntries = Object.entries(station.fuelStatus).filter(([code]) => code !== "D");

	return (
		<div
			className={`rounded-xl border p-4 transition-all ${isStale ? "opacity-40 border-border bg-card" :
				station.diesel.available ? "border-emerald-500/30 bg-emerald-500/5" :
				station.diesel.status === "limited" ? "border-amber-500/30 bg-amber-500/5" :
				station.diesel.expected ? "border-blue-500/30 bg-blue-500/5" :
				"border-border bg-card"
			}`}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2 flex-wrap">
						<h3 className="font-mono text-sm font-bold text-foreground truncate">{station.name}</h3>
						<BrandBadge brandId={station.brand} />
						{station.verified && (
							<span className="shrink-0 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400">VERIFIED</span>
						)}
					</div>
					{station.province && (
						<p className="mt-0.5 text-xs text-muted-foreground">
							{station.district}{station.district && station.province ? ", " : ""}{station.province}
						</p>
					)}
				</div>
				<div className="shrink-0 text-right">
					<div className="font-mono text-2xl font-black tracking-tight text-foreground">{station.distance}</div>
					<div className="text-[10px] text-muted-foreground uppercase">km</div>
				</div>
			</div>

			{/* Diesel status */}
			{dieselBadge && (
				<div className="mt-3 flex flex-wrap items-center gap-2">
					<span className={`inline-block rounded-full border px-3 py-1 font-mono text-xs font-bold ${dieselBadge.bg} ${dieselBadge.text}`}>
						{station.diesel.available ? (lang === "th" ? "มีดีเซล" : "HAS DIESEL") :
						 station.diesel.status === "limited" ? (lang === "th" ? "ดีเซลจำกัด" : "DIESEL LIMITED") :
						 station.diesel.status === "out" ? (lang === "th" ? "ดีเซลหมด" : "DIESEL OUT") :
						 station.diesel.expected ? (lang === "th" ? "รอเติม" : "RESTOCK EXPECTED") : ""}
					</span>
					{isStale && (
						<span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-400">
							{lang === "th" ? "อาจไม่เป็นปัจจุบัน" : "POSSIBLY OUTDATED"}
						</span>
					)}
					{station.queue.count != null && station.queue.count > 0 && (
						<span className="font-mono text-[10px] text-amber-400">
							{t("queueCount", lang, { count: station.queue.count })}
						</span>
					)}
				</div>
			)}

			{/* Reporter note */}
			{station.report.note && (
				<div className="mt-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2">
					<p className="text-xs text-accent leading-relaxed">{station.report.note}</p>
				</div>
			)}

			{/* Other fuels */}
			{fuelEntries.length > 0 && (
				<div className="mt-2 flex flex-wrap gap-1">
					{fuelEntries.map(([code, status]) => (
						<span key={code} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
							<span className={`inline-block h-1.5 w-1.5 rounded-full ${FUEL_DOT_COLORS[status] || "bg-gray-500"}`} />
							{FUEL_LABELS[code] || code}
						</span>
					))}
				</div>
			)}

			{/* Footer */}
			<div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
				{station.report.age !== null && (
					<span className={`font-mono font-bold ${station.report.age < 60 ? "text-emerald-400" : station.report.age < 180 ? "text-amber-400" : "text-red-400"}`}>
						{station.report.ageText}
					</span>
				)}
				{station.report.photo && (
					<a href={station.report.photo} target="_blank" rel="noreferrer" className="text-primary hover:underline">{t("photo", lang)}</a>
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

const LS_POSTAL = "fuel-th:postal";
const RADIUS_OPTIONS = [10, 20, 30] as const;
const LS_RADIUS = "fuel-th:radius-stations";

export default function StationsPage() {
	const { lang } = useLanguage();
	const [postal, setPostal] = useState(() => localStorage.getItem(LS_POSTAL) || "");
	const [radius, setRadius] = useState<number>(() => {
		const saved = localStorage.getItem(LS_RADIUS);
		const n = saved ? Number(saved) : 20;
		return RADIUS_OPTIONS.includes(n as (typeof RADIUS_OPTIONS)[number]) ? n : 20;
	});
	const [data, setData] = useState<StationsResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [searchMethod, setSearchMethod] = useState<"postal" | "gps" | null>(null);

	async function fetchStations(params: string) {
		setLoading(true);
		setError(null);
		try {
			const res = await fetch(`/api/availability?${params}&radius=${radius}`);
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
	}

	async function searchByPostal() {
		const trimmed = postal.trim();
		if (!/^\d{5}$/.test(trimmed)) {
			setError(t("invalidPostal", lang));
			return;
		}
		localStorage.setItem(LS_POSTAL, trimmed);
		localStorage.setItem(LS_RADIUS, String(radius));
		setSearchMethod("postal");
		await fetchStations(`postal=${trimmed}`);
	}

	async function searchByLocation() {
		setSearchMethod("gps");
		setLoading(true);
		setError(null);
		try {
			const pos = await getPosition();
			const { latitude, longitude } = pos.coords;
			await fetchStations(`lat=${latitude}&lng=${longitude}`);
		} catch (err: any) {
			const geoMessages: Record<number, string> = {
				1: t("geoDenied", lang),
				2: t("geoUnavailable", lang),
				3: t("geoTimeout", lang),
			};
			setError(err?.code ? geoMessages[err.code] || "Geolocation error" : err?.message || "Failed to get location");
			setData(null);
			setLoading(false);
		}
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") searchByPostal();
	}

	const withDiesel = data?.stations.filter((s) => s.diesel.available || s.diesel.status === "limited") || [];
	const withoutDiesel = data?.stations.filter((s) => !s.diesel.available && s.diesel.status !== "limited") || [];

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader page="STATIONS" pageTh="สถานี" subtitle={t("stationsSubtitle", lang)} />

			<main className="mx-auto max-w-4xl px-4 py-6">
				{/* Search controls */}
				<div className="rounded-xl border border-border bg-card p-4">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-end">
						<div className="flex-1">
							<label htmlFor="postal" className="mb-1 block font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
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
								className="w-full rounded-lg border border-border bg-background px-4 py-3 font-mono text-lg text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
												? "bg-primary/20 text-primary border border-primary/40"
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
							className="rounded-lg bg-primary px-6 py-3 font-mono text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading && searchMethod === "postal" ? t("searching", lang) : t("findStations", lang)}
						</button>
						<button
							type="button"
							onClick={searchByLocation}
							disabled={loading}
							className="rounded-lg border border-accent/50 bg-accent/10 px-6 py-3 font-mono text-sm font-bold text-accent transition-colors hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{loading && searchMethod === "gps" ? t("locating", lang) : t("useMyLocation", lang)}
						</button>
					</div>
				</div>

				{/* Notify button */}
				{data && data.query.lat && (
					<div className="mt-4">
						<PushSubscribe lat={data.query.lat} lng={data.query.lng} radius={20} lang={lang} />
					</div>
				)}

				{/* Loading */}
				{loading && (
					<div className="py-16 text-center text-muted-foreground">
						<div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
						<p className="mt-4 font-mono text-sm">
							{searchMethod === "gps" ? t("gettingLocation", lang) : t("findingStations", lang)}
						</p>
					</div>
				)}

				{/* Error */}
				{error && !loading && (
					<div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
				)}

				{/* Results */}
				{data && !loading && (
					<div className="mt-6">
						<div className="mb-4 flex items-center justify-between">
							<h2 className="font-mono text-sm font-bold text-muted-foreground uppercase tracking-wider">
								{data.count} {t("stationsFound", lang)}
								{data.query.location && <span className="ml-2 text-foreground">{data.query.location}</span>}
							</h2>
							<span className="text-xs text-muted-foreground">{data.query.radius}km {t("radiusLabel", lang)}</span>
						</div>

						{data.count === 0 && (
							<div className="rounded-lg border border-border bg-card p-8 text-center">
								<p className="font-mono text-sm text-muted-foreground">{t("noStationsFound", lang, { radius: data.query.radius })}</p>
								<p className="mt-2 text-xs text-muted-foreground">{t("tryDifferent", lang)}</p>
							</div>
						)}

						{withDiesel.length > 0 && (
							<>
								<div className="mb-3 flex items-center gap-2">
									<div className="h-px flex-1 bg-emerald-500/30" />
									<span className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-widest">
										{t("dieselAvailableLabel", lang)} ({withDiesel.length})
									</span>
									<div className="h-px flex-1 bg-emerald-500/30" />
								</div>
								<div className="grid gap-3">
									{withDiesel.map((station, i) => (
										<StationCard key={`${station.name}-${i}`} station={station} lang={lang} />
									))}
								</div>
							</>
						)}

						{withoutDiesel.length > 0 && (
							<>
								<div className="mb-3 mt-6 flex items-center gap-2">
									<div className="h-px flex-1 bg-border" />
									<span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
										{t("otherStations", lang)} ({withoutDiesel.length})
									</span>
									<div className="h-px flex-1 bg-border" />
								</div>
								<div className="grid gap-3">
									{withoutDiesel.map((station, i) => (
										<StationCard key={`${station.name}-${i}`} station={station} lang={lang} />
									))}
								</div>
							</>
						)}
					</div>
				)}

				{/* Empty state */}
				{!data && !loading && !error && (
					<div className="py-16 text-center">
						<div className="font-mono text-4xl text-muted-foreground/30">&#9981;</div>
						<p className="mt-4 font-mono text-sm text-muted-foreground">{t("enterPostalStations", lang)}</p>
						<p className="mt-2 text-xs text-muted-foreground">{t("pttNetwork", lang)}</p>
					</div>
				)}
			</main>

			<footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
				<p>{t("footerStations", lang)}</p>
				<a href="mailto:fuel@lanta.dev" className="mt-1 inline-block text-[10px] text-muted-foreground/60 hover:text-muted-foreground">fuel@lanta.dev</a>
			</footer>
		</div>
	);
}
