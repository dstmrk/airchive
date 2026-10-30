import type { Airport } from "../../shared/airport.ts";
import { type FlightView, UUID } from "../../shared/flight.ts";
import type { JourneyView } from "../../shared/journey.ts";
import { legInstants, zonedInstant } from "../../shared/zoned-time.ts";
import type { FlightFormValues } from "./flight-form.ts";

/**
 * The title of a journey. With no title of the person, the default is
 * `prefix` and the city of the final destination: "My trip to Tokyo". The
 * catalogue gives the prefix, thus the default follows the language.
 */
export function journeyTitle(journey: JourneyView, prefix: string): string {
	const last = journey.flights.at(-1);
	if (journey.title !== null || last === undefined) {
		return journey.title ?? "";
	}
	return `${prefix} ${last.destinationAirport?.city ?? last.destination}`;
}

/**
 * The codes of the airports, one chain for each part of the journey that is
 * connected. A leg that departs from another airport than the arrival of the
 * previous leg (London Heathrow, then Gatwick) starts a new chain.
 */
export function journeyChains(
	legs: readonly Pick<FlightView, "origin" | "destination">[],
): string[][] {
	const chains: string[][] = [];
	for (const leg of legs) {
		const last = chains.at(-1);
		if (last !== undefined && last.at(-1) === leg.origin) {
			last.push(leg.destination);
		} else {
			chains.push([leg.origin, leg.destination]);
		}
	}
	return chains;
}

export type NewFlightSearch = { journey?: string };

/** The search of the page of a new flight: `journey` adds the flight to that journey. */
export function newFlightSearch(
	search: Record<string, unknown>,
): NewFlightSearch {
	return typeof search.journey === "string" && UUID.test(search.journey)
		? { journey: search.journey }
		: {};
}

/**
 * The values of the next leg of a journey: it departs from the last
 * destination, on the day of the last arrival.
 */
export function nextLegValues(journey: JourneyView): {
	values: Partial<FlightFormValues>;
	airports: { origin: Airport | null; destination: Airport | null };
} {
	const last = journey.flights.at(-1);
	return {
		values: {
			journeyId: journey.id,
			origin: last?.destination ?? "",
			departureDate: last ? (last.arrivalDate ?? last.departureDate) : "",
		},
		airports: { origin: last?.destinationAirport ?? null, destination: null },
	};
}

const DAY = 24 * 60 * 60 * 1000;

/** The days from one date "YYYY-MM-DD" to another. */
const daysBetween = (from: string, to: string) =>
	(Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY;

/**
 * The journey that a new flight continues: its last leg lands at the origin
 * of the flight, 24 hours or less before the departure. That is a
 * connection; a longer stop starts a new journey. With the times and the
 * time zone, the hours decide; with dates only, the same day or the next
 * day. The most recent journey wins.
 */
export function suggestJourney(
	journeys: readonly JourneyView[],
	flight: Pick<FlightFormValues, "origin" | "departureDate" | "departureTime">,
): JourneyView | null {
	const origin = flight.origin.trim().toUpperCase();
	if (origin === "" || !/^\d{4}-\d{2}-\d{2}$/.test(flight.departureDate)) {
		return null;
	}
	const continues = (journey: JourneyView) => {
		const last = journey.flights.at(-1);
		if (last?.destination !== origin) {
			return false;
		}
		const zone = last.destinationAirport?.tz;
		const from = last.originAirport?.tz;
		const arrival = zone && from ? legInstants(last, from, zone).arrival : null;
		if (arrival !== null && zone && flight.departureTime) {
			const gap =
				zonedInstant(flight.departureDate, flight.departureTime, zone) -
				arrival;
			return gap >= 0 && gap <= DAY;
		}
		const days = daysBetween(
			last.arrivalDate ?? last.departureDate,
			flight.departureDate,
		);
		return days === 0 || days === 1;
	};
	return journeys.find(continues) ?? null;
}
