import { describe, expect, it } from "vitest";
import { app } from "./app.ts";

/**
 * A false D1 binding. The health route sends one query, thus the false
 * binding needs `prepare().first()` only. `fails` makes that query reject.
 */
function fakeDb(fails = false): D1Database {
	const statement = {
		first: () =>
			fails
				? Promise.reject(new Error("D1 is not available"))
				: Promise.resolve({ ok: 1 }),
	};
	return { prepare: () => statement } as unknown as D1Database;
}

describe("GET /api/health", () => {
	it("gives the status 200 when the database answers", async () => {
		const response = await app.request("/api/health", {}, { DB: fakeDb() });

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok" });
	});

	it("gives the status 503 and no detail when the database fails", async () => {
		const response = await app.request("/api/health", {}, { DB: fakeDb(true) });

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ status: "unavailable" });
	});
});

describe("an unknown path of the API", () => {
	it("gives the status 404 as JSON, not the page of the client", async () => {
		const response = await app.request("/api/unknown", {}, { DB: fakeDb() });

		expect(response.status).toBe(404);
		expect(response.headers.get("content-type")).toContain("application/json");
		expect(await response.json()).toEqual({ error: "not_found" });
	});

	it("gives the status 404 for a method that the route does not accept", async () => {
		const response = await app.request(
			"/api/health",
			{ method: "POST" },
			{ DB: fakeDb() },
		);

		expect(response.status).toBe(404);
	});
});
