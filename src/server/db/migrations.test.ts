import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations, createTestD1 } from "../test/d1.ts";

/**
 * The migrations that move data. A migration that ran one time is immutable,
 * thus each test applies the migrations before it, writes the old rows, then
 * applies the migration.
 */
describe("the migration 0003_journey", () => {
	let db: D1Database;
	let dispose: () => Promise<void>;

	beforeAll(async () => {
		const d1 = await createTestD1({ until: "0002" });
		db = d1.db;
		dispose = d1.dispose;
		await db.batch([
			db.prepare(
				"INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('u1', '', 'a@example.com', 1, 1, 1)",
			),
			db.prepare(
				`INSERT INTO flight (id, owner_id, airline_code, flight_number, origin, destination, departure_date, departure_time, seat, accent_color, created_at, updated_at)
				 VALUES ('f1', 'u1', 'AZ', '784', 'FCO', 'NRT', '2024-05-12', '13:05', '14A', '#00205b', 10, 20),
				        ('f2', 'u1', 'EY', '88', 'AUH', 'NRT', '2024-06-01', NULL, NULL, NULL, 30, 40)`,
			),
		]);
		await applyMigrations(db, { after: "0002" });
	});

	afterAll(async () => {
		await dispose();
	});

	it("gives each old flight its own journey with no title, with the owner and the dates of the flight", async () => {
		const { results } = await db
			.prepare("SELECT * FROM journey ORDER BY id")
			.all();

		expect(results).toEqual([
			{ id: "f1", owner_id: "u1", title: null, created_at: 10, updated_at: 20 },
			{ id: "f2", owner_id: "u1", title: null, created_at: 30, updated_at: 40 },
		]);
	});

	it("keeps each value of the flights", async () => {
		const { results } = await db
			.prepare(
				"SELECT id, journey_id, departure_time, seat, accent_color, created_at FROM flight ORDER BY id",
			)
			.all();

		expect(results).toEqual([
			{
				id: "f1",
				journey_id: "f1",
				departure_time: "13:05",
				seat: "14A",
				accent_color: "#00205b",
				created_at: 10,
			},
			{
				id: "f2",
				journey_id: "f2",
				departure_time: null,
				seat: null,
				accent_color: null,
				created_at: 30,
			},
		]);
	});

	it("deletes the flights with their journey", async () => {
		await db.prepare("DELETE FROM journey WHERE id = 'f2'").run();

		const { results } = await db.prepare("SELECT id FROM flight").all();
		expect(results).toEqual([{ id: "f1" }]);
	});

	it("refuses a flight with a journey that does not exist", async () => {
		await expect(
			db
				.prepare(
					"INSERT INTO flight (id, owner_id, journey_id, airline_code, flight_number, origin, destination, departure_date, created_at, updated_at) VALUES ('f3', 'u1', 'nope', 'AZ', '1', 'FCO', 'NRT', '2024-05-12', 1, 1)",
				)
				.run(),
		).rejects.toThrow(/FOREIGN KEY/);
	});
});
