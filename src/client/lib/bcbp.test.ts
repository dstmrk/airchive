import { describe, expect, it } from "vitest";
import { dateFromJulian, parseBcbp } from "./bcbp.ts";

/** One leg, built field by field with the widths of IATA Resolution 792. */
function bcbp({
	name = "TRAVELER/ALEX MR",
	pnr = "K7Q2XD",
	from = "FCO",
	to = "NRT",
	carrier = "AZ",
	flight = "0784",
	julian = "133",
	compartment = "Y",
	seat = "014A",
} = {}): string {
	return [
		"M1",
		name.padEnd(20),
		"E",
		pnr.padEnd(7),
		from,
		to,
		carrier.padEnd(3),
		flight.padEnd(5),
		julian,
		compartment,
		seat.padStart(4, "0"),
		"0042 ",
		"1",
		"00",
	].join("");
}

describe("parseBcbp", () => {
	it("reads the fields of the first leg", () => {
		expect(parseBcbp(bcbp())).toEqual({
			passengerName: "ALEX TRAVELER",
			bookingReference: "K7Q2XD",
			origin: "FCO",
			destination: "NRT",
			airlineCode: "AZ",
			flightNumber: "784",
			dayOfYear: 133,
			cabinClass: "economy",
			seat: "14A",
		});
	});

	it("keeps a letter after the flight number", () => {
		expect(parseBcbp(bcbp({ flight: "0400A" }))?.flightNumber).toBe("400A");
	});

	it("gives a name with no slash as it is", () => {
		expect(parseBcbp(bcbp({ name: "TRAVELER" }))?.passengerName).toBe(
			"TRAVELER",
		);
	});

	it.each([
		["F", "first"],
		["J", "business"],
		["C", "business"],
		["W", "premium_economy"],
		["Y", "economy"],
		["Q", null],
	])("reads the compartment %s as %s", (compartment, expected) => {
		expect(parseBcbp(bcbp({ compartment }))?.cabinClass).toBe(expected);
	});

	it.each([
		["a seat for an infant", "INF"],
		["no seat", "   "],
	])("gives no seat for %s", (_label, seat) => {
		expect(parseBcbp(bcbp({ seat }))?.seat).toBeNull();
	});

	it.each([
		["a text that is too short", "M1TRAVELER"],
		["a format code that is not M", `S${bcbp().slice(1)}`],
		["airports that are not three letters", bcbp({ from: "F1O" })],
		["a day of the year out of range", bcbp({ julian: "400" })],
		["a day of the year that is not a number", bcbp({ julian: "ABC" })],
	])("gives null for %s", (_label, text) => {
		expect(parseBcbp(text)).toBeNull();
	});
});

describe("dateFromJulian", () => {
	it("gives the day in the year of the reference date", () => {
		expect(dateFromJulian(133, "2024-06-01")).toBe("2024-05-12");
	});

	it("takes the previous year when the day is after the reference date", () => {
		// A pass of December, imported in January.
		expect(dateFromJulian(350, "2025-01-10")).toBe("2024-12-15");
	});

	it("counts the 29th of February in a leap year", () => {
		expect(dateFromJulian(60, "2024-12-31")).toBe("2024-02-29");
		expect(dateFromJulian(60, "2023-12-31")).toBe("2023-03-01");
	});

	it("gives the reference day itself", () => {
		expect(dateFromJulian(1, "2024-01-01")).toBe("2024-01-01");
	});

	it("takes the previous year for day 366 when the year of the reference has no 29th of February", () => {
		expect(dateFromJulian(366, "2025-03-01")).toBe("2024-12-31");
	});
});
