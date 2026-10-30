import type { FlightView } from "../../shared/flight.ts";
import type { JourneyView } from "../../shared/journey.ts";

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
