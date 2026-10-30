/**
 * The simulated speed and altitude of "relive your flight". The pass gives no
 * real data, thus a trapezium gives them: a linear climb from 0, a cruise and a
 * linear descent to 0. The speed follows the same trapezium. Paragraph 5.6 of
 * `docs/architecture.md` gives the decisions.
 */

/** Approximately FL360, a cruise level of an airliner. */
export const CRUISE_ALTITUDE_M = 11_000;
/** A mean climb of approximately 1,800 ft/min. */
const CLIMB_M_PER_S = 9;
/** A mean descent of approximately 1,500 ft/min. */
const DESCENT_M_PER_S = 7.5;

export const CLIMB_MS = (CRUISE_ALTITUDE_M / CLIMB_M_PER_S) * 1000;
export const DESCENT_MS = (CRUISE_ALTITUDE_M / DESCENT_M_PER_S) * 1000;

/** The climb and the descent use a maximum of 2/3 of the flight. */
const MAX_RAMPS = 2 / 3;

export type FlightProfile = {
	distanceKm: number;
	durationMs: number;
	climbMs: number;
	descentMs: number;
	cruiseAltitudeM: number;
	cruiseKmh: number;
};

/**
 * The profile of a flight of `distanceKm` in `durationMs`. A short flight has
 * no time for the full climb, thus its cruise altitude is lower. The cruise
 * speed makes the area of the trapezium equal to the distance.
 */
export function flightProfile(
	distanceKm: number,
	durationMs: number,
): FlightProfile {
	const ramps = Math.max(0, durationMs) * MAX_RAMPS;
	const cruiseAltitudeM = Math.min(
		CRUISE_ALTITUDE_M,
		ramps / (CLIMB_MS / CRUISE_ALTITUDE_M + DESCENT_MS / CRUISE_ALTITUDE_M),
	);
	const climbMs = (cruiseAltitudeM / CRUISE_ALTITUDE_M) * CLIMB_MS;
	const descentMs = (cruiseAltitudeM / CRUISE_ALTITUDE_M) * DESCENT_MS;
	const flyingMs = durationMs - (climbMs + descentMs) / 2;
	return {
		distanceKm,
		durationMs,
		climbMs,
		descentMs,
		cruiseAltitudeM,
		cruiseKmh: flyingMs > 0 ? (distanceKm / flyingMs) * 3_600_000 : 0,
	};
}

/**
 * The aircraft at `t` from 0 to 1, a fraction of the time. `fraction` is the
 * part of the distance that it flew, for `position` of `replay.ts`. The
 * altitude is in steps of 10 m and the speed in steps of 1 km/h.
 */
export type FlightMoment = {
	fraction: number;
	remainingKm: number;
	speedKmh: number;
	altitudeM: number;
};

export function momentAt(profile: FlightProfile, t: number): FlightMoment {
	const { distanceKm, durationMs, climbMs, descentMs, cruiseAltitudeM } =
		profile;
	if (durationMs <= 0) {
		return { fraction: 1, remainingKm: 0, speedKmh: 0, altitudeM: 0 };
	}
	const kmPerMs = profile.cruiseKmh / 3_600_000;
	const now = Math.min(1, Math.max(0, t)) * durationMs;
	const left = durationMs - now;
	let flownKm: number;
	let speed: number;
	let altitude: number;
	if (now < climbMs) {
		speed = now / climbMs;
		altitude = now / climbMs;
		flownKm = (kmPerMs * now * now) / (2 * climbMs);
	} else if (left > descentMs) {
		speed = 1;
		altitude = 1;
		flownKm = kmPerMs * (now - climbMs / 2);
	} else {
		speed = descentMs > 0 ? left / descentMs : 0;
		altitude = speed;
		flownKm =
			distanceKm -
			(descentMs > 0 ? (kmPerMs * left * left) / (2 * descentMs) : 0);
	}
	return {
		fraction:
			distanceKm > 0 ? Math.min(1, flownKm / distanceKm) : now / durationMs,
		remainingKm: Math.max(0, distanceKm - flownKm),
		speedKmh: Math.round(speed * profile.cruiseKmh),
		altitudeM: Math.round((altitude * cruiseAltitudeM) / 10) * 10,
	};
}
