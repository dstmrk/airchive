import { and, eq, notExists, sql } from "drizzle-orm";
import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
	type FlightInput,
	type FlightIssue,
	type FlightView,
	flightInputSchema,
	UUID,
} from "../shared/flight.ts";
import { overlapsLeg } from "../shared/journey.ts";
import { airports } from "./airports/index.ts";
import { flight, journey } from "./db/schema.ts";
import { type AppEnv, requireSession } from "./session.ts";

/** A flight is approximately 500 bytes. The limit refuses a body before the parse. */
const MAX_BODY_BYTES = 16 * 1024;

type FlightRow = typeof flight.$inferSelect;

/**
 * The flight for the client: the fields of the form, the identifier and the
 * two airports. The owner and the dates of the row stay on the server.
 */
export function toView(row: FlightRow): FlightView {
	const {
		ownerId: _owner,
		createdAt: _created,
		updatedAt: _updated,
		...fields
	} = row;
	return {
		...fields,
		originAirport: airports.get(row.origin) ?? null,
		destinationAirport: airports.get(row.destination) ?? null,
	};
}

/**
 * It reads and validates the body. It gives the flight, or the issues for a
 * response 400. The schema examines the form of each field; this function
 * also examines that each airport is in the dataset.
 */
async function readFlight(
	request: Request,
): Promise<{ flight: FlightInput } | { issues: FlightIssue[] }> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return { issues: [{ path: [], message: "invalid_json" }] };
	}
	const parsed = flightInputSchema.safeParse(body);
	if (!parsed.success) {
		return {
			issues: parsed.error.issues.map((issue) => ({
				path: issue.path.map((part) =>
					typeof part === "symbol" ? String(part) : part,
				),
				message: issue.message,
			})),
		};
	}
	const unknown = (["origin", "destination"] as const)
		.filter((field) => airports.get(parsed.data[field]) === undefined)
		.map((field) => ({ path: [field], message: "unknown_airport" }));
	return unknown.length > 0 ? { issues: unknown } : { flight: parsed.data };
}

/** The issues of a journey that the owner does not have. */
const UNKNOWN_JOURNEY: FlightIssue[] = [
	{ path: ["journeyId"], message: "unknown_journey" },
];

async function ownsJourney(
	db: DrizzleD1Database,
	ownerId: string,
	journeyId: string,
): Promise<boolean> {
	const [row] = await db
		.select({ id: journey.id })
		.from(journey)
		.where(and(eq(journey.id, journeyId), eq(journey.ownerId, ownerId)));
	return row !== undefined;
}

const OVERLAP: FlightIssue[] = [
	{ path: ["departureTime"], message: "overlaps_leg" },
];

const zoneOf = (code: string) => airports.get(code)?.tz;

/** True when the flight is in the air at the same time as another flight of the journey. */
async function overlapsJourney(
	db: DrizzleD1Database,
	ownerId: string,
	journeyId: string,
	leg: FlightInput,
	flightId?: string,
): Promise<boolean> {
	const legs = await db
		.select()
		.from(flight)
		.where(and(eq(flight.journeyId, journeyId), eq(flight.ownerId, ownerId)));
	return overlapsLeg(
		leg,
		legs.filter((other) => other.id !== flightId),
		zoneOf,
	);
}

/** A journey holds one flight or more: this statement deletes each empty journey of the owner. */
function deleteEmptyJourneys(db: DrizzleD1Database, ownerId: string) {
	return db
		.delete(journey)
		.where(
			and(
				eq(journey.ownerId, ownerId),
				notExists(
					db
						.select({ one: sql`1` })
						.from(flight)
						.where(eq(flight.journeyId, journey.id)),
				),
			),
		);
}

/**
 * The routes of `/api/flights`. Each query gives the condition on `owner_id`:
 * a flight of another person gives 404, as a flight that does not exist.
 * Refer to paragraph 3.3 of `docs/architecture.md`.
 */
