import { createMiddleware } from "hono/factory";
import { createAuth } from "./auth.ts";

export type SessionUser = {
	id: string;
	email: string;
};

export type AppEnv = {
	Bindings: Env;
	Variables: { user: SessionUser };
};

/**
 * The guard of each route that needs a session. With no valid session it gives
 * 401. With a session it gives the user to the route in `c.var.user`.
 */
export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
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
