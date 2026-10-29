import { Hono } from "hono";

/**
 * The HTTP application of the Worker. Each route of the API starts with
 * `/api`. The asset handler of Cloudflare supplies each other path from
 * `dist/client`. Refer to paragraph 2.2 of `docs/architecture.md`.
 */
export const app = new Hono<{ Bindings: Env }>();

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
 * The asset handler sends to the Worker only the paths of `run_worker_first`
 * in `wrangler.jsonc`, thus each path here starts with `/api`. A client of the
 * API reads JSON, also for a path that does not exist.
 */
app.notFound((c) => c.json({ error: "not_found" }, 404));
