import { describe, expect, it } from "vitest";
import { formatDate, formatUnit } from "./format.ts";

describe("formatDate", () => {
	it("writes the day of the boarding pass, with no change of time zone", () => {
		// A conversion to the zone of the browser can move 2024-05-12 to the 11th.
		expect(formatDate("2024-05-12", "en")).toBe("May 12, 2024");
	});

	it("uses the locale", () => {
		expect(formatDate("2024-05-12", "it")).toBe("12 mag 2024");
	});
});

describe("formatUnit", () => {
	it("writes a distance, a speed and an altitude", () => {
		expect(formatUnit(10668, "kilometer", "en")).toBe("10,668 km");
		expect(formatUnit(850, "kilometer-per-hour", "en")).toBe("850 km/h");
		expect(formatUnit(980, "meter", "en")).toBe("980 m");
	});

	it("uses the locale", () => {
		expect(formatUnit(10668, "meter", "it")).toBe("10.668 m");
	});

	it("writes no decimals", () => {
		expect(formatUnit(12.6, "kilometer", "en")).toBe("13 km");
	});
});
