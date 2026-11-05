import { describe, expect, it } from "vitest";
import {
	CRUISE_ALTITUDE_M,
	type FlightProfile,
	flightProfile,
	momentAt,
	TAXI_MS,
} from "./flight-profile.ts";

const HOUR = 3_600_000;
const MINUTE = 60_000;
const SECOND = 1000;

// Rome to Tokyo in 12 hours, and Rome to Milan in 1 hour.
const long = flightProfile(9850, 12 * HOUR);
const short = flightProfile(480, HOUR);
const hop = flightProfile(150, 30 * MINUTE);

/** The moment `ms` after the departure from the gate. */
const sinceGate = (profile: FlightProfile, ms: number) =>
	momentAt(profile, ms / profile.durationMs);
/** The moment `ms` before the arrival at the gate. */
const untilGate = (profile: FlightProfile, ms: number) =>
	momentAt(profile, 1 - ms / profile.durationMs);

/** The last point on the ground before the climb, and the first one after the descent. */
function runway(profile: FlightProfile) {
	const { points } = profile;
	const liftOff = points.find(
		(point, i) => point.altitudeM === 0 && (points[i + 1]?.altitudeM ?? 0) > 0,
	);
	const touchdown = points.findLast(
		(point, i) => point.altitudeM === 0 && (points[i - 1]?.altitudeM ?? 0) > 0,
	);
	return { liftOff, touchdown };
}

/** The time of the first moment at `altitudeM` or higher, from the gate. */
function reaches(profile: FlightProfile, altitudeM: number): number {
	for (let ms = 0; ms <= profile.durationMs; ms += SECOND) {
		if (sinceGate(profile, ms).altitudeM >= altitudeM) {
			return ms;
		}
	}
	return Number.POSITIVE_INFINITY;
}

describe("flightProfile", () => {
	it("climbs to the cruise altitude on a long flight", () => {
		expect(long.cruiseAltitudeM).toBe(CRUISE_ALTITUDE_M);
	});

	it("gives a cruise speed of an airliner", () => {
		expect(momentAt(long, 0.5).speedKmh).toBeGreaterThan(800);
		expect(momentAt(long, 0.5).speedKmh).toBeLessThan(900);
		// The taxi of one minute gives the rest of the time at the gate to the air.
		expect(momentAt(short, 0.5).speedKmh).toBeGreaterThanOrEqual(540);
		expect(momentAt(short, 0.5).speedKmh).toBeLessThan(800);
	});

	it("keeps a lower altitude on a short flight", () => {
		expect(hop.cruiseAltitudeM).toBeLessThan(CRUISE_ALTITUDE_M);
		expect(hop.cruiseAltitudeM).toBeGreaterThan(3000);
	});

	it("keeps a third of the time in the air for the cruise", () => {
		for (const profile of [long, short, hop]) {
			const top = profile.points.filter(
				(point) => point.altitudeM === profile.cruiseAltitudeM,
			);
			const cruiseMs = (top.at(-1)?.ms ?? 0) - (top[0]?.ms ?? 0);
			const { liftOff, touchdown } = runway(profile);
			const airMs = (touchdown?.ms ?? 0) - (liftOff?.ms ?? 0);

			expect(cruiseMs).toBeGreaterThanOrEqual(airMs / 3 - 1);
		}
	});

	it("makes the distance of the profile equal to the distance of the route", () => {
		for (const profile of [long, short, hop]) {
			expect(profile.points.at(-1)?.km).toBeCloseTo(profile.distanceKm, 6);
		}
	});
});

