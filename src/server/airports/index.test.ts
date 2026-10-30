import { describe, expect, it } from "vitest";
import data from "./airports.json";
import { airports } from "./index.ts";
import type { AirportRow } from "./rows.ts";

/** These tests read the real file, not a fixture. */
describe("airports.json", () => {
	it("holds the closed airports of the past", () => {
		expect(airports.get("TXL")?.city).toBe("Berlin");
	});

	it("holds the airports that only OurAirports gives", () => {
		expect(airports.get("BCU")?.tz).toBe("Africa/Lagos");
	});

	it("gives a valid IANA time zone to each airport", () => {
		const zones = new Set((data as AirportRow[]).map((row) => row[6]));
		const invalid = [...zones].filter((zone) => {
			try {
				new Intl.DateTimeFormat("en", { timeZone: zone });
				return false;
			} catch {
				return true;
			}
		});

		expect(invalid).toEqual([]);
	});

	it("holds each code one time only", () => {
		const codes = (data as AirportRow[]).map((row) => row[0]);

		expect(new Set(codes).size).toBe(codes.length);
	});

	it("finds Fiumicino", () => {
		expect(airports.search("fiumicino")[0]?.iata).toBe("FCO");
	});
});
