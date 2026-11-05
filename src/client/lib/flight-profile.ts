/**
 * The simulated speed and altitude of "relive your flight". The pass gives no
 * real data, thus a table of points of a typical airliner gives them: the
 * taxi, the take-off run, the climb, the cruise, the descent, the landing run
 * and the taxi. Between two points, the speed and the altitude are linear.
 * Paragraph 5.6 of `docs/architecture.md` gives the decisions.
 */

/** Approximately FL360, a cruise level of an airliner. */
export const CRUISE_ALTITUDE_M = 11_000;

/** The minimum time of the taxi at each airport. */
export const TAXI_MS = 60_000;
const TAXI_KMH = 30;
/** The aircraft starts and stops in this time, at the gate. */
const GATE_MS = 10_000;
/** The take-off run, from the taxi speed to the lift-off. */
const TAKE_OFF_MS = 35_000;
/** The landing run, from the touchdown to the taxi speed. */
const LANDING_MS = 30_000;
const GROUND_MS = 2 * TAXI_MS + TAKE_OFF_MS + LANDING_MS;
/** The ground uses a maximum of 1/4 of the flight. */
const MAX_GROUND = 1 / 4;
/** The climb and the descent use a maximum of 2/3 of the time in the air. */
const MAX_RAMPS = 2 / 3;
/** 250 kt IAS at FL100 is approximately 540 km/h TAS. */
const FL100_KMH = 540;

/**
 * The climb and the descent of a typical airliner, through the same levels.
 * `climbS` is the time after the lift-off, and `descentS` is the time before
 * the touchdown. A speed is `kmh + part × cruise`. Up to FL100, the speeds
 * are fixed: 280 km/h at the lift-off, 260 km/h at the touchdown and 250 kt
 * (540 km/h TAS) at FL100. Above FL100, the speed goes to the cruise speed:
 * at FL240, 290 kt IAS is 83 % of the way from 540 km/h to 830 km/h. Thus a
 * flight with a long time at the gate has a slow cruise, not a slow take-off.
 * The climb is quick at a low altitude and slow near the cruise.
 */
const LEVELS = [
	{ altitudeM: 0, climbS: 0, descentS: 0, ...fixed(280, 260) },
	{ altitudeM: 900, climbS: 75, descentS: 240, ...fixed(330, 330) },
	{
		altitudeM: 3050,
		climbS: 245,
		descentS: 600,
		...fixed(FL100_KMH, FL100_KMH),
	},
	{ altitudeM: 7300, climbS: 670, descentS: 985, ...towards(0.83) },
	{ altitudeM: 9450, climbS: 955, descentS: 1180, ...towards(1) },
	{ altitudeM: 11_000, climbS: 1300, descentS: 1305, ...towards(1) },
];

function fixed(climbKmh: number, descentKmh: number) {
	return { climbKmh, climbPart: 0, descentKmh, descentPart: 0 };
}

/** A speed at `part` of the way from 250 kt at FL100 to the cruise speed. */
function towards(part: number) {
	const kmh = FL100_KMH * (1 - part);
	return { climbKmh: kmh, climbPart: part, descentKmh: kmh, descentPart: part };
}

type Level = (typeof LEVELS)[number];

/** The level at `altitudeM`, between two levels of the table. */
function levelAt(altitudeM: number): Level {
	const index = LEVELS.findIndex((level) => level.altitudeM >= altitudeM);
	const high = LEVELS[Math.max(0, index)] ?? (LEVELS[0] as Level);
	const low = LEVELS[Math.max(0, index - 1)] ?? high;
	const span = high.altitudeM - low.altitudeM;
	const part = span > 0 ? (altitudeM - low.altitudeM) / span : 0;
	const mix = (key: keyof Level) => low[key] + (high[key] - low[key]) * part;
	return {
		altitudeM,
		climbS: mix("climbS"),
		descentS: mix("descentS"),
		climbKmh: mix("climbKmh"),
		climbPart: mix("climbPart"),
		descentKmh: mix("descentKmh"),
		descentPart: mix("descentPart"),
	};
}