describe("momentAt", () => {
	it("starts at the gate, with no speed and no altitude", () => {
		expect(momentAt(long, 0)).toEqual({
			fraction: 0,
			remainingKm: 9850,
			speedKmh: 0,
			altitudeM: 0,
		});
	});

	it("ends at the gate, with no speed and no altitude", () => {
		const end = momentAt(long, 1);

		expect(end.fraction).toBeCloseTo(1, 9);
		expect(end.remainingKm).toBeCloseTo(0, 6);
		expect(end.speedKmh).toBe(0);
		expect(end.altitudeM).toBe(0);
	});

	it("taxis for one minute at each airport", () => {
		for (const moment of [
			sinceGate(long, 30 * SECOND),
			untilGate(long, 30 * SECOND),
		]) {
			expect(moment.speedKmh).toBe(30);
			expect(moment.altitudeM).toBe(0);
		}
	});

	it("lifts off at the speed of an airliner after the take-off run", () => {
		const run = sinceGate(long, TAXI_MS + 34 * SECOND);

		expect(run.altitudeM).toBe(0);
		expect(run.speedKmh).toBeGreaterThan(250);
		expect(sinceGate(long, TAXI_MS + 60 * SECOND).altitudeM).toBeGreaterThan(0);
	});

	it("gives the time at the gate to the taxi, not to the cruise", () => {
		// Rome to Paris, 1,100 km in 2 h 10 min from gate to gate.
		const paris = flightProfile(1100, 130 * MINUTE);
		const { liftOff, touchdown } = runway(paris);
		const taxiOut = (liftOff?.ms ?? 0) - 35 * SECOND;
		const taxiIn = paris.durationMs - (touchdown?.ms ?? 0) - 30 * SECOND;

		expect(momentAt(paris, 0.5).speedKmh).toBeGreaterThan(700);
		expect(taxiOut).toBeGreaterThan(taxiIn);
		expect(taxiIn).toBeGreaterThan(TAXI_MS);
		expect(taxiOut + taxiIn).toBeLessThanOrEqual(paris.durationMs / 4);
		expect(Math.round(liftOff?.kmh ?? 0)).toBe(280);
		expect(Math.round(touchdown?.kmh ?? 0)).toBe(260);
		expect(sinceGate(paris, taxiOut / 2).speedKmh).toBe(30);
	});

	it("keeps the taxi of one minute when the flight needs all its time", () => {
		const { liftOff } = runway(long);

		expect(liftOff?.ms).toBeCloseTo(TAXI_MS + 35 * SECOND, -1);
	});

	it("slows all the speeds in the air when the cruise is too slow", () => {
		const slow = flightProfile(1000, 4 * HOUR);
		const liftOff = runway(slow).liftOff?.kmh ?? 0;

		expect(liftOff).toBeLessThan(280);
		expect(momentAt(slow, 0.5).speedKmh / liftOff).toBeCloseTo(540 / 280, 1);
		expect(sinceGate(slow, 30 * SECOND).speedKmh).toBe(30);
		expect(momentAt(slow, 1).fraction).toBeCloseTo(1, 9);
	});

	it("is near 280 km/h one minute after the gate, not near 30 km/h", () => {
		expect(sinceGate(long, TAXI_MS + 30 * SECOND).speedKmh).toBeGreaterThan(
			200,
		);
	});

	it("climbs quickly at a low altitude and slowly near the cruise", () => {
		const low = reaches(long, 3000) - reaches(long, 1000);
		const high = reaches(long, 11_000) - reaches(long, 9000);

		expect(low).toBeLessThan(high);
	});

	it("is at FL100 after approximately 5 minutes, near 250 kt", () => {
		const fl100 = reaches(long, 3050);

		expect(fl100).toBeGreaterThan(TAXI_MS + 4 * MINUTE);
		expect(fl100).toBeLessThan(TAXI_MS + 7 * MINUTE);
		expect(sinceGate(long, fl100).speedKmh).toBeGreaterThan(480);
		expect(sinceGate(long, fl100).speedKmh).toBeLessThan(600);
	});

	it("is at the cruise altitude after approximately 20 minutes", () => {
		const top = reaches(long, CRUISE_ALTITUDE_M);

		expect(top).toBeGreaterThan(18 * MINUTE);
		expect(top).toBeLessThan(26 * MINUTE);
	});

	it("touches down at the speed of an airliner, then brakes to the taxi", () => {
		const touchdown = TAXI_MS + 30 * SECOND;
		const air = untilGate(long, touchdown + 20 * SECOND);
		const ground = untilGate(long, touchdown - SECOND);

		expect(air.altitudeM).toBeGreaterThan(0);
		expect(air.altitudeM).toBeLessThan(100);
		expect(ground.altitudeM).toBe(0);
		expect(ground.speedKmh).toBeGreaterThan(200);
		expect(untilGate(long, TAXI_MS).speedKmh).toBe(30);
	});

	it("changes the speed smoothly near the airports", () => {
		for (const profile of [long, short, hop]) {
			let previous = 0;
			for (let ms = 0; ms <= 5 * MINUTE; ms += SECOND) {
				const { speedKmh } = sinceGate(profile, ms);
				expect(Math.abs(speedKmh - previous)).toBeLessThanOrEqual(10);
				previous = speedKmh;
			}
		}
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
		for (const profile of [long, short, hop, flightProfile(480, 2 * MINUTE)]) {
			let previous = 0;
			for (let i = 1; i <= 1000; i += 1) {
				const { fraction } = momentAt(profile, i / 1000);
				expect(fraction).toBeGreaterThanOrEqual(previous);
				previous = fraction;
			}
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

	it("shortens the taxi of a flight of a few minutes", () => {
		const tiny = flightProfile(20, 4 * MINUTE);

		expect(momentAt(tiny, 0.5).altitudeM).toBeGreaterThan(0);
		expect(momentAt(tiny, 1).fraction).toBeCloseTo(1, 9);
		expect(tiny.points.every((point) => Number.isFinite(point.km))).toBe(true);
	});

	it("arrives at the destination when the taxi is longer than the route", () => {
		const near = flightProfile(0.2, HOUR);

		expect(momentAt(near, 1).fraction).toBe(1);
		expect(momentAt(near, 1).remainingKm).toBe(0);
	});
});
