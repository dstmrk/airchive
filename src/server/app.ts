import { Hono } from "hono";
import { airports } from "./airports/index.ts";
import { createAuth } from "./auth.ts";
import { flightRoutes } from "./flights.ts";
import { type AppEnv, requireSession } from "./session.ts";

/**
 * The HTTP application of the Worker. Each route of the API starts with
 * `/api`. The asset handler of Cloudflare supplies each other path from
 * `dist/client`. Refer to paragraph 2.2 of `docs/architecture.md`.
 */
export const app = new Hono<AppEnv>();

/**
 * The health route sends one query to D1. Thus the answer `ok` shows that the
 * Worker runs and that the binding `DB` operates.
 *
 * A failure gives the status 503 and no detail. The detail of a database error
 * is not for a public client.
 */
app.get("/api/health", async (c) => {
	try {
		await c.env.DB.prepare("SELECT 1 AS ok").first();
		return c.json({ status: "ok" });
	} catch {
		return c.json({ status: "unavailable" }, 503);
	}
});

/**
 * Better Auth answers each path under `/api/auth`. With no secret, Better Auth
 * cannot sign a cookie, thus the route gives 503 and does not start the auth.
 * The log names the missing secret for the owner of the Worker.
 */
app.on(["GET", "POST"], "/api/auth/*", async (c) => {
	if (!c.env.BETTER_AUTH_SECRET) {
		console.error("BETTER_AUTH_SECRET is missing: the auth is not available.");
		return c.json({ error: "auth_unavailable" }, 503);
	}
	return createAuth(c.env).handler(c.req.raw);
});

/** The person of the session. The client reads it to show the signed-in state. */
app.get("/api/me", requireSession, (c) => c.json(c.var.user));

/**
 * The search of the airports for the form. The data is public, thus the route
 * needs no session. Refer to paragraph 3.4 of `docs/architecture.md`.
 */
app.get("/api/airports", (c) =>
	c.json(airports.search(c.req.query("q") ?? "")),
);

app.route("/api/flights", flightRoutes);

/**
 * The asset handler sends to the Worker only the paths of `run_worker_first`
 * in `wrangler.jsonc`, thus each path here starts with `/api`. A client of the
 * API reads JSON, also for a path that does not exist.
 */
app.notFound((c) => c.json({ error: "not_found" }, 404));
