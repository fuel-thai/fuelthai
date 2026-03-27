import { Hono } from "hono";
import { cache } from "hono/cache";
import type { Bindings } from "../shared";
import { districtEn, safeLimit } from "../shared";

const app = new Hono<{ Bindings: Bindings }>();

// ─── Live Feed: chronological status changes ────────────────────

app.get(
	"/api/feed",
	cache({ cacheName: "feed-v5", cacheControl: "public, max-age=300" }),
	async (c) => {
		const db = c.env.DB;
		if (!db) return c.json({ error: "Database not configured" }, 500);

		const limit = safeLimit(c.req.query("limit"), 50, 200);
		const provinceId = c.req.query("province") ? Number(c.req.query("province")) : null;

		let query = `
			SELECT sc.station_id, sc.fuel_code, sc.old_status, sc.new_status, sc.recorded_at, sc.source,
				s.name as station_name, s.brand_id, s.amphoe, s.lat, s.lon,
				p.name_th as province_th, p.name_en as province_en, p.region
			FROM status_changes sc
			JOIN stations s ON sc.station_id = s.id
			LEFT JOIN provinces p ON s.province_id = p.id
		`;

		function translateFeedRows(rows: any[]) {
			return rows.map((r) => ({ ...r, amphoe_en: districtEn(r.amphoe) }));
		}

		if (provinceId) {
			query += ` WHERE s.province_id = ? ORDER BY sc.recorded_at DESC LIMIT ?`;
			const results = await db.prepare(query).bind(provinceId, limit).all();
			return c.json({ changes: translateFeedRows(results.results as any[]), count: results.results.length });
		}

		query += ` ORDER BY sc.recorded_at DESC LIMIT ?`;
		const results = await db.prepare(query).bind(limit).all();
		return c.json({ changes: translateFeedRows(results.results as any[]), count: results.results.length });
	},
);

export default app;