/** The highest altitude with a climb and a descent of `rampsMs` or less. */
function topAltitude(rampsMs: number): number {
	const ramps = (level: { climbS: number; descentS: number }) =>
		(level.climbS + level.descentS) * 1000;
	for (let i = 1; i < LEVELS.length; i += 1) {
		const low = LEVELS[i - 1];
		const high = LEVELS[i];
		if (low && high && ramps(high) > rampsMs) {
			const part = (rampsMs - ramps(low)) / (ramps(high) - ramps(low));
			return low.altitudeM + (high.altitudeM - low.altitudeM) * part;
		}
	}
	return CRUISE_ALTITUDE_M;
}

/** A point of the profile. `km` is the distance flown at `ms`. */
export type ProfilePoint = {
	ms: number;
	kmh: number;
	altitudeM: number;
	km: number;
};

export type FlightProfile = {
	distanceKm: number;
	durationMs: number;
	cruiseAltitudeM: number;
	/** The speed at FL310 and higher. */
	cruiseKmh: number;
	points: ProfilePoint[];
};

/**
 * A point before the speeds are known. Its speed is
 * `taxiKmh + scale × (kmh + part × cruise)`.
 */
type Draft = {
	ms: number;
	altitudeM: number;
	taxiKmh: number;
	kmh: number;
	part: number;
};

/** The cruise speed of a typical airliner: Mach 0.78 at FL360. */
const CRUISE_KMH = 830;
/** Below this cruise speed, all the speeds in the air become slower by one factor. */
const MIN_CRUISE_KMH = FL100_KMH;
/** The taxi out gets 2/3 of the extra taxi: it is longer than the taxi in. */
const TAXI_OUT = 2 / 3;

/** The points of a flight with `extraMs` of taxi more than the minimum. */
function plan(durationMs: number, extraMs: number) {
	const ground = Math.min(1, (durationMs * MAX_GROUND) / GROUND_MS);
	const taxiOut = TAXI_MS * ground + extraMs * TAXI_OUT;
	const taxiIn = TAXI_MS * ground + extraMs * (1 - TAXI_OUT);
	const gate = GATE_MS * ground;
	const liftOff = taxiOut + TAKE_OFF_MS * ground;
	const touchdown = durationMs - taxiIn - LANDING_MS * ground;
	const top = levelAt(topAltitude((touchdown - liftOff) * MAX_RAMPS));
	const below = LEVELS.filter((level) => level.altitudeM < top.altitudeM);
	const still = (ms: number): Draft => ({
		ms,
		altitudeM: 0,
		taxiKmh: 0,
		kmh: 0,
		part: 0,
	});
	const taxiing = (ms: number): Draft => ({ ...still(ms), taxiKmh: TAXI_KMH });
	const flying = (
		ms: number,
		altitudeM: number,
		kmh: number,
		part: number,
	): Draft => ({ ms, altitudeM, taxiKmh: 0, kmh, part });

	const drafts: Draft[] = [
		still(0),
		taxiing(gate),
		taxiing(taxiOut),
		...[...below, top].map((level) =>
			flying(
				liftOff + level.climbS * 1000,
				level.altitudeM,
				level.climbKmh,
				level.climbPart,
			),
		),
		...[top, ...below.toReversed()].map((level) =>
			flying(
				touchdown - level.descentS * 1000,
				level.altitudeM,
				level.descentKmh,
				level.descentPart,
			),
		),
		taxiing(durationMs - taxiIn),
		taxiing(durationMs - gate),
		still(durationMs),
	];

	// The distance is `taxiKm + scale × (fixedKm + cruise × partKm)`.
	let taxiKm = 0;
	let fixedKm = 0;
	let partKm = 0;
	drafts.forEach((draft, index) => {
		const previous = drafts[index - 1];
		if (previous) {
			const hours = (draft.ms - previous.ms) / 3_600_000;
			taxiKm += (hours * (previous.taxiKmh + draft.taxiKmh)) / 2;
			fixedKm += (hours * (previous.kmh + draft.kmh)) / 2;
			partKm += (hours * (previous.part + draft.part)) / 2;
		}
	});
	const atCruiseKm = taxiKm + fixedKm + CRUISE_KMH * partKm;
	return { drafts, top, taxiKm, fixedKm, partKm, atCruiseKm };
}

