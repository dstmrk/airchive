import { app } from "./app.ts";

/**
 * The entry point of the Worker. `wrangler.jsonc` gives this file in `main`.
 * `app.ts` holds the routes, thus a test imports the application without this
 * export.
 */
export default {
	fetch: app.fetch,
} satisfies ExportedHandler<Env>;
