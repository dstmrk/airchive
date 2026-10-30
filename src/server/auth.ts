import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import { MAGIC_LINK_TTL_MINUTES } from "../shared/auth.ts";
import * as schema from "./db/schema.ts";
import { sendMagicLinkEmail } from "./email.ts";
import { describeError } from "./errors.ts";

/**
 * Better Auth for one request. A Worker receives its bindings with each
 * request, thus the instance cannot be a module constant. The instance is
 * cheap: it opens no connection.
 *
 * Refer to paragraph 4 of `docs/architecture.md`.
 */
export function createAuth(env: Env, fetchFn: typeof fetch = fetch) {
	return betterAuth({
		baseURL: env.BETTER_AUTH_URL,
		basePath: "/api/auth",
		secret: env.BETTER_AUTH_SECRET,
		trustedOrigins: [env.BETTER_AUTH_URL],
		database: drizzleAdapter(drizzle(env.DB, { schema }), {
			provider: "sqlite",
		}),
		plugins: [
			magicLink({
				expiresIn: MAGIC_LINK_TTL_MINUTES * 60,
				// The database keeps the hash of the token. A copy of the database
				// then gives no link that opens an account.
				storeToken: "hashed",
				sendMagicLink: ({ email, url }) =>
					sendMagicLinkEmail(env, { to: email, url }, fetchFn),
			}),
		],
		rateLimit: {
			enabled: true,
			// Memory is not shared between the isolates of a Worker. The
			// database is the only store that all the isolates read.
			storage: "database",
			customRules: {
				// Each request sends one email. The limit protects the quota of
				// Resend and the inbox of a person.
				"/sign-in/magic-link": { window: 60, max: 3 },
			},
		},
		onAPIError: {
			// Better Auth logs the outer error only. The cause holds the useful
			// message, for example "no such table" after a missed migration.
			onError: (error) => {
				console.error(`Auth error: ${describeError(error)}`);
			},
		},
		advanced: {
			// Cloudflare writes the address of the client in this header.
			ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
			// Better Auth skips the check of the origin and of the callback
			// when NODE_ENV is "test". This value keeps the check in the tests
			// also, thus the tests examine the behaviour of production.
			disableOriginCheck: false,
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
