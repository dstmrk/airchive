import { describe, expect, it } from "vitest";
import worker from "./index.ts";

describe("the entry point of the Worker", () => {
	it("sends a request to the routes of the application", async () => {
		const db = {
			prepare: () => ({ first: () => Promise.resolve({ ok: 1 }) }),
		} as unknown as D1Database;
		const context = {} as ExecutionContext;

		const response = await worker.fetch(
			new Request("https://airchive.test/api/health"),
			{ DB: db },
			context,
		);

		expect(response.status).toBe(200);
	});
});
