import * as z from "zod";
import { type FlightView, optional } from "./flight.ts";
import { type LegTimes, legInstants } from "./zoned-time.ts";

/**
 * A journey: the flights from an origin to a final destination, with the
 * connections between them. Paragraph 3.5 of `docs/architecture.md` gives
 * the decisions.
 */

/** The body of a change of the title. With no title, the client gives a default. */
export const journeyTitleSchema = z.strictObject({
	title: optional(z.string().trim().max(80)),
});

/** A journey as the API gives it: the flights are in the order of the legs. */
export type JourneyView = {
	id: string;
	title: string | null;
	flights: FlightView[];
};

/** The fields that give the order of the legs. */
export type LegOrder = {
	origin: string;
	destination: string;
	departureDate: string;
	departureTime: string | null;
};

/** By the local date, then by the local time. A leg with no time comes last. */
function byDate(a: LegOrder, b: LegOrder): number {
	const left = `${a.departureDate} ${a.departureTime ?? "~"}`;
	const right = `${b.departureDate} ${b.departureTime ?? "~"}`;
	return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * The legs in the order of the journey. The chain of the airports decides
 * first: the next leg departs from the destination of the previous leg.
 * The dates and the local times decide only where no chain decides, because
 * a barcode gives no time, and a leg across the date line can land on the
 * previous local day. A chain starts at the earliest leg whose origin is the
 * destination of no other leg.
 */
export function orderLegs<T extends LegOrder>(legs: readonly T[]): T[] {
	const left = [...legs].sort(byDate);
	const ordered: T[] = [];
	while (left.length > 0) {
		const start = left.findIndex(
			(leg) =>
				!left.some(
					(other) => other !== leg && other.destination === leg.origin,
				),
		);
		let [current] = left.splice(Math.max(0, start), 1);
		while (current !== undefined) {
			ordered.push(current);
			const from = current.destination;
			const next = left.findIndex((leg) => leg.origin === from);
			[current] = next < 0 ? [] : left.splice(next, 1);
		}
	}
	return ordered;
}

type TimedLeg = LegTimes & { origin: string; destination: string };

/**
 * True when `leg` is in the air at the same time as one of `others`. Only
 * two legs with a departure and an arrival each give an answer: a leg with
 * no times overlaps nothing. `zone` gives the time zone of an airport.
 */
export function overlapsLeg(
	leg: TimedLeg,
	others: readonly TimedLeg[],
	zone: (code: string) => string | undefined,
): boolean {
	const span = (l: TimedLeg) => {
		const from = zone(l.origin);
		const to = zone(l.destination);
		const { departure, arrival } =
			from && to
				? legInstants(l, from, to)
				: { departure: null, arrival: null };
		return departure !== null && arrival !== null
			? { departure, arrival }
			: null;
	};
	const mine = span(leg);
	return (
		mine !== null &&
		others.some((other) => {
			const theirs = span(other);
			return (
				theirs !== null &&
				mine.departure < theirs.arrival &&
				theirs.departure < mine.arrival
			);
		})
	);
}
