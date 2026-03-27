import { Hono } from "hono";
import { cache } from "hono/cache";
import type { Bindings } from "../shared";
import { haversineKm, geohash, geohashNeighbors, districtEn, safeLimit } from "../shared";

const app = new Hono<{ Bindings: Bindings }>();

interface PostalResult {
	zip: string;
	district_th: string;
	district_en: string;
	lat: number;
	lng: number;
	geohash5: string;
	province_en: string | null;
	province_th: string | null;
}

async function lookupPostal(db: D1Database, zip: string): Promise<PostalResult | null> {
	return db.prepare(
		`SELECT pc.*, p.name_en as province_en, p.name_th as province_th
		 FROM postal_codes pc LEFT JOIN provinces p ON pc.province_id = p.id
		 WHERE pc.zip = ?`
	).bind(zip).first<PostalResult>();
}

// ─── PTT Stations ────────────────────────────────────────────────

app.get("/api/stations", async (c) => {
	const postal = c.req.query("postal");
	const latQ = c.req.query("lat");
	const lngQ = c.req.query("lng");
	const radiusQ = c.req.query("radius");
	const radius = radiusQ ? Number.parseFloat(radiusQ) : 20;

	let lat: number;
	let lng: number;

	if (postal) {
		const entry = await lookupPostal(c.env.DB, postal);
		if (!entry) {
			return c.json({ error: `Unknown postal code: ${postal}. Thai postal codes are 5 digits (10000-96000).` }, 400);
		}
		lat = entry.lat;
		lng = entry.lng;
	} else if (latQ && lngQ) {
		lat = Number.parseFloat(latQ);
		lng = Number.parseFloat(lngQ);
		if (Number.isNaN(lat) || Number.isNaN(lng)) {
			return c.json({ error: "Invalid lat/lng values" }, 400);
		}
	} else {
		return c.json({ error: "Provide ?postal=XXXXX or ?lat=X&lng=Y" }, 400);
	}

	if (Number.isNaN(radius) || radius < 1 || radius > 200) {
		return c.json({ error: "Radius must be 1-200 km" }, 400);
	}

	try {
		const pttRes = await fetch("https://www.pttstation.com/mobilecontrol/list_station", {
			method: "POST",
			headers: {
				"Content-Type": "application/json; charset=utf-8",
				authen_key: "1234",
			},
			body: JSON.stringify({
				page: "1", limit: "30", station_type: "OIL", product_id: "", service_id: "",
				keyword: "", province: "", amphur: "", ngv_type: "",
				clat: String(lat), clng: String(lng), station_id: "",
				near_type: "1", bound_type: "", promotion_id: "",
				country_type_id: "1", language: "en",
			}),
		});

		if (!pttRes.ok) {
			return c.json({ error: "PTT Station API unavailable", status: pttRes.status }, 502);
		}

		const pttData: any = await pttRes.json();
		const rawStations: any[] = pttData?.data || [];

		const stations = rawStations
			.map((s: any) => {
				const sLat = Number.parseFloat(s.lat || "0");
				const sLng = Number.parseFloat(s.lng || "0");
				const distance = s.km ? Number.parseFloat(s.km) : haversineKm(lat, lng, sLat, sLng);
				const fuels: string[] = Array.isArray(s.product) ? s.product.map((p: any) => p.name || "Unknown") : [];
				const hasDiesel = fuels.some((f) => f.toLowerCase().includes("diesel"));
				const services: string[] = Array.isArray(s.service) ? s.service.map((svc: any) => svc.name || "").filter(Boolean) : [];

				return {
					name: s.name || "PTT Station",
					brand: "PTT",
					distance: Math.round(distance * 10) / 10,
					lat: sLat, lng: sLng,
					address: s.address || "",
					province: s.province_name || "",
					fuels, hasDiesel,
					phone: s.phone || null,
					openHours: s.open_hours || s.openHours || null,
					selfServe: s.self_serve === "1",
					services,
					link: s.link_share || null,
					source: "PTT Station API",
				};
			})
			.filter((s) => s.distance <= radius)
			.sort((a, b) => a.distance - b.distance);

		return c.json({
			query: { lat, lng, radius, postal: postal || null },
			count: stations.length,
			stations,
			source: "PTT Station API",
		});
	} catch (err) {
		return c.json({ error: "Failed to reach PTT Station API", message: err instanceof Error ? err.message : "Unknown error" }, 502);
	}
});

// ─── Availability (D1 geohash lookup + PumpRadar overlay) ───────

