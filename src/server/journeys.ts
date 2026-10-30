import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { UUID } from "../shared/flight.ts";
import {
	type JourneyView,
	journeyTitleSchema,
	orderLegs,
} from "../shared/journey.ts";
import { flight, journey } from "./db/schema.ts";
import { toView } from "./flights.ts";
import { type AppEnv, requireSession } from "./session.ts";

/** A title is at most 80 characters. The limit refuses a body before the parse. */
const MAX_BODY_BYTES = 1024;

type JourneyRow = typeof journey.$inferSelect;
type FlightRow = typeof flight.$inferSelect;

function toJourneyView(row: JourneyRow, flights: FlightRow[]): JourneyView {
	return {
		id: row.id,
		title: row.title,
		flights: orderLegs(flights.map(toView)),
	};
}

/** The date and the time of the first leg, for the order of the archive. */
const startOf = ({ flights: [first] }: JourneyView) =>
	first ? `${first.departureDate} ${first.departureTime ?? ""}` : "";

/**
 * The routes of `/api/journeys`. A journey holds one flight or more: the
 * routes of the flights create and delete the journeys. Each query gives the
 * condition on `owner_id`. Refer to paragraph 3.5 of `docs/architecture.md`.
 */
export const journeyRoutes = new Hono<AppEnv>()
	.use(requireSession)
	.use(
		bodyLimit({
			maxSize: MAX_BODY_BYTES,
			onError: (c) => c.json({ error: "body_too_large" }, 413),
		}),
	)
	// The archive: each journey with its flights, the most recent first.
	.get("/", async (c) => {
		const db = drizzle(c.env.DB);
		const ownerId = c.var.user.id;
		const [journeys, flights] = await db.batch([
			db.select().from(journey).where(eq(journey.ownerId, ownerId)),
			db.select().from(flight).where(eq(flight.ownerId, ownerId)),
		]);
		const byJourney = new Map<string, FlightRow[]>();
		for (const row of flights) {
			byJourney.set(row.journeyId, [
				...(byJourney.get(row.journeyId) ?? []),
				row,
			]);
		}
		const views = journeys
			.map((row) => toJourneyView(row, byJourney.get(row.id) ?? []))
			.filter((view) => view.flights.length > 0);
		views.sort((a, b) => startOf(b).localeCompare(startOf(a)));
		return c.json(views);
	})
	.get("/:id", async (c) => {
		const id = c.req.param("id");
		if (!UUID.test(id)) {
			return c.json({ error: "not_found" }, 404);
		}
		const db = drizzle(c.env.DB);
		const ownerId = c.var.user.id;
		const [[row], flights] = await db.batch([
			db
				.select()
				.from(journey)
				.where(and(eq(journey.id, id), eq(journey.ownerId, ownerId))),
			db
				.select()
				.from(flight)
				.where(and(eq(flight.journeyId, id), eq(flight.ownerId, ownerId))),
		]);
		return row
			? c.json(toJourneyView(row, flights))
			: c.json({ error: "not_found" }, 404);
	})
	.patch("/:id", async (c) => {
		const id = c.req.param("id");
		if (!UUID.test(id)) {
			return c.json({ error: "not_found" }, 404);
		}
		const parsed = journeyTitleSchema.safeParse(
			await c.req.json().catch(() => undefined),
		);
		if (!parsed.success) {
			return c.json({ error: "invalid_journey" }, 400);
		}
		const db = drizzle(c.env.DB);
		const ownerId = c.var.user.id;
		const [updated] = await db
			.update(journey)
			.set({ title: parsed.data.title, updatedAt: new Date() })
			.where(and(eq(journey.id, id), eq(journey.ownerId, ownerId)))
			.returning({ id: journey.id });
		return updated
			? c.json({ id: updated.id, title: parsed.data.title })
			: c.json({ error: "not_found" }, 404);
	});