/**
 * The extra taxi that gives a cruise of `CRUISE_KMH`. The distance at that
 * speed becomes shorter with more taxi, thus a bisection finds it.
 */
function extraTaxiMs(distanceKm: number, durationMs: number): number {
	const ground = Math.min(1, (durationMs * MAX_GROUND) / GROUND_MS);
	const maxMs = Math.max(0, durationMs * MAX_GROUND - GROUND_MS * ground);
	if (plan(durationMs, 0).atCruiseKm <= distanceKm) {
		return 0;
	}
	if (plan(durationMs, maxMs).atCruiseKm >= distanceKm) {
		return maxMs;
	}
	let low = 0;
	let high = maxMs;
	for (let i = 0; i < 40; i += 1) {
		const middle = (low + high) / 2;
		if (plan(durationMs, middle).atCruiseKm > distanceKm) {
			low = middle;
		} else {
			high = middle;
		}
	}
	return high;
}

/**
 * The profile of a flight of `distanceKm` in `durationMs`, from gate to gate.
 * A short flight has no time for the full climb, thus its cruise altitude is
 * lower. The distance of the profile is equal to `distanceKm`:
 *
 * - The taxi takes the rest of the time first, to a maximum of 1/4 of the
 *   flight. Thus the cruise is near `CRUISE_KMH`.
 * - Then the cruise speed takes the difference. Thus the take-off and the
 *   landing keep the speeds of an airliner.
 * - When the cruise is slower than `MIN_CRUISE_KMH`, all the speeds in the
 *   air become slower by the same factor. The taxi keeps its speed.
 */
export function flightProfile(
	distanceKm: number,
	durationMs: number,
): FlightProfile {
	const duration = Math.max(0, durationMs);
	const { drafts, top, taxiKm, fixedKm, partKm } = plan(
		duration,
		extraTaxiMs(distanceKm, duration),
	);
	const airKm = Math.max(0, distanceKm - taxiKm);
	const fast = partKm > 0 ? (airKm - fixedKm) / partKm : 0;
	const cruise = Math.max(MIN_CRUISE_KMH, fast);
	const reference = fixedKm + cruise * partKm;
	const scale =
		fast >= MIN_CRUISE_KMH || reference <= 0 ? 1 : airKm / reference;

	const points: ProfilePoint[] = [];
	for (const draft of drafts) {
		const kmh = draft.taxiKmh + scale * (draft.kmh + draft.part * cruise);
		const previous = points.at(-1);
		const km = previous
			? previous.km +
				(((draft.ms - previous.ms) / 3_600_000) * (previous.kmh + kmh)) / 2
			: 0;
		points.push({ ms: draft.ms, kmh, altitudeM: draft.altitudeM, km });
	}

	return {
		distanceKm,
		durationMs,
		cruiseAltitudeM: top.altitudeM,
		cruiseKmh: scale * cruise,
		points,
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
	const { distanceKm, durationMs, points } = profile;
	if (durationMs <= 0) {
		return { fraction: 1, remainingKm: 0, speedKmh: 0, altitudeM: 0 };
	}
	const now = Math.min(1, Math.max(0, t)) * durationMs;
	const next = points.findIndex((point) => point.ms > now);
	const index = next === -1 ? points.length - 1 : Math.max(1, next);
	const b = points[index];
	const a = points[index - 1];
	if (!a || !b) {
		return { fraction: 1, remainingKm: 0, speedKmh: 0, altitudeM: 0 };
	}
	const span = b.ms - a.ms;
	const part = span > 0 ? Math.min(1, (now - a.ms) / span) : 1;
	const speed = a.kmh + (b.kmh - a.kmh) * part;
	const altitude = a.altitudeM + (b.altitudeM - a.altitudeM) * part;
	// The exact distance under a linear speed: a trapezium.
	const flownKm = a.km + (((now - a.ms) / 3_600_000) * (a.kmh + speed)) / 2;
	return {
		fraction:
			distanceKm > 0 ? Math.min(1, flownKm / distanceKm) : now / durationMs,
		remainingKm: Math.max(0, distanceKm - flownKm),
		speedKmh: Math.round(speed),
		altitudeM: Math.round(altitude / 10) * 10,
	};
}
