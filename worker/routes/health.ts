import { Hono } from "hono";
import type { Bindings } from "../shared";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/api/health", async (c) => {
	const dbStatus = c.env.DB ? "ok" : "not configured";
	const r2Status = c.env.R2 ? "ok" : "not configured";
	return c.json({
		status: "ok",
		version: "3.1.0",
		service: "thai-fuel",
		db: dbStatus,
		r2: r2Status,
	});
});

export default app;
