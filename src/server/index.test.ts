import { describe, expect, it } from "vitest";
import worker from "./index.ts";

describe("the entry point of the Worker", () => {
	it("sends a request to the routes of the application", async () => {
		// An unknown path of the API sends no query, thus the database is not used.
		const response = await worker.fetch(
			new Request("https://airchive.test/api/unknown"),
			{} as Env,
			{} as ExecutionContext,
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ error: "not_found" });
	});
});
