import { describe, expect, it } from "vitest";
import {
	CRUISE_ALTITUDE_M,
	type FlightProfile,
	flightProfile,
	momentAt,
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

	it("lifts off at the speed of an airliner after the take-off run", () => {
		const run = sinceGate(long, long.gateOutMs + 34 * SECOND);

		expect(run.altitudeM).toBe(0);
		expect(run.speedKmh).toBeGreaterThan(250);
		expect(
			sinceGate(long, long.gateOutMs + 60 * SECOND).altitudeM,
		).toBeGreaterThan(0);
	});

	it("waits at the gate for the rest of the time, with no movement", () => {
		// Rome to Paris, 1,100 km in 2 h 10 min from gate to gate.
		const paris = flightProfile(1100, 130 * MINUTE);
		const { liftOff, touchdown } = runway(paris);
		const out = sinceGate(paris, paris.gateOutMs / 2);
		const back = untilGate(paris, paris.gateInMs / 2);

		expect(paris.gateOutMs).toBeGreaterThan(paris.gateInMs);
		expect(paris.gateInMs).toBeGreaterThan(0);
		expect(paris.gateOutMs + paris.gateInMs + 65 * SECOND).toBeLessThanOrEqual(
			paris.durationMs / 4 + 1,
		);
		expect(liftOff?.ms).toBeCloseTo(paris.gateOutMs + 35 * SECOND, 6);
		expect(touchdown?.ms).toBeCloseTo(
			paris.durationMs - paris.gateInMs - 30 * SECOND,
			6,
		);
		expect(out).toEqual({
			fraction: 0,
			remainingKm: 1100,
			speedKmh: 0,
			altitudeM: 0,
		});
		expect(back.speedKmh).toBe(0);
		expect(back.altitudeM).toBe(0);
		expect(back.fraction).toBeCloseTo(1, 9);
		expect(momentAt(paris, 0.5).speedKmh).toBeGreaterThan(700);
		expect(Math.round(liftOff?.kmh ?? 0)).toBe(280);
		expect(Math.round(touchdown?.kmh ?? 0)).toBe(260);
	});

	it("gives the start of each phase, in order", () => {
		const paris = flightProfile(1100, 130 * MINUTE);
		const starts = Object.fromEntries(
			paris.phases.map((phase) => [phase.id, phase.startMs]),
		);

		expect(paris.phases.map((phase) => phase.id)).toEqual([
			"gateOut",
			"takeOff",
			"climb",
			"cruise",
			"descent",
			"landing",
			"gateIn",
		]);
		expect(starts.gateOut).toBe(0);
		expect(starts.takeOff).toBeCloseTo(paris.gateOutMs, 6);
		expect(sinceGate(paris, starts.climb ?? 0).altitudeM).toBe(900);
		expect(sinceGate(paris, starts.cruise ?? 0).altitudeM).toBe(
			CRUISE_ALTITUDE_M,
		);
		expect(sinceGate(paris, (starts.descent ?? 0) - SECOND).altitudeM).toBe(
			CRUISE_ALTITUDE_M,
		);
		expect(sinceGate(paris, starts.landing ?? 0).altitudeM).toBe(900);
		expect(starts.gateIn).toBeCloseTo(paris.durationMs - paris.gateInMs, 6);
		for (let i = 1; i < paris.phases.length; i += 1) {
			expect(paris.phases[i]?.startMs).toBeGreaterThanOrEqual(
				paris.phases[i - 1]?.startMs ?? 0,
			);
		}
	});

	it("gives a climb with no length to a hop below 900 m", () => {
		const tiny = flightProfile(20, 4 * MINUTE);
		const [, , climb, cruise] = tiny.phases;

		expect(tiny.cruiseAltitudeM).toBeLessThan(900);
		expect(climb?.startMs).toBeCloseTo(cruise?.startMs ?? 0, 6);
	});

	it("does not wait when the flight needs all its time", () => {
		expect(long.gateOutMs).toBe(0);
		expect(long.gateInMs).toBe(0);
	});

	it("slows all the speeds in the air when the cruise is too slow", () => {
		const slow = flightProfile(1000, 4 * HOUR);
		const liftOff = runway(slow).liftOff?.kmh ?? 0;

		expect(liftOff).toBeLessThan(280);
		expect(momentAt(slow, 0.5).speedKmh / liftOff).toBeCloseTo(540 / 280, 1);
		expect(sinceGate(slow, slow.gateOutMs / 2).speedKmh).toBe(0);
		expect(momentAt(slow, 1).fraction).toBeCloseTo(1, 9);
	});

	it("is near 280 km/h 30 s after the gate, on a flight with no wait", () => {
		expect(sinceGate(long, 30 * SECOND).speedKmh).toBeGreaterThan(200);
	});

	it("climbs quickly at a low altitude and slowly near the cruise", () => {
		const low = reaches(long, 3000) - reaches(long, 1000);
		const high = reaches(long, 11_000) - reaches(long, 9000);

		expect(low).toBeLessThan(high);
	});

	it("is at FL100 after approximately 5 minutes, near 250 kt", () => {
		const fl100 = reaches(long, 3050);

		expect(fl100).toBeGreaterThan(4 * MINUTE);
		expect(fl100).toBeLessThan(7 * MINUTE);
		expect(sinceGate(long, fl100).speedKmh).toBeGreaterThan(480);
		expect(sinceGate(long, fl100).speedKmh).toBeLessThan(600);
	});

	it("is at the cruise altitude after approximately 20 minutes", () => {
		const top = reaches(long, CRUISE_ALTITUDE_M);

		expect(top).toBeGreaterThan(18 * MINUTE);
		expect(top).toBeLessThan(26 * MINUTE);
	});

	it("touches down at the speed of an airliner, then brakes to a stop", () => {
		const touchdown = 30 * SECOND;
		const air = untilGate(long, touchdown + 20 * SECOND);
		const ground = untilGate(long, touchdown - SECOND);

		expect(air.altitudeM).toBeGreaterThan(0);
		expect(air.altitudeM).toBeLessThan(100);
		expect(ground.altitudeM).toBe(0);
		expect(ground.speedKmh).toBeGreaterThan(200);
		expect(untilGate(long, 0).speedKmh).toBe(0);
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
		// 3.6 minutes of the 12 hours.
		const step = 0.005;
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

	it("shortens the runs of a flight of a few minutes", () => {
		const tiny = flightProfile(20, 4 * MINUTE);

		expect(momentAt(tiny, 0.5).altitudeM).toBeGreaterThan(0);
		expect(momentAt(tiny, 1).fraction).toBeCloseTo(1, 9);
		expect(tiny.points.every((point) => Number.isFinite(point.km))).toBe(true);
	});

	it("arrives at the destination on a route shorter than the runs", () => {
		const near = flightProfile(0.2, HOUR);

		expect(momentAt(near, 1).fraction).toBe(1);
		expect(momentAt(near, 1).remainingKm).toBe(0);
	});
});
