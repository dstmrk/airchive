import { describe, expect, it } from "vitest";
import type { Airport } from "../../shared/airport.ts";
import type { FlightView } from "../../shared/flight.ts";
import type { JourneyView } from "../../shared/journey.ts";
import {
	journeyChains,
	journeyTitle,
	newFlightSearch,
	nextLegValues,
	suggestJourney,
} from "./journey.ts";

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

describe("newFlightSearch", () => {
	const id = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

	it("keeps the identifier of a journey", () => {
		expect(newFlightSearch({ journey: id })).toEqual({ journey: id });
	});

	it.each([[{}], [{ journey: "nope" }], [{ journey: 3 }]])(
		"gives no journey for %o",
		(search) => {
			expect(newFlightSearch(search)).toEqual({});
		},
	);
});

describe("nextLegValues", () => {
	it("departs from the last destination on the day of the last arrival", () => {
		const last = {
			...leg("FCO", "AUH", "Abu Dhabi"),
			arrivalDate: "2024-05-13",
		};

		expect(nextLegValues(journey([leg("TRN", "FCO"), last]))).toEqual({
			values: { journeyId: "j1", origin: "AUH", departureDate: "2024-05-13" },
			airports: { origin: last.destinationAirport, destination: null },
		});
	});

	it("uses the departure date with no arrival date", () => {
		expect(
			nextLegValues(journey([leg("TRN", "FCO")])).values.departureDate,
		).toBe("2024-05-12");
	});
});

describe("suggestJourney", () => {
	const zoned = (iata: string, tz: string): Airport => ({
		...airport(iata, iata),
		tz,
	});
	// FCO 10:45 to AUH 18:30, local times.
	const toAbuDhabi: FlightView = {
		...leg("FCO", "AUH"),
		departureTime: "10:45",
		arrivalDate: "2024-05-12",
		arrivalTime: "18:30",
		originAirport: zoned("FCO", "Europe/Rome"),
		destinationAirport: zoned("AUH", "Asia/Dubai"),
	};
	const trip = journey([toAbuDhabi]);
	const next = (departureDate: string, departureTime = "", origin = "AUH") => ({
		origin,
		departureDate,
		departureTime,
	});

	it("gives the journey that lands at the origin before the departure", () => {
		expect(suggestJourney([trip], next("2024-05-12", "21:50"))).toBe(trip);
	});

	it("gives no journey for a departure before the landing", () => {
		expect(suggestJourney([trip], next("2024-05-12", "17:00"))).toBeNull();
	});

	it("gives no journey for a stop of more than 24 hours", () => {
		expect(suggestJourney([trip], next("2024-05-13", "19:00"))).toBeNull();
		expect(suggestJourney([trip], next("2024-05-13", "18:30"))).toBe(trip);
	});

	it("uses the dates when the new flight has no time", () => {
		expect(suggestJourney([trip], next("2024-05-13"))).toBe(trip);
		expect(suggestJourney([trip], next("2024-05-14"))).toBeNull();
		expect(suggestJourney([trip], next("2024-05-11"))).toBeNull();
	});

	it("gives no journey for another origin, in any case of the letters", () => {
		expect(suggestJourney([trip], next("2024-05-12", "", "auh"))).toBe(trip);
		expect(suggestJourney([trip], next("2024-05-12", "", "DXB"))).toBeNull();
	});

	it("gives no journey with no origin or no valid date", () => {
		expect(suggestJourney([trip], next("2024-05-12", "", ""))).toBeNull();
		expect(suggestJourney([trip], next(""))).toBeNull();
	});

	it("gives the first journey of the list, the most recent", () => {
		const other = { ...trip, id: "j2" };

		expect(suggestJourney([other, trip], next("2024-05-12"))?.id).toBe("j2");
	});
});
