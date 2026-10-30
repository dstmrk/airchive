import { getTableName, is, Table } from "drizzle-orm";
import { Hono } from "hono";
import { airports } from "./airports/index.ts";
import { createAuth } from "./auth.ts";
import * as schema from "./db/schema.ts";
import { describeError } from "./errors.ts";
import { flightRoutes } from "./flights.ts";
import { type AppEnv, requireSession } from "./session.ts";

/**
 * The HTTP application of the Worker. Each route of the API starts with
 * `/api`. The asset handler of Cloudflare supplies each other path from
 * `dist/client`. Refer to paragraph 2.2 of `docs/architecture.md`.
 */
export const app = new Hono<AppEnv>();

/** Each table of `schema.ts`. A new table enters the check with no other change. */
const REQUIRED_TABLES = Object.values(schema)
	.filter((value) => is(value, Table))
	.map((table) => getTableName(table));

/**
 * The health route examines that D1 answers and that each table of the schema
 * exists. A deployment that skipped the migrations then gives 503, not `ok`.
 * Refer to paragraph 7 of `docs/architecture.md`.
 *
 * The answer gives no detail: the log names the missing tables.
 */
app.get("/api/health", async (c) => {
	try {
		const placeholders = REQUIRED_TABLES.map(() => "?").join(", ");
		const { results } = await c.env.DB.prepare(
			`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${placeholders})`,
		)
			.bind(...REQUIRED_TABLES)
			.all<{ name: string }>();
		const found = new Set(results.map((row) => row.name));
		const missing = REQUIRED_TABLES.filter((name) => !found.has(name));
		if (missing.length > 0) {
			console.error(
				`Health: missing tables ${missing.join(", ")}. Apply the migrations.`,
			);
			return c.json({ status: "unavailable" }, 503);
		}
		return c.json({ status: "ok" });
	} catch (error) {
		console.error(`Health: ${describeError(error)}`);
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
 * An error that no route handles. Hono writes the whole error by default, and
 * the log of Cloudflare then shows the stack with no message. This line gives
 * the message of each cause, with no parameter of a query. Refer to
 * `errors.ts`.
 */
app.onError((error, c) => {
	console.error(
		`Unhandled error on ${c.req.method} ${c.req.path}: ${describeError(error)}`,
	);
	return c.json({ error: "internal" }, 500);
});

/**
 * The asset handler sends to the Worker only the paths of `run_worker_first`
 * in `wrangler.jsonc`, thus each path here starts with `/api`. A client of the
 * API reads JSON, also for a path that does not exist.
 */
app.notFound((c) => c.json({ error: "not_found" }, 404));
