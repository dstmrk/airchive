import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { createAuth } from "./auth.ts";

type SessionUser = {
	id: string;
	email: string;
};

type AppEnv = {
	Bindings: Env;
	Variables: { user: SessionUser };
};

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

/**
 * The guard of each route that needs a session. With no valid session it gives
 * 401. With a session it gives the user to the route in `c.var.user`.
 */
const requireSession = createMiddleware<AppEnv>(async (c, next) => {
	if (!c.env.BETTER_AUTH_SECRET) {
		return c.json({ error: "unauthorized" }, 401);
	}
	const session = await createAuth(c.env).api.getSession({
		headers: c.req.raw.headers,
	});
	if (session === null) {
		return c.json({ error: "unauthorized" }, 401);
	}
	c.set("user", { id: session.user.id, email: session.user.email });
	await next();
});

/** The person of the session. The client reads it to show the signed-in state. */
app.get("/api/me", requireSession, (c) => c.json(c.var.user));

/**
 * The asset handler sends to the Worker only the paths of `run_worker_first`
 * in `wrangler.jsonc`, thus each path here starts with `/api`. A client of the
 * API reads JSON, also for a path that does not exist.
 */
app.notFound((c) => c.json({ error: "not_found" }, 404));
