import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.ts";
import { createTestD1 } from "./test/d1.ts";
import { signIn, testEnv } from "./test/session.ts";

let env: Env;
let dispose: () => Promise<void>;
let bob: string;

beforeAll(async () => {
	const d1 = await createTestD1();
	dispose = d1.dispose;
	env = testEnv(d1.db);
	bob = await signIn(env, "bob@example.com");
});

afterAll(async () => {
	await dispose();
});

function call(
	method: string,
	path: string,
	cookie: string | null,
	body?: unknown,
): Promise<Response> {
	const headers: Record<string, string> = {};
	if (cookie) headers.cookie = cookie;
	if (body !== undefined) headers["content-type"] = "application/json";
	return Promise.resolve(
		app.request(
			path,
			{
				method,
				headers,
				body: body === undefined ? undefined : JSON.stringify(body),
			},
			env,
		),
	);
}

type Leg = {
	id: string;
	journeyId: string;
	origin: string;
	destination: string;
	departureDate: string;
};
type Journey = { id: string; title: string | null; flights: Leg[] };

async function addLeg(
	cookie: string,
	origin: string,
	destination: string,
	departureDate: string,
	journeyId: string | null = null,
): Promise<Leg> {
	const response = await call("POST", "/api/flights", cookie, {
		airlineCode: "EY",
		flightNumber: "88",
		origin,
		destination,
		departureDate,
		journeyId,
	});
	expect(response.status).toBe(201);
	return (await response.json()) as Leg;
}

const route = (journey: Journey) =>
	journey.flights.map((f) => `${f.origin}-${f.destination}`);

describe("the journeys API", () => {
	it("needs a session", async () => {
		const id = "00000000-0000-4000-8000-000000000000";
		for (const [method, path] of [
			["GET", "/api/journeys"],
			["GET", `/api/journeys/${id}`],
			["PATCH", `/api/journeys/${id}`],
		] as const) {
			expect(
				(
					await call(
						method,
						path,
						null,
						method === "PATCH" ? { title: "A" } : undefined,
					)
				).status,
			).toBe(401);
		}
	});

	it("gives the legs of a journey in the order of the chain", async () => {
		const alice = await signIn(env, "alice-order@example.com");
		// The legs arrive out of order, on one day with no times.
		const first = await addLeg(alice, "AUH", "NRT", "2024-05-12");
		await addLeg(alice, "TRN", "FCO", "2024-05-12", first.journeyId);
		await addLeg(alice, "FCO", "AUH", "2024-05-12", first.journeyId);

		const response = await call(
			"GET",
			`/api/journeys/${first.journeyId}`,
			alice,
		);
		const journey = (await response.json()) as Journey;

		expect(response.status).toBe(200);
		expect(journey).toMatchObject({ id: first.journeyId, title: null });
		expect(route(journey)).toEqual(["TRN-FCO", "FCO-AUH", "AUH-NRT"]);
	});

	it("lists the journeys of the owner only, the most recent first", async () => {
		const carol = await signIn(env, "carol@example.com");
		const old = await addLeg(carol, "FCO", "LHR", "2020-01-01");
		await addLeg(carol, "LHR", "JFK", "2020-01-02", old.journeyId);
		await addLeg(carol, "TRN", "FCO", "2023-06-01");
		await addLeg(bob, "MXP", "CDG", "2025-01-01");

		const response = await call("GET", "/api/journeys", carol);
		const journeys = (await response.json()) as Journey[];

		expect(response.status).toBe(200);
		expect(journeys.map(route)).toEqual([["TRN-FCO"], ["FCO-LHR", "LHR-JFK"]]);
	});

	it("gives 404 for the journey of another person and for a text that is not a UUID", async () => {
		const leg = await addLeg(bob, "MXP", "CDG", "2025-01-01");
		const alice = await signIn(env, "alice-404@example.com");

		expect(
			(await call("GET", `/api/journeys/${leg.journeyId}`, alice)).status,
		).toBe(404);
		expect(
			(
				await call("PATCH", `/api/journeys/${leg.journeyId}`, alice, {
					title: "Mine",
				})
			).status,
		).toBe(404);
		expect((await call("GET", "/api/journeys/nope", alice)).status).toBe(404);
	});

	it("changes the title, and an empty title gives the default again", async () => {
		const leg = await addLeg(bob, "FCO", "NRT", "2024-05-12");
		const path = `/api/journeys/${leg.journeyId}`;

		const renamed = await call("PATCH", path, bob, { title: " Japan " });
		expect(renamed.status).toBe(200);
		expect(await renamed.json()).toEqual({
			id: leg.journeyId,
			title: "Japan",
		});

		await call("PATCH", path, bob, { title: "" });
		expect(await (await call("GET", path, bob)).json()).toMatchObject({
			title: null,
		});
	});

	it.each([
		["a title of more than 80 characters", { title: "x".repeat(81) }],
		["another field", { title: "A", ownerId: "x" }],
		["a body that is not JSON", "{"],
	])("refuses %s", async (_name, body) => {
		const leg = await addLeg(bob, "FCO", "NRT", "2024-05-12");
		const response = await app.request(
			`/api/journeys/${leg.journeyId}`,
			{
				method: "PATCH",
				headers: { cookie: bob, "content-type": "application/json" },
				body: typeof body === "string" ? body : JSON.stringify(body),
			},
			env,
		);

		expect(response.status).toBe(400);
	});
});
