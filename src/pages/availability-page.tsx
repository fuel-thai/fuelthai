import { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../lib/language-store";
import { t } from "../lib/translations";
import { SiteHeader } from "../components/site-header";
import { ShareButtons } from "../components/share-buttons";
import { PushSubscribe } from "../components/push-subscribe";
import { SiteFooter } from "../components/site-footer";
import { StationCard } from "../components/station-card";
import type { StationCardData } from "../components/station-card";
import { StationSearchForm } from "../components/station-search-form";
import type { SearchParams } from "../components/station-search-form";

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
const LS_RADIUS = "fuel-th:radius";


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
	const [data, setData] = useState<AvailabilityResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [lastRadius, setLastRadius] = useState(10);
	const [countdown, setCountdown] = useState(300);
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

	function startPolling(params: SearchParams) {
		if (pollRef.current) clearInterval(pollRef.current);
		if (countdownRef.current) clearInterval(countdownRef.current);

		setCountdown(300);
		countdownRef.current = setInterval(() => {
			setCountdown((prev) => (prev <= 1 ? 300 : prev - 1));
		}, 1000);

		pollRef.current = setInterval(() => {
			fetchData(params);
			setCountdown(300);
		}, POLL_INTERVAL);
	}

	useEffect(() => {
		return () => {
			if (pollRef.current) clearInterval(pollRef.current);
			if (countdownRef.current) clearInterval(countdownRef.current);
		};
	}, []);

	async function handleSearch(params: SearchParams) {
		setLastRadius(params.radius);
		await fetchData(params);
		startPolling(params);
	}

	const closestExpected = data?.stations.find((s) => s.diesel.expected);
	const noDieselAnywhere = data && data.dieselAvailable === 0 && data.stations.filter((s) => s.diesel.status === "limited").length === 0;

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader page="DIESEL CHECK" pageTh="เช็คดีเซล" subtitle={t("availSubtitle", lang)} />

			<main className="mx-auto max-w-4xl px-4 py-6">
				<StationSearchForm
					lang={lang}
					radiusOptions={RADIUS_OPTIONS}
					defaultRadius={10}
					localStorageRadiusKey={LS_RADIUS}
					accentColor="accent"
					searchLabel={t("checkDiesel", lang)}
					searchLabelLoading={t("checking", lang)}
					onSearch={handleSearch}
					loading={loading}
				/>

				{/* Notify button -- top of results */}
				{data && data.query.lat && (
					<div className="mt-4">
						<PushSubscribe lat={data.query.lat} lng={data.query.lng} radius={lastRadius} lang={lang} />
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
							<StationCard key={`${station.name}-${station.lat}-${i}`} station={station as StationCardData} lang={lang} showConfidence showSourceBadge showExpiry variant="full" />
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

			<SiteFooter />
		</div>
	);
}
