import { describe, expect, it } from "vitest";
import { fillText, formatCountdown, formatDate, formatUnit } from "./format.ts";

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

describe("formatCountdown", () => {
	const SECOND = 1000;
	const MINUTE = 60 * SECOND;

	it("gives the seconds in the last minute, with the singular and the plural", () => {
		expect(formatCountdown(45 * SECOND, "en")).toBe("45 seconds");
		expect(formatCountdown(SECOND, "en")).toBe("1 second");
		expect(formatCountdown(45 * SECOND, "it")).toBe("45 secondi");
		expect(formatCountdown(SECOND, "it")).toBe("1 secondo");
	});

	it("gives whole minutes, rounded up, below one hour", () => {
		expect(formatCountdown(MINUTE, "en")).toBe("1 minute");
		expect(formatCountdown(MINUTE + SECOND, "en")).toBe("2 minutes");
		expect(formatCountdown(59.5 * SECOND, "en")).toBe("1 minute");
		expect(formatCountdown(MINUTE, "it")).toBe("1 minuto");
		expect(formatCountdown(21 * MINUTE, "it")).toBe("21 minuti");
	});

	it("gives the hours and the minutes from one hour", () => {
		expect(formatCountdown(80 * MINUTE, "en")).toBe("1 hour, 20 minutes");
		expect(formatCountdown(80 * MINUTE, "it")).toBe("1 ora e 20 minuti");
		expect(formatCountdown(120 * MINUTE, "en")).toBe("2 hours");
		expect(formatCountdown(120 * MINUTE, "it")).toBe("2 ore");
		expect(formatCountdown(119.5 * MINUTE, "it")).toBe("2 ore");
	});

	it("gives 0 seconds for no time or a negative time", () => {
		expect(formatCountdown(0, "en")).toBe("0 seconds");
		expect(formatCountdown(-5 * SECOND, "en")).toBe("0 seconds");
	});
});

describe("fillText", () => {
	it("puts each value in the place of its name", () => {
		expect(fillText("Take-off in {time}", { time: "5 minutes" })).toBe(
			"Take-off in 5 minutes",
		);
	});

	it("keeps a name with no value", () => {
		expect(fillText("In {time}", {})).toBe("In {time}");
	});
});
