import { describe, expect, it } from "vitest";
import type { FlightView } from "../../shared/flight.ts";
import { arrivalDayOffset, passDate, passView } from "./pass.ts";

const flight: FlightView = {
	id: "1",
	journeyId: "j1",
	airlineCode: "AZ",
	flightNumber: "784",
	airlineName: "ITA Airways",
	origin: "FCO",
	destination: "NRT",
	departureDate: "2024-05-12",
	departureTime: "13:05",
	arrivalDate: "2024-05-13",
	arrivalTime: "09:10",
	seat: "14A",
	cabinClass: "economy",
	passengerName: "Alex Traveler",
	bookingReference: "K7Q2XD",
	accentColor: null,
	originAirport: {
		iata: "FCO",
		name: "Fiumicino",
		city: "Rome",
		country: "IT",
		lat: 41.8,
		lon: 12.25,
		tz: "Europe/Rome",
	},
	destinationAirport: {
		iata: "NRT",
		name: "Narita",
		city: "Tokyo",
		country: "JP",
		lat: 35.76,
		lon: 140.39,
		tz: "Asia/Tokyo",
	},
};

describe("passDate", () => {
	it("writes the day, the short month in capitals and the year", () => {
		expect(passDate("2024-05-12", "en")).toEqual({
			full: "12 MAY 2024",
			short: "12 MAY",
		});
	});

	it("writes a day of one digit with two digits", () => {
		expect(passDate("2024-01-05", "en").full).toBe("05 JAN 2024");
	});

	it("uses the month of the locale", () => {
		expect(passDate("2024-05-12", "it").full).toBe("12 MAG 2024");
	});

	it("keeps the day of the boarding pass in each time zone", () => {
		// A conversion to the zone of the browser can move the 1st to the 31st.
		expect(passDate("2024-01-01", "en").full).toBe("01 JAN 2024");
	});
});

describe("arrivalDayOffset", () => {
	it.each([
		["2024-05-12", "2024-05-12", 0],
		["2024-05-12", "2024-05-13", 1],
		["2024-05-12", "2024-05-14", 2],
		["2024-12-31", "2025-01-01", 1],
		["2024-02-28", "2024-03-01", 2],
		["2024-05-12", null, 0],
	])("gives the days from %s to %s", (departure, arrival, expected) => {
		expect(arrivalDayOffset(departure, arrival)).toBe(expected);
	});
});

describe("passView", () => {
	it("gives the texts of the pass", () => {
		expect(passView(flight, "en")).toEqual({
			designator: "AZ 784",
			airlineName: "ITA Airways",
			origin: { code: "FCO", city: "Rome" },
			destination: { code: "NRT", city: "Tokyo" },
			date: "12 MAY 2024",
			shortDate: "12 MAY",
			departureTime: "13:05",
			arrivalTime: "09:10",
			arrivalOffset: "+1",
			seat: "14A",
			cabinClass: "economy",
			passengerName: "ALEX TRAVELER",
			bookingReference: "K7Q2XD",
			accent: null,
		});
	});

	it("uses the colour of the airline as the accent when it is dark enough", () => {
		expect(passView({ ...flight, accentColor: "#00205b" }, "en").accent).toBe(
			"#00205b",
		);
	});

	it("keeps the default accent for a pale colour of the airline", () => {
		expect(
			passView({ ...flight, accentColor: "#ffffff" }, "en").accent,
		).toBeNull();
	});

	it("gives null for each value that the flight does not have", () => {
		const view = passView(
			{
				...flight,
				airlineName: null,
				departureTime: null,
				arrivalDate: null,
				arrivalTime: null,
				seat: null,
				cabinClass: null,
				passengerName: null,
				bookingReference: null,
			},
			"en",
		);

		expect(view).toMatchObject({
			airlineName: null,
			departureTime: null,
			arrivalTime: null,
			arrivalOffset: null,
			seat: null,
			cabinClass: null,
			passengerName: null,
			bookingReference: null,
		});
	});

	it("gives no offset for an arrival on the same day", () => {
		expect(
			passView({ ...flight, arrivalDate: "2024-05-12" }, "en").arrivalOffset,
		).toBeNull();
	});

	it("gives an offset with no arrival time when the date changes", () => {
		expect(passView({ ...flight, arrivalTime: null }, "en").arrivalOffset).toBe(
			"+1",
		);
	});

	it("uses the code as the city when the airport is not known", () => {
		expect(passView({ ...flight, originAirport: null }, "en").origin).toEqual({
			code: "FCO",
			city: "FCO",
		});
	});
});
