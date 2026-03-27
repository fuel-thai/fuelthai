import { Hono } from "hono";
import type { Bindings } from "../shared";

const app = new Hono<{ Bindings: Bindings }>();

// DOEB cache reference -- kept for health endpoint reporting
export let doebCache: { stations: any[]; fetchedAt: number } | null = null;

app.get("/api/health", async (c) => {
	const dbStatus = c.env.DB ? "ok" : "not configured";
	const r2Status = c.env.R2 ? "ok" : "not configured";
	return c.json({
		status: "ok",
		version: "3.0.0",
		service: "thai-fuel",
		db: dbStatus,
		r2: r2Status,
		doebCache: doebCache ? { stations: doebCache.stations.length, age: Math.round((Date.now() - doebCache.fetchedAt) / 1000) + "s" } : null,
	});
});

export default app;
