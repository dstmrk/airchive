import { describe, expect, it } from "vitest";
import { bcbpToForm } from "./to-form.ts";

/** A BCBP leg of 60 characters: Rome to Tokyo, AZ 784, day 133, seat 14A. */
const BCBP = "M1TRAVELER/ALEX MR    EK7Q2XD FCONRTAZ 0784 133Y014A0042 100";

describe("bcbpToForm", () => {
	it("gives the values of the barcode, with the most recent date of the day", () => {
		expect(bcbpToForm(BCBP, "2024-06-01")).toEqual({
			designator: "AZ 784",
			origin: "FCO",
			destination: "NRT",
			departureDate: "2024-05-12",
			seat: "14A",
			cabinClass: "economy",
			passengerName: "ALEX TRAVELER",
			bookingReference: "K7Q2XD",
		});
	});

	it("puts a day after today in the previous year", () => {
		expect(bcbpToForm(BCBP, "2024-03-01")?.departureDate).toBe("2023-05-13");
	});

	it("gives no value that the barcode does not have", () => {
		const values = bcbpToForm(
			BCBP.replace("133Y014A", "133Q    "),
			"2024-06-01",
		);

		expect(values).not.toHaveProperty("seat");
		expect(values).not.toHaveProperty("cabinClass");
	});

	it.each([
		["a text that is not a boarding pass", "https://example.com/ticket"],
		["an empty text", ""],
	])("gives null for %s", (_label, text) => {
		expect(bcbpToForm(text, "2024-06-01")).toBeNull();
	});
});