app.get(
	"/api/availability",
	cache({ cacheName: "availability-v4", cacheControl: "public, max-age=300, stale-if-error=1800" }),
	async (c) => {
		const postal = c.req.query("postal");
		const latQ = c.req.query("lat");
		const lngQ = c.req.query("lng");
		const radiusQ = c.req.query("radius");
		const radius = radiusQ ? Math.min(Number.parseFloat(radiusQ), 50) : 10;

		let lat: number;
		let lng: number;
		let locationName = "";

		if (postal) {
			const entry = await lookupPostal(c.env.DB, postal);
			if (!entry) return c.json({ error: `Unknown postal code: ${postal}` }, 400);
			lat = entry.lat;
			lng = entry.lng;
			locationName = `${entry.district_en}, ${entry.province_en || ""}`;
		} else if (latQ && lngQ) {
			lat = Number.parseFloat(latQ);
			lng = Number.parseFloat(lngQ);
		} else {
			return c.json({ error: "Provide ?postal=XXXXX or ?lat=X&lng=Y" }, 400);
		}

		try {
			// Geohash lookup: precision 4 (~39km cells) + neighbors for coverage
			const gh4 = geohash(lat, lng, 4);
			const searchHashes = geohashNeighbors(gh4);
			const conditions = searchHashes.map(() => "s.geohash5 LIKE ?").join(" OR ");
			const params = searchHashes.map((gh) => `${gh}%`);

			const result = await c.env.DB.prepare(
				`SELECT s.id, s.name, s.brand_id as brand, s.amphoe, s.lat, s.lon, s.last_diesel_status, s.last_report_at,
					p.name_en as province_en, p.name_th as province_th
				FROM stations s
				LEFT JOIN provinces p ON s.province_id = p.id
				WHERE ${conditions}`,
			).bind(...params).all();

			// Exact haversine filter (geohash is coarse, ~39km cells)
			const nearby = (result.results as any[])
				.map((s) => ({ ...s, _dist: haversineKm(lat, lng, s.lat, s.lon) }))
				.filter((s) => s._dist <= radius);

			// PumpRadar overlay for crowdsourced notes/photos/queue
			const prLookup = new Map<string, any>();
			try {
				const prRes = await fetch(
					`https://thaipumpradar.com/api/stations/nearby?lat=${lat}&lon=${lng}&radius=${Math.min(radius, 30)}`,
					{ headers: { "User-Agent": "FUEL-TH/2.0 (fuel.lanta.dev)" } },
				);
				if (prRes.ok) {
					for (const ps of ((await prRes.json()) as any)?.stations || []) {
						prLookup.set(`${(ps.lat || 0).toFixed(3)},${(ps.lon || 0).toFixed(3)}`, ps);
					}
				}
			} catch { /* PumpRadar down is not fatal */ }

			const STALE_THRESHOLD = 480;
			const stations = nearby.map((s) => {
				const pr = prLookup.get(`${s.lat.toFixed(3)},${s.lon.toFixed(3)}`);
				const prReport = pr?.latestReport || {};
				const doebTime = s.last_report_at ? new Date(s.last_report_at).getTime() : null;
				const reportTime = doebTime || prReport.createdAt || null;
				const reportAge = reportTime ? Math.round((Date.now() - reportTime) / 60000) : null;
				const isStale = reportAge !== null && reportAge > STALE_THRESHOLD;
				const raw = s.last_diesel_status || "unknown";
				const dieselStatus = isStale ? "unknown" : raw;

				return {
					id: s.id,
					name: s.name || "Unknown Station",
					brand: s.brand || "OTHER",
					distance: Math.round(s._dist * 10) / 10,
					lat: s.lat,
					lng: s.lon,
					province: s.province_en || s.province_th || "",
					district: districtEn(s.amphoe),
					districtTh: s.amphoe || "",
					verified: pr?.verified || false,
					diesel: { status: dieselStatus, available: dieselStatus === "available" || dieselStatus === "limited", expected: dieselStatus === "pending_delivery", restock: prReport.expectedRestock || null },
					fuelStatus: {} as Record<string, string>,
					queue: { count: isStale ? null : (prReport.queueCount || null), expires: null },
					report: {
						age: reportAge,
						ageText: reportAge !== null ? (reportAge < 60 ? `${reportAge}m ago` : `${Math.round(reportAge / 60)}h ago`) : "no report",
						stale: isStale,
						confidence: isStale ? 0 : (prReport.confidence || (doebTime ? 0.5 : 0)),
						confirms: isStale ? 0 : (prReport.confirmCount || 0),
						denies: isStale ? 0 : (prReport.denyCount || 0),
						note: isStale ? null : (prReport.note || null),
						photo: isStale ? null : (prReport.photoUrl || null),
						expires: null,
					},
					directions: `https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lon}&travelmode=driving`,
					source: doebTime ? "DOEB Fuel Now (official)" : pr ? "PumpRadar (crowdsourced)" : "DOEB directory",
				};
			});

			stations.sort((a, b) => {
				if (a.report.stale !== b.report.stale) return a.report.stale ? 1 : -1;
				const hasData = (s: typeof a) => s.diesel.status !== "unknown";
				if (hasData(a) !== hasData(b)) return hasData(a) ? -1 : 1;
				const order = (s: typeof a) => s.diesel.available ? 0 : s.diesel.expected ? 1 : s.diesel.status === "out" ? 3 : 2;
				const diff = order(a) - order(b);
				return diff !== 0 ? diff : a.distance - b.distance;
			});

			return c.json({
				query: { lat, lng, radius, postal: postal || null, location: locationName || null },
				count: stations.length,
				dieselAvailable: stations.filter((s) => s.diesel.available).length,
				dieselExpected: stations.filter((s) => s.diesel.expected).length,
				dieselOut: stations.filter((s) => s.diesel.status === "out").length,
				stations,
				source: "DOEB Fuel Now (D1 geohash) + PumpRadar (crowdsourced)",
			});
		} catch (err) {
			return c.json({ error: "Availability data temporarily unavailable" }, 502);
		}
	},
);

