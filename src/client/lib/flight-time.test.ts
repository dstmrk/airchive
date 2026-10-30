import { describe, expect, it } from "vitest";
import type { Airport } from "../../shared/airport.ts";
import {
	clockAt,
	durationText,
	estimatedDurationMs,
	flightTiming,
} from "./flight-time.ts";

const airport = (
	iata: string,
	lon: number,
	lat: number,
	tz: string,
): Airport => ({
	iata,
	name: iata,
	city: iata,
	country: "XX",
	lat,
	lon,
	tz,
});
const TRN = airport("TRN", 7.6496, 45.2008, "Europe/Rome");
const MUC = airport("MUC", 11.7861, 48.3538, "Europe/Berlin");
const FCO = airport("FCO", 12.2508, 41.8045, "Europe/Rome");
const NRT = airport("NRT", 140.3864, 35.7647, "Asia/Tokyo");
const LHR = airport("LHR", -0.4543, 51.47, "Europe/London");
const JFK = airport("JFK", -73.7781, 40.6413, "America/New_York");

const hour = 3_600_000;
const minute = 60_000;

describe("clockAt", () => {
	it("gives the local time of an instant at an airport", () => {
		const instant = Date.parse("2024-05-12T11:05:00Z");

		expect(clockAt(instant, "Europe/Rome")).toBe("13:05");
		expect(clockAt(instant, "Asia/Tokyo")).toBe("20:05");
	});
});

describe("estimatedDurationMs", () => {
	it("adds the time of the take-off and the landing to the cruise", () => {
		// 800 km at 800 km/h, plus 30 minutes.
		expect(estimatedDurationMs(800)).toBe(90 * minute);
	});

	it("rounds to five minutes", () => {
		expect(estimatedDurationMs(123) % (5 * minute)).toBe(0);
	});
});

describe("flightTiming", () => {
	const base = {
		departureDate: "2024-05-12",
		departureTime: null,
		arrivalDate: null,
		arrivalTime: null,
	};

	it("uses the times of the pass, with the zone of each airport", () => {
		expect(
			flightTiming({
				...base,
				departureTime: "13:05",
				arrivalDate: "2024-05-13",
				arrivalTime: "09:10",
				originAirport: FCO,
				destinationAirport: NRT,
			}),
		).toEqual({
			durationMs: 13 * hour + 5 * minute,
			departure: Date.parse("2024-05-12T11:05:00Z"),
			estimated: false,
		});
	});

	it("puts an arrival with no date on the next day when its time is earlier", () => {
		expect(
			flightTiming({
				...base,
				departureTime: "18:30",
				arrivalTime: "08:15",
				originAirport: JFK,
				destinationAirport: LHR,
			}).durationMs,
		).toBe(8 * hour + 45 * minute);
	});

	it("estimates the duration when the arrival time is not there", () => {
		const timing = flightTiming({
			...base,
			departureTime: "09:55",
			originAirport: TRN,
			destinationAirport: MUC,
		});

		expect(timing.estimated).toBe(true);
		expect(timing.departure).toBe(Date.parse("2024-05-12T07:55:00Z"));
		expect(timing.durationMs).toBeGreaterThan(45 * minute);
		expect(timing.durationMs).toBeLessThan(90 * minute);
	});

	it("gives no departure instant with no departure time", () => {
		expect(
			flightTiming({ ...base, originAirport: FCO, destinationAirport: NRT }),
		).toMatchObject({ departure: null, estimated: true });
	});

	it("estimates the duration when the times give no real flight", () => {
		const timing = flightTiming({
			...base,
			departureTime: "10:00",
			arrivalDate: "2024-05-12",
			arrivalTime: "10:00",
			originAirport: FCO,
			destinationAirport: NRT,
		});

		expect(timing.estimated).toBe(true);
		expect(timing.durationMs).toBeGreaterThan(10 * hour);
	});
});

describe("durationText", () => {
	it.each([
		[0, "0:00"],
		[5 * minute, "0:05"],
		[13 * hour + 5 * minute, "13:05"],
		[59.6 * 1000, "0:00"],
	])("writes %d ms as %s", (ms, text) => {
		expect(durationText(ms)).toBe(text);
	});
});
