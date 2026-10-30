import { describe, expect, it } from "vitest";
import type { FlightView } from "../../shared/flight.ts";
import {
	emptyForm,
	formFromFlight,
	issuesByField,
	toPayload,
} from "./flight-form.ts";

const JOURNEY = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";

const filled = {
	...emptyForm(),
	designator: "az 784",
	origin: "FCO",
	destination: "NRT",
	departureDate: "2024-05-12",
	departureTime: "13:05",
	seat: "14a",
	cabinClass: "economy",
};

describe("toPayload", () => {
	it("gives the flight for the API, with the designator in two fields", () => {
		const result = toPayload(filled);

		expect(result).toEqual({
			flight: expect.objectContaining({
				airlineCode: "AZ",
				flightNumber: "784",
				origin: "FCO",
				seat: "14A",
				arrivalTime: null,
				passengerName: null,
			}),
		});
	});

	it("gives no journey for a new journey, thus the API starts one", () => {
		expect(toPayload(filled)).toEqual({
			flight: expect.objectContaining({ journeyId: null }),
		});
	});

	it("gives the journey that the person chose", () => {
		expect(toPayload({ ...filled, journeyId: JOURNEY })).toEqual({
			flight: expect.objectContaining({ journeyId: JOURNEY }),
		});
	});

	it("gives an issue on the designator for a text that is not a flight", () => {
		const result = toPayload({ ...filled, designator: "784" });

		expect(result).toEqual({ issues: { designator: "invalid" } });
	});

	it("gives the issues of the schema by field", () => {
		const result = toPayload({
			...filled,
			destination: "FCO",
			departureDate: "",
		});

		expect(result).toEqual({
			issues: { destination: "same_airport", departureDate: "invalid" },
		});
	});
});

describe("formFromFlight", () => {
	it("gives back the same values for the form", () => {
		const flight: FlightView = {
			id: "1",
			journeyId: JOURNEY,
			airlineCode: "AZ",
			flightNumber: "784",
			airlineName: "ITA Airways",
			origin: "FCO",
			destination: "NRT",
			departureDate: "2024-05-12",
			departureTime: null,
			arrivalDate: null,
			arrivalTime: null,
			seat: null,
			cabinClass: null,
			passengerName: null,
			bookingReference: null,
			accentColor: "#00205b",
			originAirport: null,
			destinationAirport: null,
		};

		const form = formFromFlight(flight);

		expect(form.designator).toBe("AZ 784");
		expect(form.airlineName).toBe("ITA Airways");
		expect(form.departureTime).toBe("");
		expect(form.accentColor).toBe("#00205b");
		expect(form.journeyId).toBe(JOURNEY);
		expect(toPayload(form)).toEqual({
			flight: expect.objectContaining({
				airlineCode: "AZ",
				departureTime: null,
				accentColor: "#00205b",
				journeyId: JOURNEY,
			}),
		});
	});
});

describe("issuesByField", () => {
	it("puts the issues of the airline code and of the number on the designator", () => {
		expect(
			issuesByField([
				{ path: ["flightNumber"], message: "Invalid string" },
				{ path: ["destination"], message: "unknown_airport" },
				{ path: [], message: "invalid_json" },
			]),
		).toEqual({ designator: "invalid", destination: "unknown_airport" });
	});

	it("keeps the issue of a journey that does not exist", () => {
		expect(
			issuesByField([{ path: ["journeyId"], message: "unknown_journey" }]),
		).toEqual({ journeyId: "unknown_journey" });
	});

	it("keeps the first issue of a field", () => {
		expect(
			issuesByField([
				{ path: ["origin"], message: "unknown_airport" },
				{ path: ["origin"], message: "Invalid string" },
			]),
		).toEqual({ origin: "unknown_airport" });
	});
});