// ─── Station detail (from D1) ─────────────────────────────────────

app.get(
	"/api/station/:id",
	cache({ cacheName: "station-detail-v1", cacheControl: "public, max-age=300" }),
	async (c) => {
		const db = c.env.DB;
		if (!db) return c.json({ error: "Database not configured" }, 500);

		const id = c.req.param("id");
		const station = await db.prepare(`
			SELECT s.*, p.name_th as province_th, p.name_en as province_en, p.region,
				b.name_th as brand_name_th, b.name_en as brand_name_en, b.logo as brand_logo, b.color as brand_color
			FROM stations s
			LEFT JOIN provinces p ON s.province_id = p.id
			LEFT JOIN brands b ON s.brand_id = b.id
			WHERE s.id = ?
		`).bind(id).first();

		if (!station) return c.json({ error: "Station not found" }, 404);

		const stationData = { ...(station as any), amphoe_en: districtEn((station as any).amphoe) };

		const changes = await db.prepare(`
			SELECT fuel_code, old_status, new_status, reported_at, recorded_at, source
			FROM status_changes
			WHERE station_id = ?
			ORDER BY recorded_at DESC
			LIMIT 50
		`).bind(id).all();

		return c.json({ station: stationData, changes: changes.results });
	},
);

// ─── Province stations (from D1) ─────────────────────────────────

app.get(
	"/api/stations/province/:id",
	cache({ cacheName: "province-stations-v1", cacheControl: "public, max-age=300" }),
	async (c) => {
		const db = c.env.DB;
		if (!db) return c.json({ error: "Database not configured" }, 500);

		const id = Number(c.req.param("id"));
		const includeUnknown = c.req.query("unknown") !== "false";

		const province = await db.prepare("SELECT * FROM provinces WHERE id = ?").bind(id).first();
		if (!province) return c.json({ error: "Province not found" }, 404);

		let query = `
			SELECT s.id, s.name, s.brand_id, s.amphoe, s.lat, s.lon, s.last_diesel_status, s.last_report_at,
				b.name_en as brand_name, b.color as brand_color
			FROM stations s
			LEFT JOIN brands b ON s.brand_id = b.id
			WHERE s.province_id = ?
		`;
		if (!includeUnknown) {
			query += ` AND s.last_diesel_status != 'unknown'`;
		}
		query += ` ORDER BY CASE s.last_diesel_status
			WHEN 'available' THEN 0 WHEN 'limited' THEN 1 WHEN 'pending_delivery' THEN 2 WHEN 'out' THEN 3 ELSE 4 END, s.name`;

		const stations = await db.prepare(query).bind(id).all();

		const summary = {
			available: 0, limited: 0, out: 0, pending: 0, unknown: 0, total: stations.results.length,
		};
		for (const s of stations.results as any[]) {
			const st = s.last_diesel_status || "unknown";
			if (st === "available") summary.available++;
			else if (st === "limited") summary.limited++;
			else if (st === "out") summary.out++;
			else if (st === "pending_delivery") summary.pending++;
			else summary.unknown++;
		}

		const translatedStations = (stations.results as any[]).map((s) => ({ ...s, amphoe_en: districtEn(s.amphoe) }));
		return c.json({ province, stations: translatedStations, summary });
	},
);

export default app;
