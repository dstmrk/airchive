import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";

const MIGRATIONS = join(import.meta.dirname, "../../../drizzle");

/**
 * A real D1 database from the local runtime of wrangler, with no persistence,
 * and each migration of `drizzle/` applied in order. A test of the auth then
 * runs the SQL of production, not a false binding.
 *
 * Call `dispose` after the tests of the file.
 */
export async function createTestD1(): Promise<{
	db: D1Database;
	dispose: () => Promise<void>;
}> {
	const proxy = await getPlatformProxy<Env>({ persist: false });
	const db = proxy.env.DB;

	const files = (await readdir(MIGRATIONS))
		.filter((name) => name.endsWith(".sql"))
		.sort();
	for (const file of files) {
		const sql = await readFile(join(MIGRATIONS, file), "utf8");
		const statements = sql
			.split("--> statement-breakpoint")
			.map((statement) => statement.trim())
			.filter((statement) => statement.length > 0);
		await db.batch(statements.map((statement) => db.prepare(statement)));
	}

	return { db, dispose: () => proxy.dispose() };
}
