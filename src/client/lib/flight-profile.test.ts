import { describe, expect, it } from "vitest";
import {
	CLIMB_MS,
	CRUISE_ALTITUDE_M,
	DESCENT_MS,
	flightProfile,
	momentAt,
} from "./flight-profile.ts";

const HOUR = 3_600_000;
const MINUTE = 60_000;

// Rome to Tokyo in 12 hours, and Rome to Milan in 1 hour.
const long = flightProfile(9850, 12 * HOUR);
const short = flightProfile(480, HOUR);

describe("flightProfile", () => {
	it("climbs to the cruise altitude on a long flight", () => {
		expect(long.cruiseAltitudeM).toBe(CRUISE_ALTITUDE_M);
		expect(long.climbMs).toBeCloseTo(CLIMB_MS, -3);
		expect(long.descentMs).toBeCloseTo(DESCENT_MS, -3);
	});

	it("gives a cruise speed of an airliner", () => {
		expect(long.cruiseKmh).toBeGreaterThan(800);
		expect(long.cruiseKmh).toBeLessThan(900);
		expect(short.cruiseKmh).toBeGreaterThan(650);
		expect(short.cruiseKmh).toBeLessThan(800);
	});

	it("keeps a lower altitude on a short flight", () => {
		const hop = flightProfile(150, 30 * MINUTE);

		expect(hop.cruiseAltitudeM).toBeLessThan(CRUISE_ALTITUDE_M);
		expect(hop.cruiseAltitudeM).toBeGreaterThan(3000);
	});

	it("keeps a third of the flight for the cruise", () => {
		for (const profile of [long, short, flightProfile(150, 30 * MINUTE)]) {
			expect(profile.climbMs + profile.descentMs).toBeLessThanOrEqual(
				(profile.durationMs * 2) / 3 + 1,
			);
		}
	});
});

describe("momentAt", () => {
	it("starts at the origin, with no speed and no altitude", () => {
		expect(momentAt(long, 0)).toEqual({
			fraction: 0,
			remainingKm: 9850,
			speedKmh: 0,
			altitudeM: 0,
		});
	});

	it("ends at the destination, with no speed and no altitude", () => {
		const end = momentAt(long, 1);

		expect(end.fraction).toBeCloseTo(1, 9);
		expect(end.remainingKm).toBeCloseTo(0, 6);
		expect(end.speedKmh).toBe(0);
		expect(end.altitudeM).toBe(0);
	});

	it("increases the speed and the altitude linearly during the climb", () => {
		const quarter = momentAt(long, long.climbMs / 4 / long.durationMs);
		const half = momentAt(long, long.climbMs / 2 / long.durationMs);

		expect(half.speedKmh).toBeCloseTo(2 * quarter.speedKmh, -1);
		expect(half.altitudeM).toBeCloseTo(CRUISE_ALTITUDE_M / 2, -1);
	});

	it("decreases the speed and the altitude linearly during the descent", () => {
		const left = (ms: number) => 1 - ms / long.durationMs;
		const half = momentAt(long, left(long.descentMs / 2));

		expect(half.speedKmh).toBeCloseTo(long.cruiseKmh / 2, -1);
		expect(half.altitudeM).toBeCloseTo(CRUISE_ALTITUDE_M / 2, -1);
	});

	it("keeps the cruise speed and altitude in the middle of the flight", () => {
		const middle = momentAt(long, 0.5);

		expect(middle.speedKmh).toBe(Math.round(long.cruiseKmh));
		expect(middle.altitudeM).toBe(CRUISE_ALTITUDE_M);
	});

	it("moves slowly near the airports and quickly at the cruise", () => {
		const step = 0.01;
		const start = momentAt(long, step).fraction;
		const middle =
			momentAt(long, 0.5 + step).fraction - momentAt(long, 0.5).fraction;

		expect(start).toBeLessThan(middle / 2);
	});

	it("never goes back along the route", () => {
		let previous = 0;
		for (let i = 1; i <= 1000; i += 1) {
			const { fraction } = momentAt(short, i / 1000);
			expect(fraction).toBeGreaterThanOrEqual(previous);
			previous = fraction;
		}
	});

	it("gives the altitude in steps of 10 m and the speed in steps of 1 km/h", () => {
		const moment = momentAt(short, 0.123);

		expect(moment.altitudeM % 10).toBe(0);
		expect(Number.isInteger(moment.speedKmh)).toBe(true);
	});

	it("keeps t in the range from 0 to 1", () => {
		expect(momentAt(long, -1)).toEqual(momentAt(long, 0));
		expect(momentAt(long, 2)).toEqual(momentAt(long, 1));
	});

	it("gives numbers for a flight to the same airport", () => {
		const loop = flightProfile(0, HOUR);

		expect(momentAt(loop, 0.5)).toMatchObject({
			fraction: 0.5,
			remainingKm: 0,
			speedKmh: 0,
		});
	});

	it("gives the destination for a flight with no duration", () => {
		expect(momentAt(flightProfile(480, 0), 0.5)).toEqual({
			fraction: 1,
			remainingKm: 0,
			speedKmh: 0,
			altitudeM: 0,
		});
	});
});
