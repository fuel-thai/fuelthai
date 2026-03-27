import { Hono } from "hono";
import { cache } from "hono/cache";
import type { Bindings } from "../shared";
import { safeLimit } from "../shared";

const app = new Hono<{ Bindings: Bindings }>();

// ─── History API ─────────────────────────────────────────────────

app.get("/api/history/station/:id", cache({ cacheName: "history-station-v1", cacheControl: "public, max-age=300" }), async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const id = c.req.param("id");
	const limit = safeLimit(c.req.query("limit"), 100, 500);

	const station = await db.prepare("SELECT * FROM stations WHERE id = ?").bind(id).first();
	if (!station) return c.json({ error: "Station not found" }, 404);

	const changes = await db.prepare(
		"SELECT fuel_code, old_status, new_status, reported_at, recorded_at, source FROM status_changes WHERE station_id = ? ORDER BY recorded_at DESC LIMIT ?",
	).bind(id, limit).all();

	return c.json({ station, changes: changes.results, count: changes.results.length });
});

app.get("/api/history/province/:id", cache({ cacheName: "history-province-v1", cacheControl: "public, max-age=300" }), async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const id = Number(c.req.param("id"));
	const limit = safeLimit(c.req.query("limit"), 96, 500);

	const province = await db.prepare("SELECT * FROM provinces WHERE id = ?").bind(id).first();
	if (!province) return c.json({ error: "Province not found" }, 404);

	const stats = await db.prepare(
		"SELECT * FROM regional_stats WHERE province_id = ? ORDER BY recorded_at DESC LIMIT ?",
	).bind(id, limit).all();

	return c.json({ province, stats: stats.results, count: stats.results.length });
});

app.get("/api/history/summary", cache({ cacheName: "history-summary-v1", cacheControl: "public, max-age=300" }), async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const limit = safeLimit(c.req.query("limit"), 96, 500);

	const stats = await db.prepare(`
		SELECT recorded_at,
			SUM(total_stations) as total_stations,
			SUM(diesel_available) as diesel_available,
			SUM(diesel_limited) as diesel_limited,
			SUM(diesel_out) as diesel_out,
			SUM(diesel_pending) as diesel_pending,
			SUM(diesel_unknown) as diesel_unknown
		FROM regional_stats
		GROUP BY recorded_at
		ORDER BY recorded_at DESC
		LIMIT ?
	`).bind(limit).all();

	return c.json({ stats: stats.results, count: stats.results.length });
});

app.get("/api/history/provinces", cache({ cacheName: "history-provinces-v1", cacheControl: "public, max-age=300" }), async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const latest = await db.prepare(`
		SELECT r.province_id, p.name_th, p.name_en, p.region,
			r.total_stations, r.diesel_available, r.diesel_limited, r.diesel_out, r.diesel_pending, r.diesel_unknown, r.recorded_at
		FROM regional_stats r
		JOIN provinces p ON r.province_id = p.id
		WHERE r.recorded_at = (SELECT MAX(recorded_at) FROM regional_stats)
		ORDER BY r.diesel_available DESC
	`).all();

	return c.json({ provinces: latest.results, count: latest.results.length });
});

app.get("/api/provinces", cache({ cacheName: "provinces-ref-v1", cacheControl: "public, max-age=86400" }), async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const provinces = await db.prepare("SELECT * FROM provinces ORDER BY id").all();
	return c.json({ provinces: provinces.results, count: provinces.results.length });
});

app.get("/api/brands", cache({ cacheName: "brands-ref-v1", cacheControl: "public, max-age=86400" }), async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);
	const brands = await db.prepare("SELECT * FROM brands ORDER BY id").all();
	return c.json({ brands: brands.results, count: brands.results.length });
});

// ─── Price History (tracked metrics over time) ──────────────────

app.get("/api/history/prices",
	cache({ cacheName: "price-history-v1", cacheControl: "public, max-age=3600" }),
	async (c) => {
		const db = c.env.DB;
		if (!db) return c.json({ error: "Database not configured" }, 500);

		const metric = c.req.query("metric");
		const days = safeLimit(c.req.query("days"), 90, 365);

		let query = "SELECT date, source, metric, value, unit FROM price_history";
		const params: (string | number)[] = [];

		if (metric) {
			query += " WHERE metric = ? AND date >= date('now', '-' || ? || ' days') ORDER BY date";
			params.push(metric, days);
		} else {
			query += " WHERE date >= date('now', '-' || ? || ' days') ORDER BY metric, date";
			params.push(days);
		}

		const result = await db.prepare(query).bind(...params).all();
		return c.json({ data: result.results, count: result.results.length });
	},
);

app.get("/api/history/prices/latest",
	cache({ cacheName: "price-latest-v1", cacheControl: "public, max-age=1800" }),
	async (c) => {
		const db = c.env.DB;
		if (!db) return c.json({ error: "Database not configured" }, 500);

		const result = await db.prepare(
			`SELECT metric, value, unit, date, source FROM price_history
			 WHERE id IN (SELECT MAX(id) FROM price_history GROUP BY metric)
			 ORDER BY metric`,
		).all();
		return c.json({ data: result.results, count: result.results.length });
	},
);

// ─── Ingest endpoint (for external data pushers like NAS cron) ──

app.post("/api/ingest", async (c) => {
	const secret = c.env.CRON_SECRET;
	if (!secret) return c.json({ error: "Auth not configured" }, 500);
	const provided = c.req.header("X-Cron-Key") || "";
	const encoder = new TextEncoder();
	const ab = encoder.encode(provided);
	const bb = encoder.encode(secret);
	let cmp = ab.length !== bb.length ? 1 : 0;
	for (let i = 0; i < Math.min(ab.length, bb.length); i++) cmp |= ab[i] ^ bb[i];
	if (cmp !== 0) return c.json({ error: "Unauthorized" }, 401);

	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const body: any = await c.req.json();
	const metrics = Array.isArray(body) ? body : body.metrics;
	if (!Array.isArray(metrics) || metrics.length === 0) {
		return c.json({ error: "Expected array of {date, source, metric, value, unit?}" }, 400);
	}

	const isoNow = new Date().toISOString();
	const stmts = metrics
		.filter((m: any) => m.date && m.source && m.metric && m.value != null)
		.map((m: any) =>
			db.prepare(
				"INSERT OR IGNORE INTO price_history (date, source, metric, value, unit, recorded_at) VALUES (?, ?, ?, ?, ?, ?)",
			).bind(m.date, m.source, m.metric, Number(m.value), m.unit || null, isoNow),
		);

	if (stmts.length === 0) return c.json({ error: "No valid metrics in payload" }, 400);

	// Batch in chunks of 100
	for (let i = 0; i < stmts.length; i += 100) {
		await db.batch(stmts.slice(i, i + 100));
	}

	return c.json({ ok: true, ingested: stmts.length });
});

export default app;
