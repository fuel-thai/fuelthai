import { Hono } from "hono";
import type { Bindings } from "../shared";
import { geohash } from "../shared";

const app = new Hono<{ Bindings: Bindings }>();

// ─── Push Notifications ──────────────────────────────────────────

app.get("/api/push/vapid", (c) => {
	return c.json({ publicKey: c.env.VAPID_PUBLIC_KEY || null });
});

app.post("/api/push/subscribe", async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const body: any = await c.req.json();
	const { subscription, lat, lon, radius, lang: userLang } = body;

	if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
		return c.json({ error: "Invalid subscription" }, 400);
	}
	if (!lat || !lon) return c.json({ error: "Location required" }, 400);

	const gh5 = geohash(Number(lat), Number(lon), 5);
	const r = Math.min(Math.max(Number(radius) || 20, 5), 50);

	await db.prepare(
		`INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth, lat, lon, geohash5, radius, lang, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(endpoint) DO UPDATE SET lat=excluded.lat, lon=excluded.lon, geohash5=excluded.geohash5, radius=excluded.radius`,
	).bind(
		subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth,
		Number(lat), Number(lon), gh5, r, userLang || "th", new Date().toISOString(),
	).run();

	return c.json({ ok: true, geohash: gh5 });
});

app.post("/api/push/unsubscribe", async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const body: any = await c.req.json();
	if (!body?.endpoint) return c.json({ error: "Endpoint required" }, 400);

	await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(body.endpoint).run();
	return c.json({ ok: true });
});

// ─── Station-specific push subscriptions ─────────────────────────

app.post("/api/push/subscribe-station", async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const body: any = await c.req.json();
	const { subscription, stationId, lang: userLang } = body;

	if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
		return c.json({ error: "Invalid subscription" }, 400);
	}
	if (!stationId) return c.json({ error: "Station ID required" }, 400);

	const station = await db.prepare("SELECT id, name FROM stations WHERE id = ?").bind(stationId).first();
	if (!station) return c.json({ error: "Station not found" }, 404);

	await db.prepare(
		`INSERT INTO station_subscriptions (endpoint, keys_p256dh, keys_auth, station_id, lang, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(endpoint, station_id) DO UPDATE SET keys_p256dh=excluded.keys_p256dh, keys_auth=excluded.keys_auth`,
	).bind(
		subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth,
		stationId, userLang || "th", new Date().toISOString(),
	).run();

	return c.json({ ok: true, station: station.name });
});

app.post("/api/push/unsubscribe-station", async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ error: "Database not configured" }, 500);

	const body: any = await c.req.json();
	if (!body?.endpoint || !body?.stationId) return c.json({ error: "Endpoint and stationId required" }, 400);

	await db.prepare("DELETE FROM station_subscriptions WHERE endpoint = ? AND station_id = ?")
		.bind(body.endpoint, body.stationId).run();
	return c.json({ ok: true });
});

app.get("/api/push/station-status", async (c) => {
	const db = c.env.DB;
	if (!db) return c.json({ subscribed: false });

	const endpoint = c.req.query("endpoint");
	const stationId = c.req.query("station");
	if (!endpoint || !stationId) return c.json({ subscribed: false });

	const sub = await db.prepare("SELECT id FROM station_subscriptions WHERE endpoint = ? AND station_id = ?")
		.bind(endpoint, stationId).first();
	return c.json({ subscribed: !!sub });
});

export default app;
