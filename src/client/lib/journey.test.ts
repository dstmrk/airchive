import { describe, expect, it } from "vitest";
import type { Airport } from "../../shared/airport.ts";
import type { FlightView } from "../../shared/flight.ts";
import type { JourneyView } from "../../shared/journey.ts";
import { journeyChains, journeyTitle } from "./journey.ts";

const airport = (iata: string, city: string): Airport => ({
	iata,
	name: `${city} airport`,
	city,
	country: "XX",
	lat: 0,
	lon: 0,
	tz: "UTC",
});

function leg(origin: string, destination: string, city?: string): FlightView {
	return {
		id: `${origin}-${destination}`,
		journeyId: "j1",
		airlineCode: "EY",
		flightNumber: "88",
		airlineName: null,
		origin,
		destination,
		departureDate: "2024-05-12",
		departureTime: null,
		arrivalDate: null,
		arrivalTime: null,
		seat: null,
		cabinClass: null,
		passengerName: null,
		bookingReference: null,
		accentColor: null,
		originAirport: null,
		destinationAirport: city ? airport(destination, city) : null,
	};
}

const journey = (
	flights: FlightView[],
	title: string | null = null,
): JourneyView => ({ id: "j1", title, flights });

describe("journeyTitle", () => {
	it("gives the title of the person", () => {
		expect(
			journeyTitle(
				journey([leg("FCO", "NRT", "Tokyo")], "Japan"),
				"My trip to",
			),
		).toBe("Japan");
	});

	it("gives the default with the city of the final destination", () => {
		const legs = [leg("TRN", "FCO", "Rome"), leg("FCO", "NRT", "Tokyo")];

		expect(journeyTitle(journey(legs), "My trip to")).toBe("My trip to Tokyo");
	});

	it("gives the code when the dataset has no airport", () => {
		expect(journeyTitle(journey([leg("FCO", "XXX")]), "My trip to")).toBe(
			"My trip to XXX",
		);
	});
});

describe("journeyChains", () => {
	it("gives one chain of codes for connected legs", () => {
		const legs = [leg("TRN", "FCO"), leg("FCO", "AUH"), leg("AUH", "NRT")];

		expect(journeyChains(legs)).toEqual([["TRN", "FCO", "AUH", "NRT"]]);
	});

	it("starts a new chain where the next leg departs from another airport", () => {
		const legs = [leg("TRN", "LHR"), leg("LGW", "NRT")];

		expect(journeyChains(legs)).toEqual([
			["TRN", "LHR"],
			["LGW", "NRT"],
		]);
	});

	it("gives no chain for no legs", () => {
		expect(journeyChains([])).toEqual([]);
	});
});
