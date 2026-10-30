import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit writes the SQL migrations to `drizzle/`. `wrangler.jsonc` reads
 * the same directory in `migrations_dir`, and `wrangler d1 migrations apply`
 * applies the files in order. Refer to paragraph 4.2 of docs/architecture.md.
 */
export default defineConfig({
	dialect: "sqlite",
	schema: "./src/server/db/schema.ts",
	out: "./drizzle",
});
