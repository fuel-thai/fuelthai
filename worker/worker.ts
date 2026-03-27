import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Bindings } from "./shared";
import pricesRoutes from "./routes/prices";
import newsRoutes from "./routes/news";
import stationsRoutes from "./routes/stations";
import feedRoutes from "./routes/feed";
import historyRoutes from "./routes/history";
import pushRoutes from "./routes/push";
import cronRoutes, { handleCron } from "./routes/cron";
import healthRoutes from "./routes/health";

const app = new Hono<{ Bindings: Bindings }>();

// ─── Global Middleware ───────────────────────────────────────────

app.use("/api/*", cors({
	origin: ["https://fuelthai.com", "https://www.fuelthai.com", "https://fuel.lanta.dev", "https://fuel-staging.lanta.dev", "https://thai-fuel.preview.frst.dev"],
	allowMethods: ["GET", "OPTIONS"],
}));

// Security headers on all API responses
app.use("/api/*", async (c, next) => {
	await next();
	c.header("X-Content-Type-Options", "nosniff");
	c.header("X-Frame-Options", "DENY");
});

// ─── Route Modules ───────────────────────────────────────────────

app.route("/", pricesRoutes);
app.route("/", newsRoutes);
app.route("/", stationsRoutes);
app.route("/", feedRoutes);
app.route("/", historyRoutes);
app.route("/", pushRoutes);
app.route("/", cronRoutes);
app.route("/", healthRoutes);

// ─── SPA Fallback (must be LAST route) ───────────────────────────

app.all("*", async (c) => {
	return c.env.ASSETS.fetch(c.req.raw);
});

export default {
	fetch: app.fetch,
	async scheduled(event: ScheduledEvent, env: Bindings, ctx: ExecutionContext) {
		ctx.waitUntil(handleCron(env));
	},
};
