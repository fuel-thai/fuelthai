import districtNames from "./data/thai-districts.json";

export type Bindings = {
	ASSETS: Fetcher;
	CRON_SECRET?: string;
	VAPID_PUBLIC_KEY?: string;
	VAPID_PRIVATE_KEY?: string;
	VAPID_SUBJECT?: string;
	FRED_API_KEY?: string;
	BOT_EXCHANGE_KEY?: string;
	BOT_INTEREST_KEY?: string;
	BOT_STATS_KEY?: string;
	AISSTREAM_API_KEY?: string;
	DB: D1Database;
	R2: R2Bucket;
};

const districtLookup = districtNames as Record<string, string>;

export function districtEn(thName: string | null): string {
	if (!thName) return "";
	return districtLookup[thName] || thName;
}

export function safeLimit(raw: string | undefined, defaultVal: number, max: number): number {
	const n = Number(raw || defaultVal);
	if (!Number.isFinite(n) || n < 1) return defaultVal;
	return Math.min(Math.floor(n), max);
}

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function geohash(lat: number, lon: number, precision = 5): string {
	const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
	let minLat = -90, maxLat = 90, minLon = -180, maxLon = 180;
	let hash = "", bit = 0, ch = 0, isLon = true;
	while (hash.length < precision) {
		const mid = isLon ? (minLon + maxLon) / 2 : (minLat + maxLat) / 2;
		const val = isLon ? lon : lat;
		if (val >= mid) { ch |= (1 << (4 - bit)); isLon ? (minLon = mid) : (minLat = mid); }
		else { isLon ? (maxLon = mid) : (maxLat = mid); }
		if (++bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0; }
		isLon = !isLon;
	}
	return hash;
}

export function decodeGeohash(hash: string): { lat: number; lon: number } {
	const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
	let minLat = -90, maxLat = 90, minLon = -180, maxLon = 180;
	let isLon = true;
	for (const c of hash) {
		const idx = BASE32.indexOf(c);
		for (let bit = 4; bit >= 0; bit--) {
			const mid = isLon ? (minLon + maxLon) / 2 : (minLat + maxLat) / 2;
			if (idx & (1 << bit)) { isLon ? (minLon = mid) : (minLat = mid); }
			else { isLon ? (maxLon = mid) : (maxLat = mid); }
			isLon = !isLon;
		}
	}
	return { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2 };
}

export function geohashNeighbors(hash: string): string[] {
	const decoded = decodeGeohash(hash);
	const offsets: Record<number, number> = { 3: 1.5, 4: 0.4, 5: 0.05 };
	const d = offsets[hash.length] || 0.05;
	const neighbors: string[] = [hash];
	for (const latOff of [-d, 0, d]) {
		for (const lonOff of [-d, 0, d]) {
			if (latOff === 0 && lonOff === 0) continue;
			neighbors.push(geohash(decoded.lat + latOff, decoded.lon + lonOff, hash.length));
		}
	}
	return [...new Set(neighbors)];
}

export function stationHash(lat: number, lon: number, name: string): string {
	const input = `${lat.toFixed(5)}:${lon.toFixed(5)}:${name}`;
	let hash = 5381;
	for (let i = 0; i < input.length; i++) {
		hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
	}
	return hash.toString(36).padStart(7, "0");
}