export const flightRoutes = new Hono<AppEnv>()
	.use(requireSession)
	.use(
		bodyLimit({
			maxSize: MAX_BODY_BYTES,
			onError: (c) => c.json({ error: "body_too_large" }, 413),
		}),
	)
	// With no `journeyId`, the flight starts a new journey of one leg.
	.post("/", async (c) => {
		const result = await readFlight(c.req.raw);
		if ("issues" in result) {
			return c.json({ error: "invalid_flight", issues: result.issues }, 400);
		}
		const db = drizzle(c.env.DB);
		const ownerId = c.var.user.id;
		const { journeyId, ...fields } = result.flight;
		if (journeyId !== null && !(await ownsJourney(db, ownerId, journeyId))) {
			return c.json({ error: "invalid_flight", issues: UNKNOWN_JOURNEY }, 400);
		}
		if (
			journeyId !== null &&
			(await overlapsJourney(db, ownerId, journeyId, result.flight))
		) {
			return c.json({ error: "invalid_flight", issues: OVERLAP }, 400);
		}
		const now = new Date();
		const target = journeyId ?? crypto.randomUUID();
		const insert = db
			.insert(flight)
			.values({
				...fields,
				id: crypto.randomUUID(),
				ownerId,
				journeyId: target,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
		const rows =
			journeyId === null
				? (
						await db.batch([
							db.insert(journey).values({
								id: target,
								ownerId,
								createdAt: now,
								updatedAt: now,
							}),
							insert,
						])
					)[1]
				: await insert;
		const [row] = rows;
		if (row === undefined) {
			throw new Error("The insert of the flight gave no row.");
		}
		return c.json(toView(row), 201);
	})
	.get("/:id", async (c) => {
		const id = c.req.param("id");
		if (!UUID.test(id)) {
			return c.json({ error: "not_found" }, 404);
		}
		const [row] = await drizzle(c.env.DB)
			.select()
			.from(flight)
			.where(and(eq(flight.id, id), eq(flight.ownerId, c.var.user.id)));
		return row ? c.json(toView(row)) : c.json({ error: "not_found" }, 404);
	})
	/**
	 * Another `journeyId` moves the flight to that journey. No `journeyId`
	 * takes the flight out of its journey, to a new journey of one leg. The
	 * journey that the flight leaves is deleted when it is empty.
	 */
	.put("/:id", async (c) => {
		const id = c.req.param("id");
		if (!UUID.test(id)) {
			return c.json({ error: "not_found" }, 404);
		}
		const result = await readFlight(c.req.raw);
		if ("issues" in result) {
			return c.json({ error: "invalid_flight", issues: result.issues }, 400);
		}
		const db = drizzle(c.env.DB);
		const ownerId = c.var.user.id;
		const [current] = await db
			.select({ journeyId: flight.journeyId })
			.from(flight)
			.where(and(eq(flight.id, id), eq(flight.ownerId, ownerId)));
		if (current === undefined) {
			return c.json({ error: "not_found" }, 404);
		}
		const { journeyId, ...fields } = result.flight;
		if (
			journeyId !== null &&
			journeyId !== current.journeyId &&
			!(await ownsJourney(db, ownerId, journeyId))
		) {
			return c.json({ error: "invalid_flight", issues: UNKNOWN_JOURNEY }, 400);
		}
		const [companion] =
			journeyId === null
				? await db
						.select({ id: flight.id })
						.from(flight)
						.where(
							and(
								eq(flight.journeyId, current.journeyId),
								eq(flight.ownerId, ownerId),
								sql`${flight.id} <> ${id}`,
							),
						)
						.limit(1)
				: [];
		// A flight alone in its journey keeps that journey and its title.
		const leaves = journeyId === null && companion !== undefined;
		const now = new Date();
		const target = leaves
			? crypto.randomUUID()
			: (journeyId ?? current.journeyId);
		if (
			!leaves &&
			(await overlapsJourney(db, ownerId, target, result.flight, id))
		) {
			return c.json({ error: "invalid_flight", issues: OVERLAP }, 400);
		}
		const update = db
			.update(flight)
			.set({ ...fields, journeyId: target, updatedAt: now })
			.where(and(eq(flight.id, id), eq(flight.ownerId, ownerId)))
			.returning();
		const cleanup = deleteEmptyJourneys(db, ownerId);
		const rows = leaves
			? (
					await db.batch([
						db
							.insert(journey)
							.values({ id: target, ownerId, createdAt: now, updatedAt: now }),
						update,
						cleanup,
					])
				)[1]
			: (await db.batch([update, cleanup]))[0];
		const [row] = rows;
		return row ? c.json(toView(row)) : c.json({ error: "not_found" }, 404);
	})
	.delete("/:id", async (c) => {
		const id = c.req.param("id");
		if (!UUID.test(id)) {
			return c.json({ error: "not_found" }, 404);
		}
		const db = drizzle(c.env.DB);
		const [deleted] = await db.batch([
			db
				.delete(flight)
				.where(and(eq(flight.id, id), eq(flight.ownerId, c.var.user.id)))
				.returning({ id: flight.id }),
			deleteEmptyJourneys(db, c.var.user.id),
		]);
		return deleted.length > 0
			? c.body(null, 204)
			: c.json({ error: "not_found" }, 404);
	});
