import { Hono } from "hono";
import { sendWebPush } from "../web-push";
import type { Bindings } from "../shared";
import { geohash, geohashNeighbors, stationHash, haversineKm, safeLimit } from "../shared";

const app = new Hono<{ Bindings: Bindings }>();

// ─── Cron Handler (exported for scheduled() in worker.ts) ────────

export async function handleCron(env: Bindings) {
	const now = new Date();
	const isoNow = now.toISOString();
	let logId: number | null = null;

	try {
		// Create log entry
		if (env.DB) {
			const logResult = await env.DB.prepare(
				"INSERT INTO cron_log (started_at, status) VALUES (?, 'running')",
			).bind(isoNow).run();
			logId = logResult.meta.last_row_id as number;
		}

		// 1. Fetch DOEB data
		const res = await fetch("https://fuel-now.doeb.go.th/pump.php?type=admin", {
			headers: { "User-Agent": "FUEL-TH/3.0 (fuel.lanta.dev)" },
		});
		if (!res.ok) {
			const errMsg = `DOEB fetch failed: HTTP ${res.status}`;
			if (env.DB && logId) {
				await env.DB.prepare("UPDATE cron_log SET finished_at = ?, status = 'error', error = ? WHERE id = ?")
					.bind(new Date().toISOString(), errMsg, logId).run();
			}
			return;
		}
		const data: any = await res.json();
		const stations: any[] = data.stations || [];

		// 2. Store snapshot to R2
		const dateKey = now.toISOString().slice(0, 10);
		const timeKey = now.toISOString().slice(11, 16).replace(":", "-");
		const r2Key = `doeb/${dateKey}/${timeKey}.json`;

		if (env.R2) {
			const body = JSON.stringify({ cached_at: data.cached_at, count: stations.length, stations });
			await env.R2.put(r2Key, body, {
				httpMetadata: { contentType: "application/json" },
				customMetadata: { stationCount: String(stations.length), cachedAt: data.cached_at || isoNow },
			});
		}

		if (!env.DB) return;

		// 3. Load province lookup (name_th -> id)
		const provRows = await env.DB.prepare("SELECT id, name_th FROM provinces").all<{ id: number; name_th: string }>();
		const provMap = new Map<string, number>();
		for (const row of provRows.results) {
			provMap.set(row.name_th, row.id);
		}

		// 4. Load previous diesel statuses (one bulk query instead of 24k individual SELECTs)
		const prevRows = await env.DB.prepare("SELECT id, last_diesel_status FROM stations").all<{ id: string; last_diesel_status: string }>();
		const prevMap = new Map<string, string>();
		for (const row of prevRows.results) {
			prevMap.set(row.id, row.last_diesel_status);
		}

		// 5. Process all stations -- diff in JS, ONLY write changes to D1
		const provinceStats: Record<number, { total: number; available: number; limited: number; out: number; pending: number; unknown: number }> = {};
		let changesCount = 0;
		let newStations = 0;
		const newStationStmts: D1PreparedStatement[] = [];
		const updateStmts: D1PreparedStatement[] = [];
		const changeStmts: D1PreparedStatement[] = [];
		const becameAvailable: { id: string; name: string; lat: number; lon: number; geohash5: string }[] = [];

		for (const s of stations) {
			const sLat = Number.parseFloat(s.lat || "0");
			const sLon = Number.parseFloat(s.lon || "0");
			if (!sLat || !sLon) continue;

			const id = stationHash(sLat, sLon, s.name || "");
			const dieselStatus = s.D || "unknown";
			const provinceName = s.province || "";
			const provinceId = provMap.get(provinceName) || null;
			const brandId = s.brand || "OTHER";
			const reportAt = s.lastReport || null;

			// Regional stats (by province_id)
			if (provinceId) {
				if (!provinceStats[provinceId]) {
					provinceStats[provinceId] = { total: 0, available: 0, limited: 0, out: 0, pending: 0, unknown: 0 };
				}
				const ps = provinceStats[provinceId];
				ps.total++;
				if (dieselStatus === "available") ps.available++;
				else if (dieselStatus === "limited") ps.limited++;
				else if (dieselStatus === "out") ps.out++;
				else if (dieselStatus === "pending_delivery") ps.pending++;
				else ps.unknown++;
			}

			const prevStatus = prevMap.get(id);

			const gh5 = geohash(sLat, sLon, 5);

			if (prevStatus === undefined) {
				// New station -- INSERT OR IGNORE (dupes in DOEB data)
				newStations++;
				newStationStmts.push(
					env.DB.prepare(
						"INSERT OR IGNORE INTO stations (id, name, brand_id, province_id, amphoe, lat, lon, geohash5, first_seen, last_seen, last_diesel_status, last_report_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
					).bind(id, s.name || "", brandId, provinceId, s.amphoe || "", sLat, sLon, gh5, isoNow, isoNow, dieselStatus, reportAt),
				);
			} else if (prevStatus !== dieselStatus && dieselStatus !== "unknown") {
				// Status changed -- UPDATE station + INSERT change (with dedup)
				updateStmts.push(
					env.DB.prepare(
						"UPDATE stations SET last_seen = ?, last_diesel_status = ?, last_report_at = ? WHERE id = ?",
					).bind(isoNow, dieselStatus, reportAt, id),
				);
				changeStmts.push(
					env.DB.prepare(
						`INSERT INTO status_changes (station_id, fuel_code, old_status, new_status, reported_at, recorded_at, source)
						SELECT ?, ?, ?, ?, ?, ?, ?
						WHERE NOT EXISTS (
							SELECT 1 FROM status_changes
							WHERE station_id = ? AND new_status = ? AND recorded_at > datetime(?, '-30 minutes')
						)`,
					).bind(id, "D", prevStatus, dieselStatus, reportAt, isoNow, "doeb", id, dieselStatus, isoNow),
				);
				changesCount++;
				if (dieselStatus === "available" || dieselStatus === "limited") {
					becameAvailable.push({ id, name: s.name || "", lat: sLat, lon: sLon, geohash5: gh5 });
				}
			}
			// If status is same -- skip entirely (no write needed)
		}

		// 6. Batch write ONLY the diffs to D1
		const allStmts = [...newStationStmts, ...updateStmts, ...changeStmts];
		const batchSize = 100;
		for (let i = 0; i < allStmts.length; i += batchSize) {
			await env.DB.batch(allStmts.slice(i, i + batchSize));
		}

		// 7. Write regional stats (by province_id)
		const regionStmts: D1PreparedStatement[] = [];
		for (const [pid, ps] of Object.entries(provinceStats)) {
			regionStmts.push(
				env.DB.prepare(
					"INSERT INTO regional_stats (province_id, recorded_at, total_stations, diesel_available, diesel_limited, diesel_out, diesel_pending, diesel_unknown) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
				).bind(Number(pid), isoNow, ps.total, ps.available, ps.limited, ps.out, ps.pending, ps.unknown),
			);
		}
		for (let i = 0; i < regionStmts.length; i += batchSize) {
			await env.DB.batch(regionStmts.slice(i, i + batchSize));
		}

		// 8. Send push notifications for STATION-specific subscribers
		if (changesCount > 0 && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
			try {
				// Query recent diesel-available changes from D1
				const recentChanges = await env.DB.prepare(
					"SELECT DISTINCT station_id, new_status FROM status_changes WHERE recorded_at = ? AND new_status IN ('available', 'limited')",
				).bind(isoNow).all();

				for (const change of recentChanges.results as any[]) {
					const subs = await env.DB.prepare(
						`SELECT id, endpoint, keys_p256dh, keys_auth, lang FROM station_subscriptions
						WHERE station_id = ?
						AND (last_notified_at IS NULL OR last_notified_at < datetime(?, '-60 minutes'))
						LIMIT 50`,
					).bind(change.station_id, isoNow).all();

					const stationInfo = await env.DB.prepare("SELECT name FROM stations WHERE id = ?").bind(change.station_id).first<{ name: string }>();

					for (const sub of subs.results as any[]) {
						try {
							await sendWebPush(
								{ endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
								JSON.stringify({
									title: sub.lang === "th" ? "มีดีเซลแล้ว!" : "Diesel Available!",
									body: `${stationInfo?.name || "Station"} -- ${change.new_status === "available" ? (sub.lang === "th" ? "มีดีเซล" : "has diesel") : (sub.lang === "th" ? "ดีเซลจำกัด" : "diesel limited")}`,
									url: `/station/${change.station_id}`,
									tag: `station-${change.station_id}`,
									renotify: true,
								}),
								env.VAPID_PUBLIC_KEY,
								env.VAPID_PRIVATE_KEY,
								env.VAPID_SUBJECT || "mailto:fuel@lanta.dev",
							);
							await env.DB.prepare("UPDATE station_subscriptions SET last_notified_at = ? WHERE id = ?")
								.bind(isoNow, sub.id).run();
						} catch {
							await env.DB.prepare("DELETE FROM station_subscriptions WHERE id = ?").bind(sub.id).run();
						}
					}
				}
			} catch { /* station push errors shouldn't break cron */ }
		}

		// 9. Send push notifications for stations that became available
		if (becameAvailable.length > 0 && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
			try {
				// Collect all geohash cells that need notification
				const notifyGeohashes = new Set<string>();
				for (const station of becameAvailable) {
					for (const gh of geohashNeighbors(station.geohash5)) {
						notifyGeohashes.add(gh);
					}
				}

				// Find subscribers in those cells (not notified in last hour)
				const ghPlaceholders = [...notifyGeohashes].map(() => "?").join(",");
				const subscribers = await env.DB.prepare(
					`SELECT id, endpoint, keys_p256dh, keys_auth, lat, lon, lang
					FROM push_subscriptions
					WHERE geohash5 IN (${ghPlaceholders})
					AND (last_notified_at IS NULL OR last_notified_at < datetime(?, '-60 minutes'))
					LIMIT 100`,
				).bind(...[...notifyGeohashes], isoNow).all();

				let notified = 0;
				for (const sub of subscribers.results as any[]) {
					const nearbyStations = becameAvailable.filter((s) =>
						haversineKm(sub.lat, sub.lon, s.lat, s.lon) <= 30,
					);
					if (nearbyStations.length === 0) continue;

					const title = sub.lang === "th" ? "มีดีเซลใกล้คุณ!" : "Diesel available near you!";
					const body = sub.lang === "th"
						? `${nearbyStations.length} สถานีมีดีเซล -- เช็คเลย`
						: `${nearbyStations.length} station${nearbyStations.length > 1 ? "s" : ""} with diesel -- check now`;
					const url = `https://www.fuelthai.com/availability?lat=${sub.lat}&lng=${sub.lon}&radius=30`;

					try {
						await sendWebPush(
							{ endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
							JSON.stringify({ title, body, url, tag: "diesel-alert", renotify: true }),
							env.VAPID_PUBLIC_KEY,
							env.VAPID_PRIVATE_KEY,
							env.VAPID_SUBJECT || "mailto:fuel@lanta.dev",
						);
						notified++;
						await env.DB.prepare("UPDATE push_subscriptions SET last_notified_at = ? WHERE id = ?")
							.bind(isoNow, sub.id).run();
					} catch {
						// Subscription may be expired -- remove it
						await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(sub.id).run();
					}
				}
			} catch { /* push errors shouldn't break the cron */ }
		}

		// 5. Update log entry + cleanup old data (keep 30 days)
		if (logId) {
			await env.DB.batch([
				env.DB.prepare(
					"UPDATE cron_log SET finished_at = ?, status = 'ok', stations_fetched = ?, new_stations = ?, status_changes = ?, provinces = ?, r2_key = ? WHERE id = ?",
				).bind(new Date().toISOString(), stations.length, newStations, changesCount, Object.keys(provinceStats).length, r2Key, logId),
				env.DB.prepare("DELETE FROM regional_stats WHERE recorded_at < datetime(?, '-30 days')").bind(isoNow),
				env.DB.prepare("DELETE FROM cron_log WHERE started_at < datetime(?, '-30 days')").bind(isoNow),
				env.DB.prepare("DELETE FROM status_changes WHERE recorded_at < datetime(?, '-90 days')").bind(isoNow),
			]);
		}
	} catch (err) {
		const errMsg = err instanceof Error ? err.message : "Unknown error";
		if (env.DB && logId) {
			await env.DB.prepare("UPDATE cron_log SET finished_at = ?, status = 'error', error = ? WHERE id = ?")
				.bind(new Date().toISOString(), errMsg, logId).run();
		}
	}
}

// ─── Admin endpoints (protected by CRON_SECRET) ─────────────────

function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	const encoder = new TextEncoder();
	const ab = encoder.encode(a);
	const bb = encoder.encode(b);
	let result = 0;
	for (let i = 0; i < ab.length; i++) {
		result |= ab[i] ^ bb[i];
	}
	return result === 0;
}

app.use("/api/cron/*", async (c, next) => {
	const secret = c.env.CRON_SECRET;
	if (!secret) return c.json({ error: "Auth not configured" }, 500);
	const provided = c.req.header("X-Cron-Key") || "";
	if (!constantTimeEqual(provided, secret)) return c.json({ error: "Unauthorized" }, 401);
	await next();
});

app.get("/api/cron/trigger", async (c) => {
	await handleCron(c.env);
	return c.json({ triggered: true, check: "/api/cron/log" });
});

app.get("/api/cron/log", async (c) => {

	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const limit = safeLimit(c.req.query("limit"), 20, 100);
	const logs = await db.prepare(
		"SELECT id, started_at, finished_at, status, stations_fetched, new_stations, status_changes, provinces, r2_key FROM cron_log ORDER BY id DESC LIMIT ?",
	).bind(limit).all();

	return c.json({ logs: logs.results, count: logs.results.length });
});

app.get("/api/cron/stats", async (c) => {

	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const [stations, changes, regions, cronLog, pushSubs] = await db.batch([
		db.prepare("SELECT COUNT(*) as count FROM stations"),
		db.prepare("SELECT COUNT(*) as count FROM status_changes"),
		db.prepare("SELECT COUNT(*) as count FROM regional_stats"),
		db.prepare("SELECT id, started_at, finished_at, status, stations_fetched, new_stations, status_changes, provinces FROM cron_log ORDER BY id DESC LIMIT 1"),
		db.prepare("SELECT COUNT(*) as count FROM push_subscriptions"),
	]);

	return c.json({
		db: {
			stations: (stations.results[0] as any)?.count || 0,
			statusChanges: (changes.results[0] as any)?.count || 0,
			regionalStats: (regions.results[0] as any)?.count || 0,
			pushSubscribers: (pushSubs.results[0] as any)?.count || 0,
		},
		lastCron: cronLog.results[0] || null,
	});
});

// Test push notification (admin only)
app.get("/api/cron/test-push", async (c) => {

	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);
	if (!c.env.VAPID_PUBLIC_KEY || !c.env.VAPID_PRIVATE_KEY) return c.json({ error: "VAPID keys not configured" }, 500);

	const subId = c.req.query("id");
	let sub: any;

	if (subId) {
		sub = await db.prepare("SELECT * FROM push_subscriptions WHERE id = ?").bind(Number(subId)).first();
	} else {
		sub = await db.prepare("SELECT * FROM push_subscriptions ORDER BY id DESC LIMIT 1").first();
	}

	if (!sub) return c.json({ error: "No subscribers found. Subscribe first at /availability" }, 404);

	try {
		await sendWebPush(
			{ endpoint: sub.endpoint, keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth } },
			JSON.stringify({
				title: "FUEL::TH Test",
				body: "Push notifications are working! Diesel alerts are active.",
				url: "/availability",
				tag: "test",
			}),
			c.env.VAPID_PUBLIC_KEY,
			c.env.VAPID_PRIVATE_KEY,
			c.env.VAPID_SUBJECT || "mailto:fuel@lanta.dev",
		);
		return c.json({ ok: true, sent_to: sub.id, endpoint: sub.endpoint.slice(0, 50) + "..." });
	} catch (err) {
		return c.json({ error: "Push failed", detail: err instanceof Error ? err.message : "Unknown" }, 500);
	}
});

// Backfill geohash for existing stations (one-time admin endpoint)
app.get("/api/cron/backfill-geohash", async (c) => {

	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const rows = await db.prepare("SELECT id, lat, lon FROM stations WHERE geohash5 IS NULL LIMIT 5000").all();
	const stmts: D1PreparedStatement[] = [];
	for (const row of rows.results as any[]) {
		const gh = geohash(row.lat, row.lon, 5);
		stmts.push(db.prepare("UPDATE stations SET geohash5 = ? WHERE id = ?").bind(gh, row.id));
	}
	for (let i = 0; i < stmts.length; i += 100) {
		await db.batch(stmts.slice(i, i + 100));
	}
	return c.json({ updated: stmts.length, remaining: (rows.results.length >= 5000 ? "more" : 0) });
});

export default app;
