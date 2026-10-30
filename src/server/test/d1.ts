import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { getPlatformProxy } from "wrangler";

const MIGRATIONS = join(import.meta.dirname, "../../../drizzle");

/**
 * It applies the migrations of `drizzle/` in order. `after` and `until` are
 * prefixes of the file names, for example "0002": a test of a migration
 * applies the migrations before it, writes the old rows, then applies it.
 */
export async function applyMigrations(
	db: D1Database,
	{ after = "", until = "9" }: { after?: string; until?: string } = {},
): Promise<void> {
	const files = (await readdir(MIGRATIONS))
		.filter((name) => name.endsWith(".sql"))
		.filter(
			(name) =>
				(after === "" || name.slice(0, after.length) > after) &&
				name.slice(0, until.length) <= until,
		)
		.sort();
	for (const file of files) {
		const sql = await readFile(join(MIGRATIONS, file), "utf8");
		const statements = sql
			.split("--> statement-breakpoint")
			.map((statement) => statement.trim())
			.filter((statement) => statement.length > 0);
		await db.batch(statements.map((statement) => db.prepare(statement)));
	}
}

/**
 * A real D1 database from the local runtime of wrangler, with no persistence,
 * and each migration of `drizzle/` applied in order. A test of the auth then
 * runs the SQL of production, not a false binding. `migrate: false` gives an
 * empty database, as a production database before its first migration.
 * `until` stops after the migration with that prefix.
 *
 * Call `dispose` after the tests of the file.
 */
export async function createTestD1({
	migrate = true,
	until,
}: {
	migrate?: boolean;
	until?: string;
} = {}): Promise<{
	db: D1Database;
	dispose: () => Promise<void>;
}> {
	const proxy = await getPlatformProxy<Env>({ persist: false });
	const db = proxy.env.DB;
	if (migrate) {
		await applyMigrations(db, { until });
	}
	return { db, dispose: () => proxy.dispose() };
}
