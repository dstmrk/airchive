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
			["GET", "/api/flights"],
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

	it("lists the flights of the owner only, the most recent first", async () => {
		const carol = await signIn(env, "carol@example.com");
		// No arrival date: the arrival of romeTokyo is in 2024.
		const day = (departureDate: string, departureTime = "13:05") => ({
			departureDate,
			departureTime,
			arrivalDate: null,
		});
		await create(carol, day("2020-01-01"));
		await create(carol, day("2023-06-01", "08:00"));
		await create(carol, day("2023-06-01", "18:00"));
		await create(bob, day("2025-01-01"));

		const response = await call("GET", "/api/flights", carol);
		const flights = (await response.json()) as FlightView[];

		expect(response.status).toBe(200);
		expect(flights.map((f) => `${f.departureDate} ${f.departureTime}`)).toEqual(
			["2023-06-01 18:00", "2023-06-01 08:00", "2020-01-01 13:05"],
		);
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
