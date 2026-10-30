import { describe, expect, it, vi } from "vitest";
import { ApiError, apiRequest } from "./api.ts";

function respond(status: number, body?: unknown) {
	return vi.fn<typeof fetch>(
		async () =>
			new Response(body === undefined ? null : JSON.stringify(body), {
				status,
				headers: { "content-type": "application/json" },
			}),
	);
}

describe("apiRequest", () => {
	it("gives the JSON of a successful response", async () => {
		const fetchFn = respond(200, [{ id: "1" }]);

		await expect(apiRequest("/api/flights", {}, fetchFn)).resolves.toEqual([
			{ id: "1" },
		]);
	});

	it("sends a body as JSON", async () => {
		const fetchFn = respond(201, { id: "1" });

		await apiRequest(
			"/api/flights",
			{ method: "POST", body: { a: 1 } },
			fetchFn,
		);

		const init = fetchFn.mock.calls[0]?.[1] ?? {};
		expect(init.method).toBe("POST");
		expect(init.body).toBe('{"a":1}');
		expect(new Headers(init.headers).get("content-type")).toBe(
			"application/json",
		);
	});

	it("gives undefined for the status 204", async () => {
		await expect(
			apiRequest("/api/flights/1", { method: "DELETE" }, respond(204)),
		).resolves.toBeUndefined();
	});

	it("throws an ApiError with the status and the body", async () => {
		const body = {
			error: "invalid_flight",
			issues: [{ path: ["origin"], message: "x" }],
		};

		const error = await apiRequest(
			"/api/flights",
			{},
			respond(400, body),
		).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(ApiError);
		expect(error).toMatchObject({ status: 400, body });
	});

	it("throws an ApiError with no body when the body is not JSON", async () => {
		const fetchFn = vi.fn<typeof fetch>(
			async () => new Response("Bad gateway", { status: 502 }),
		);

		const error = await apiRequest("/api/flights", {}, fetchFn).catch(
			(e: unknown) => e,
		);

		expect(error).toMatchObject({ status: 502, body: null });
	});
});
