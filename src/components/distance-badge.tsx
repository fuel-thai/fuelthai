import { useLocation, distanceKm } from "../lib/location-store";

export function DistanceBadge({ lat, lon }: { lat: number; lon: number }) {
	const myLat = useLocation((s) => s.lat);
	const myLon = useLocation((s) => s.lon);

	if (myLat === null || myLon === null) return null;

	const km = distanceKm(myLat, myLon, lat, lon);
	return (
		<span className="font-mono text-[10px] text-muted-foreground" title="Distance from your location">
			{km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`}
		</span>
	);
}
