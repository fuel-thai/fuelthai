import { useState } from "react";
import type { Lang } from "../lib/language-store";
import { t } from "../lib/translations";
import { getPosition } from "../lib/geolocation";

export interface SearchParams {
	postal?: string;
	lat?: number;
	lng?: number;
	radius: number;
}

interface StationSearchFormProps {
	lang: Lang;
	radiusOptions: readonly number[];
	defaultRadius?: number;
	localStorageRadiusKey: string;
	accentColor?: "accent" | "primary";
	searchLabel: string;
	searchLabelLoading: string;
	onSearch: (params: SearchParams) => void | Promise<void>;
	loading?: boolean;
}

const LS_POSTAL = "fuel-th:postal";

export function StationSearchForm({
	lang,
	radiusOptions,
	defaultRadius,
	localStorageRadiusKey,
	accentColor = "accent",
	searchLabel,
	searchLabelLoading,
	onSearch,
	loading = false,
}: StationSearchFormProps) {
	const [postal, setPostal] = useState(() => localStorage.getItem(LS_POSTAL) || "");
	const [radius, setRadius] = useState<number>(() => {
		const saved = localStorage.getItem(localStorageRadiusKey);
		const n = saved ? Number(saved) : (defaultRadius || radiusOptions[1] || radiusOptions[0]);
		return (radiusOptions as readonly number[]).includes(n) ? n : (defaultRadius || radiusOptions[1] || radiusOptions[0]);
	});
	const [searchMethod, setSearchMethod] = useState<"postal" | "gps" | null>(null);
	const [error, setError] = useState<string | null>(null);

	const isPrimary = accentColor === "primary";

	async function searchByPostal() {
		const trimmed = postal.trim();
		if (!/^\d{5}$/.test(trimmed)) {
			setError(t("invalidPostal", lang));
			return;
		}
		setError(null);
		localStorage.setItem(LS_POSTAL, trimmed);
		localStorage.setItem(localStorageRadiusKey, String(radius));
		setSearchMethod("postal");
		await onSearch({ postal: trimmed, radius });
	}

	async function searchByLocation() {
		setSearchMethod("gps");
		setError(null);
		try {
			const pos = await getPosition();
			const { latitude, longitude } = pos.coords;
			localStorage.setItem(localStorageRadiusKey, String(radius));
			await onSearch({ lat: latitude, lng: longitude, radius });
		} catch (err: any) {
			const geoMessages: Record<number, string> = {
				1: t("geoDenied", lang),
				2: t("geoUnavailable", lang),
				3: t("geoTimeout", lang),
			};
			setError(err?.code ? geoMessages[err.code] || "Geolocation error" : err?.message || "Failed to get location");
		}
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Enter") searchByPostal();
	}

	return (
		<>
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
							className={`w-full rounded-lg border border-border bg-background px-4 py-3 font-mono text-lg text-foreground placeholder:text-muted-foreground/50 focus:border-${accentColor} focus:outline-none focus:ring-1 focus:ring-${accentColor}`}
						/>
					</div>

					<div>
						<label className="mb-1 block font-mono text-xs font-bold text-muted-foreground uppercase tracking-wider">
							{t("radius", lang)}
						</label>
						<div className="flex gap-1">
							{radiusOptions.map((r) => (
								<button
									key={r}
									type="button"
									onClick={() => { setRadius(r); localStorage.setItem(localStorageRadiusKey, String(r)); }}
									className={`rounded-lg px-3 py-3 font-mono text-sm font-bold transition-colors ${
										radius === r
											? isPrimary
												? "bg-primary/20 text-primary border border-primary/40"
												: "bg-accent/20 text-accent border border-accent/40"
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
						className={`rounded-lg ${isPrimary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-accent text-accent-foreground hover:bg-accent/90"} px-6 py-3 font-mono text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
					>
						{loading && searchMethod === "postal" ? searchLabelLoading : searchLabel}
					</button>

					<button
						type="button"
						onClick={searchByLocation}
						disabled={loading}
						className={`rounded-lg border ${isPrimary ? "border-accent/50 bg-accent/10 text-accent hover:bg-accent/20" : "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"} px-6 py-3 font-mono text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
					>
						{loading && searchMethod === "gps" ? t("locating", lang) : t("useMyLocation", lang)}
					</button>
				</div>
			</div>

			{error && !loading && (
				<div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
					{error}
				</div>
			)}
		</>
	);
}
