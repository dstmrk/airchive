import { describe, expect, it, vi } from "vitest";
import { app } from "./app.ts";
import { createTestD1 } from "./test/d1.ts";

/**
 * A false D1 binding for the paths that send no SQL, and for a database that
 * does not answer. A test of SQL uses `createTestD1`.
 */
function fakeDb(fails = false): D1Database {
	const statement = {
		all: () =>
			fails
				? Promise.reject(new Error("D1 is not available"))
				: Promise.resolve({ results: [] }),
	};
	return {
		prepare: () => ({ ...statement, bind: () => statement }),
	} as unknown as D1Database;
}

describe("GET /api/health", () => {
	it("gives the status 200 when each table of the schema exists", async () => {
		const migrated = await createTestD1();
		try {
			const response = await app.request(
				"/api/health",
				{},
				{ DB: migrated.db },
			);

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ status: "ok" });
		} finally {
			await migrated.dispose();
		}
	});

	it("gives the status 503 and names the missing tables in the log, not in the answer", async () => {
		// A database before its first migration: the cause of the first failed sign-in in production.
		const empty = await createTestD1({ migrate: false });
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			const response = await app.request("/api/health", {}, { DB: empty.db });

			expect(response.status).toBe(503);
			expect(await response.json()).toEqual({ status: "unavailable" });
			expect(String(error.mock.calls[0]?.[0])).toContain("flight");
		} finally {
			error.mockRestore();
			await empty.dispose();
		}
	});

	it("gives the status 503 and no detail when the database fails", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		try {
			const response = await app.request(
				"/api/health",
				{},
				{ DB: fakeDb(true) },
			);

			expect(response.status).toBe(503);
			expect(await response.json()).toEqual({ status: "unavailable" });
		} finally {
			error.mockRestore();
		}
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
