import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.ts";
import { createTestD1 } from "./test/d1.ts";
import { signIn, testEnv } from "./test/session.ts";

let env: Env;
let dispose: () => Promise<void>;
let alice: string;
let bob: string;

beforeAll(async () => {
	const d1 = await createTestD1();
	dispose = d1.dispose;
	env = testEnv(d1.db);
	alice = await signIn(env, "alice@example.com");
	bob = await signIn(env, "bob@example.com");
});

afterAll(async () => {
	await dispose();
});

const romeTokyo = {
	airlineCode: "AZ",
	flightNumber: "784",
	origin: "FCO",
	destination: "NRT",
	departureDate: "2024-05-12",
	departureTime: "13:05",
	arrivalDate: "2024-05-13",
	arrivalTime: "09:10",
	seat: "14A",
	cabinClass: "economy",
	passengerName: "ALICE EXAMPLE",
	bookingReference: "ABC123",
};

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

type FlightView = typeof romeTokyo & {
	id: string;
	journeyId: string;
	airlineName: string | null;
	originAirport: { iata: string; city: string; tz: string; lat: number };
	destinationAirport: { iata: string; city: string; tz: string };
};

async function create(cookie: string, overrides: Record<string, unknown> = {}) {
	const response = await call("POST", "/api/flights", cookie, {
		...romeTokyo,
		...overrides,
	});
	expect(response.status).toBe(201);
	return (await response.json()) as FlightView;
}

