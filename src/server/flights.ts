import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import {
	type FlightInput,
	type FlightIssue,
	type FlightView,
	flightInputSchema,
} from "../shared/flight.ts";
import { airports } from "./airports/index.ts";
import { flight } from "./db/schema.ts";
import { type AppEnv, requireSession } from "./session.ts";

/** A flight is approximately 500 bytes. The limit refuses a body before the parse. */
const MAX_BODY_BYTES = 16 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type FlightRow = typeof flight.$inferSelect;

/**
 * The flight for the client: the fields of the form, the identifier and the
 * two airports. The owner and the dates of the row stay on the server.
 */
function toView(row: FlightRow): FlightView {
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
	.get("/", async (c) => {
		const rows = await drizzle(c.env.DB)
			.select()
			.from(flight)
			.where(eq(flight.ownerId, c.var.user.id))
			.orderBy(
				desc(flight.departureDate),
				desc(flight.departureTime),
				desc(flight.createdAt),
			);
		return c.json(rows.map(toView));
	})
	.post("/", async (c) => {
		const result = await readFlight(c.req.raw);
		if ("issues" in result) {
			return c.json({ error: "invalid_flight", issues: result.issues }, 400);
		}
		const now = new Date();
		const [row] = await drizzle(c.env.DB)
			.insert(flight)
			.values({
				...result.flight,
				id: crypto.randomUUID(),
				ownerId: c.var.user.id,
				createdAt: now,
				updatedAt: now,
			})
			.returning();
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
	.put("/:id", async (c) => {
		const id = c.req.param("id");
		if (!UUID.test(id)) {
			return c.json({ error: "not_found" }, 404);
		}
		const result = await readFlight(c.req.raw);
		if ("issues" in result) {
			return c.json({ error: "invalid_flight", issues: result.issues }, 400);
		}
		const [row] = await drizzle(c.env.DB)
			.update(flight)
			.set({ ...result.flight, updatedAt: new Date() })
			.where(and(eq(flight.id, id), eq(flight.ownerId, c.var.user.id)))
			.returning();
		return row ? c.json(toView(row)) : c.json({ error: "not_found" }, 404);
	})
	.delete("/:id", async (c) => {
		const id = c.req.param("id");
		if (!UUID.test(id)) {
			return c.json({ error: "not_found" }, 404);
		}
		const deleted = await drizzle(c.env.DB)
			.delete(flight)
			.where(and(eq(flight.id, id), eq(flight.ownerId, c.var.user.id)))
			.returning({ id: flight.id });
		return deleted.length > 0
			? c.body(null, 204)
			: c.json({ error: "not_found" }, 404);
	});
