import { useState } from "react";
import { useLanguage } from "../lib/language-store";
import { t } from "../lib/translations";
import { SiteHeader } from "../components/site-header";
import { PushSubscribe } from "../components/push-subscribe";
import { SiteFooter } from "../components/site-footer";
import { StationCard } from "../components/station-card";
import type { StationCardData } from "../components/station-card";
import { StationSearchForm } from "../components/station-search-form";
import type { SearchParams } from "../components/station-search-form";

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


const RADIUS_OPTIONS = [10, 20, 30] as const;
const LS_RADIUS = "fuel-th:radius-stations";

export default function StationsPage() {
	const { lang } = useLanguage();
	const [data, setData] = useState<StationsResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function handleSearch(params: SearchParams) {
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
	}

	const withDiesel = data?.stations.filter((s) => s.diesel.available || s.diesel.status === "limited") || [];
	const withoutDiesel = data?.stations.filter((s) => !s.diesel.available && s.diesel.status !== "limited") || [];

	return (
		<div className="min-h-screen bg-background">
			<SiteHeader page="STATIONS" pageTh="สถานี" subtitle={t("stationsSubtitle", lang)} />

			<main className="mx-auto max-w-4xl px-4 py-6">
				<StationSearchForm
					lang={lang}
					radiusOptions={RADIUS_OPTIONS}
					defaultRadius={20}
					localStorageRadiusKey={LS_RADIUS}
					accentColor="primary"
					searchLabel={t("findStations", lang)}
					searchLabelLoading={t("searching", lang)}
					onSearch={handleSearch}
					loading={loading}
				/>

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
						<p className="mt-4 font-mono text-sm">{t("findingStations", lang)}</p>
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
										<StationCard key={`${station.name}-${i}`} station={station as StationCardData} lang={lang} variant="compact" />
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
										<StationCard key={`${station.name}-${i}`} station={station as StationCardData} lang={lang} variant="compact" />
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

			<SiteFooter />
		</div>
	);
}