describe("the flights API", () => {
	it("needs a session", async () => {
		for (const [method, path] of [
			["POST", "/api/flights"],
			["GET", "/api/flights/00000000-0000-4000-8000-000000000000"],
		] as const) {
			expect(
				(
					await call(
						method,
						path,
						null,
						method === "POST" ? romeTokyo : undefined,
					)
				).status,
			).toBe(401);
		}
	});

	it("creates a flight and gives it with its airports", async () => {
		const flight = await create(alice);

		expect(flight.id).toMatch(/^[0-9a-f-]{36}$/);
		expect(flight).toMatchObject({ ...romeTokyo, airlineName: null });
		expect(flight.originAirport).toMatchObject({
			iata: "FCO",
			city: "Rome",
			tz: "Europe/Rome",
		});
		expect(flight.destinationAirport.tz).toBe("Asia/Tokyo");
	});

	it("does not give the owner to the client", async () => {
		const flight = await create(alice);

		expect(flight).not.toHaveProperty("ownerId");
	});

	it("reads, updates and deletes a flight of the owner", async () => {
		const flight = await create(alice);
		const path = `/api/flights/${flight.id}`;

		expect((await call("GET", path, alice)).status).toBe(200);

		const updated = await call("PUT", path, alice, {
			...romeTokyo,
			seat: "2C",
			cabinClass: "business",
		});
		expect(updated.status).toBe(200);
		expect(await updated.json()).toMatchObject({
			id: flight.id,
			seat: "2C",
			cabinClass: "business",
		});

		expect((await call("DELETE", path, alice)).status).toBe(204);
		expect((await call("GET", path, alice)).status).toBe(404);
	});

	it("gives 404 to another person, for read, update and delete", async () => {
		const flight = await create(alice);
		const path = `/api/flights/${flight.id}`;

		expect((await call("GET", path, bob)).status).toBe(404);
		expect((await call("PUT", path, bob, romeTokyo)).status).toBe(404);
		expect((await call("DELETE", path, bob)).status).toBe(404);
		expect((await call("GET", path, alice)).status).toBe(200);
	});

	it("gives 404 for an identifier that is not a UUID", async () => {
		expect((await call("GET", "/api/flights/not-a-uuid", alice)).status).toBe(
			404,
		);
	});

	it("refuses an invalid flight with the path of each problem", async () => {
		const response = await call("POST", "/api/flights", alice, {
			...romeTokyo,
			departureDate: "2024-02-30",
			destination: "FCO",
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as {
			error: string;
			issues: { path: string[] }[];
		};
		expect(body.error).toBe("invalid_flight");
		expect(body.issues.map((i) => i.path.join("."))).toContain("departureDate");
	});

	it("refuses an airport that is not in the dataset", async () => {
		const response = await call("POST", "/api/flights", alice, {
			...romeTokyo,
			destination: "QQQ",
		});

		expect(response.status).toBe(400);
		const body = (await response.json()) as {
			issues: { path: string[]; message: string }[];
		};
		expect(body.issues).toEqual([
			{ path: ["destination"], message: "unknown_airport" },
		]);
	});

	it("refuses a body that is not JSON", async () => {
		const response = await app.request(
			"/api/flights",
			{
				method: "POST",
				headers: { cookie: alice, "content-type": "application/json" },
				body: "{",
			},
			env,
		);

		expect(response.status).toBe(400);
	});

	it("refuses a body larger than 16 KB", async () => {
		const response = await call("POST", "/api/flights", alice, {
			...romeTokyo,
			passengerName: "x".repeat(20_000),
		});

		expect(response.status).toBe(413);
	});

	it("refuses an owner in the body", async () => {
		const response = await call("POST", "/api/flights", alice, {
			...romeTokyo,
			ownerId: "x",
		});

		expect(response.status).toBe(400);
	});
});

describe("the journey of a flight", () => {
	async function journeyOf(cookie: string, journeyId: string) {
		const response = await call("GET", `/api/journeys/${journeyId}`, cookie);
		return response.status === 200
			? ((await response.json()) as { flights: FlightView[] })
			: null;
	}

	it("starts a new journey for a flight with no journey", async () => {
		const first = await create(alice);
		const second = await create(alice, { journeyId: null });

		expect(first.journeyId).toMatch(/^[0-9a-f-]{36}$/);
		expect(second.journeyId).not.toBe(first.journeyId);
	});

	it("adds a flight to a journey of the owner", async () => {
		const first = await create(alice);
		const second = await create(alice, {
			origin: "NRT",
			destination: "HND",
			journeyId: first.journeyId,
		});

		expect(second.journeyId).toBe(first.journeyId);
		expect((await journeyOf(alice, first.journeyId))?.flights).toHaveLength(2);
	});

	it("refuses the journey of another person, as a journey that does not exist", async () => {
		const other = await create(bob);
		for (const journeyId of [
			other.journeyId,
			"00000000-0000-4000-8000-000000000000",
		]) {
			const response = await call("POST", "/api/flights", alice, {
				...romeTokyo,
				journeyId,
			});

			expect(response.status).toBe(400);
			expect(await response.json()).toMatchObject({
				issues: [{ path: ["journeyId"], message: "unknown_journey" }],
			});
		}
		expect((await journeyOf(bob, other.journeyId))?.flights).toHaveLength(1);
	});

	it("refuses a move to the journey of another person", async () => {
		const mine = await create(alice);
		const other = await create(bob);

		const response = await call("PUT", `/api/flights/${mine.id}`, alice, {
			...romeTokyo,
			journeyId: other.journeyId,
		});

		expect(response.status).toBe(400);
		expect((await journeyOf(bob, other.journeyId))?.flights).toHaveLength(1);
	});

	it("moves a flight to another journey and deletes the empty journey", async () => {
		const target = await create(alice);
		const moved = await create(alice);

		const response = await call("PUT", `/api/flights/${moved.id}`, alice, {
			...romeTokyo,
			journeyId: target.journeyId,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			journeyId: target.journeyId,
		});
		expect(await journeyOf(alice, moved.journeyId)).toBeNull();
		expect((await journeyOf(alice, target.journeyId))?.flights).toHaveLength(2);
	});

	it("takes a flight out of its journey to a new journey", async () => {
		const first = await create(alice);
		const second = await create(alice, { journeyId: first.journeyId });

		const response = await call("PUT", `/api/flights/${second.id}`, alice, {
			...romeTokyo,
			journeyId: null,
		});
		const updated = (await response.json()) as FlightView;

		expect(updated.journeyId).not.toBe(first.journeyId);
		expect((await journeyOf(alice, first.journeyId))?.flights).toHaveLength(1);
		expect((await journeyOf(alice, updated.journeyId))?.flights).toHaveLength(
			1,
		);
	});

	it("keeps the journey and its title for a flight alone in it", async () => {
		const flight = await create(alice);
		await call("PATCH", `/api/journeys/${flight.journeyId}`, alice, {
			title: "Japan",
		});

		const response = await call("PUT", `/api/flights/${flight.id}`, alice, {
			...romeTokyo,
			journeyId: null,
		});

		expect(await response.json()).toMatchObject({
			journeyId: flight.journeyId,
		});
		expect(await journeyOf(alice, flight.journeyId)).toMatchObject({
			title: "Japan",
		});
	});

	it("deletes the journey with its last flight, and keeps a journey with other flights", async () => {
		const first = await create(alice);
		const second = await create(alice, { journeyId: first.journeyId });

		await call("DELETE", `/api/flights/${second.id}`, alice);
		expect((await journeyOf(alice, first.journeyId))?.flights).toHaveLength(1);

		await call("DELETE", `/api/flights/${first.id}`, alice);
		expect(await journeyOf(alice, first.journeyId)).toBeNull();
	});

	it("does not delete an empty journey of another person", async () => {
		const other = await create(bob);
		const mine = await create(alice);

		await call("DELETE", `/api/flights/${mine.id}`, alice);

		expect(await journeyOf(bob, other.journeyId)).not.toBeNull();
	});
});

describe("GET /api/airports", () => {
	it("gives the airports that match the text", async () => {
		const response = await call("GET", "/api/airports?q=fiumicino", null);

		expect(response.status).toBe(200);
		const body = (await response.json()) as { iata: string }[];
		expect(body[0]?.iata).toBe("FCO");
	});

	it("gives an empty list with no text", async () => {
		const response = await call("GET", "/api/airports", null);

		expect(await response.json()).toEqual([]);
	});
});
