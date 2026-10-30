import type { Airport } from "../../shared/airport.ts";
import type { FlightView } from "../../shared/flight.ts";
import {
	type FlightMoment,
	type FlightProfile,
	flightProfile,
	momentAt,
} from "./flight-profile.ts";
import { type FlightTiming, flightTiming } from "./flight-time.ts";
import { distanceKm, greatCircle, type LonLat } from "./great-circle.ts";
import {
	flownRoute,
	isLongSpeed,
	type Position,
	position,
	replayMs,
	type SpeedId,
	type Stretch,
} from "./replay.ts";

/**
 * "Relive your flight" for each leg of a journey. `t` from 0 to 1 is a part
 * of the real time, from the first departure to the last arrival, with the
 * stops between the legs. Paragraph 5.6 of `docs/architecture.md` gives the
 * decisions.
 */

export type JourneyLeg = {
	origin: Airport;
	destination: Airport;
	timing: FlightTiming;
};

/**
 * The legs of the replay, or null when an airport of a flight is not in the
 * dataset: the map cannot show that leg, thus the page shows only the passes.
 */
export function journeyLegs(
	flights: readonly FlightView[],
): JourneyLeg[] | null {
	const legs: JourneyLeg[] = [];
	for (const flight of flights) {
		const { originAirport: origin, destinationAirport: destination } = flight;
		if (!origin || !destination) {
			return null;
		}
		legs.push({
			origin,
			destination,
			timing: flightTiming({
				...flight,
				originAirport: origin,
				destinationAirport: destination,
			}),
		});
	}
	return legs.length > 0 ? legs : null;
}

/** A flight of one leg, or the stop at the airport after that leg. */
export type Part = {
	kind: "flight" | "stop";
	leg: number;
	startMs: number;
	ms: number;
};

export type Timeline = {
	legs: readonly JourneyLeg[];
	parts: Part[];
	totalMs: number;
	/** One great circle for each leg. The longitudes go on from one leg to the next. */
	routes: LonLat[][];
	profiles: FlightProfile[];
};

const lonLat = (airport: Airport): LonLat => [airport.lon, airport.lat];

/** The route moved by whole turns, thus it starts within 180 degrees of `lon`. */
function near(route: LonLat[], lon: number): LonLat[] {
	const [first] = route;
	const turns = first ? Math.round((lon - first[0]) / 360) : 0;
	return turns === 0
		? route
		: route.map(([x, y]): LonLat => [x + 360 * turns, y]);
}

/**
 * The stop after a leg: from its arrival to the next departure. With no
 * departure time on one of the two legs, the stop is unknown and has no
 * length. Two legs that overlap give no stop.
 */
function stopMs(leg: JourneyLeg, next: JourneyLeg): number {
	const { departure, durationMs } = leg.timing;
	const after = next.timing.departure;
	return departure === null || after === null
		? 0
		: Math.max(0, after - (departure + durationMs));
}

export function journeyTimeline(legs: readonly JourneyLeg[]): Timeline {
	const parts: Part[] = [];
	const routes: LonLat[][] = [];
	let startMs = 0;
	legs.forEach((leg, index) => {
		const route = greatCircle(lonLat(leg.origin), lonLat(leg.destination));
		const previous = routes.at(-1)?.at(-1);
		routes.push(previous ? near(route, previous[0]) : route);
		parts.push({
			kind: "flight",
			leg: index,
			startMs,
			ms: leg.timing.durationMs,
		});
		startMs += leg.timing.durationMs;
		const next = legs[index + 1];
		if (next) {
			const ms = stopMs(leg, next);
			parts.push({ kind: "stop", leg: index, startMs, ms });
			startMs += ms;
		}
	});
	return {
		legs,
		parts,
		totalMs: startMs,
		routes,
		profiles: legs.map((leg) =>
			flightProfile(
				distanceKm(lonLat(leg.origin), lonLat(leg.destination)),
				leg.timing.durationMs,
			),
		),
	};
}

/** What a long replay does at a stop: it waits for the real time, or it skips the stop. */
export type StopMode = "real" | "skip";

/** In a short replay, the aircraft waits this time at each known stop. */
export const SHORT_STOP_MS = 1500;
/** The waits of a short replay use a maximum of this part of its length. */
const MAX_SHORT_STOPS = 0.2;

/** True when a stop has a length: the choice of the stops changes the replay. */
export function hasKnownStop(timeline: Timeline): boolean {
	return timeline.parts.some((part) => part.kind === "stop" && part.ms > 0);
}

/**
 * The parts of the replay at a speed. As for one flight, a short replay has
 * a fixed length, and a long replay is a multiple of the real time.
 *
 * - A short replay waits `SHORT_STOP_MS` at each known stop, thus the person
 *   sees the landing. The flights share the rest by their duration.
 * - A long replay waits the real time of a stop, divided by the factor, or it
 *   skips the stop. `stops` gives the choice.
 */
export function journeyStretches(
	timeline: Timeline,
	speed: SpeedId,
	stops: StopMode,
): Stretch[] {
	const known = timeline.parts.filter(
		(part) => part.kind === "stop" && part.ms > 0,
	).length;
	const flightsMs = timeline.parts
		.filter((part) => part.kind === "flight")
		.reduce((sum, part) => sum + part.ms, 0);
	const long = isLongSpeed(speed);
	const length = replayMs(speed, flightsMs);
	const shortStop =
		known > 0 ? Math.min(SHORT_STOP_MS, (length * MAX_SHORT_STOPS) / known) : 0;
	const flying = long ? length : length - shortStop * known;
	const stopLength = (ms: number) => {
		if (ms <= 0) {
			return 0;
		}
		if (!long) {
			return shortStop;
		}
		return stops === "real" ? replayMs(speed, ms) : 0;
	};
	return timeline.parts.map((part) => ({
		width: timeline.totalMs > 0 ? part.ms / timeline.totalMs : 0,
		ms:
			part.kind === "stop"
				? stopLength(part.ms)
				: flightsMs > 0
					? (flying * part.ms) / flightsMs
					: 0,
	}));
}

export type JourneyMoment = {
	/** The leg in the air, or the leg before the stop. */
	leg: number;
	/** True when the aircraft is on the ground between two legs. */
	stop: boolean;
	aircraft: Position;
	/** The lines behind the aircraft, one for each leg. */
	flown: LonLat[][];
	/** The speed and the altitude of the leg. On the ground, they are 0. */
	moment: FlightMoment;
	/** The distance to the final destination. */
	remainingKm: number;
	elapsedMs: number;
	/** The real time of `t`, or null when the leg has no departure time. */
	instant: number | null;
};

function partAt(timeline: Timeline, elapsedMs: number): Part {
	const { parts } = timeline;
	// The last part that starts before the time: at the end of a flight, the stop.
	const found = parts.findLast(
		(part) =>
			part.startMs <= elapsedMs && (part.ms > 0 || part.kind === "flight"),
	);
	return found ?? (parts[0] as Part);
}

const GROUND: FlightMoment = {
	fraction: 1,
	remainingKm: 0,
	speedKmh: 0,
	altitudeM: 0,
};

export function journeyMomentAt(timeline: Timeline, t: number): JourneyMoment {
	const elapsedMs = Math.min(1, Math.max(0, t)) * timeline.totalMs;
	const part = partAt(timeline, elapsedMs);
	const route = timeline.routes[part.leg] ?? [];
	const profile = timeline.profiles[part.leg];
	const timing = timeline.legs[part.leg]?.timing;
	const local =
		part.ms > 0 ? Math.min(1, (elapsedMs - part.startMs) / part.ms) : 1;
	const flying = part.kind === "flight" && profile !== undefined;
	const moment = flying ? momentAt(profile, local) : GROUND;
	const later = timeline.profiles
		.slice(part.leg + 1)
		.reduce((sum, p) => sum + p.distanceKm, 0);
	const departure = timing?.departure ?? null;
	const instant =
		departure === null || timing === undefined
			? null
			: part.kind === "flight"
				? departure + local * part.ms
				: departure + timing.durationMs + (elapsedMs - part.startMs);
	return {
		leg: part.leg,
		stop: !flying,
		aircraft: position(route, moment.fraction),
		flown: [
			...timeline.routes.slice(0, part.leg),
			flying ? flownRoute(route, moment.fraction) : route,
		],
		moment,
		remainingKm: moment.remainingKm + later,
		elapsedMs,
		instant,
	};
}

/** The instant of the last arrival, or null when the last leg has no departure time. */
export function finalArrival(timeline: Timeline): number | null {
	const last = timeline.legs.at(-1)?.timing;
	return last?.departure == null ? null : last.departure + last.durationMs;
}

/** The places of the landings on the timeline, from 0 to 1, for the marks under it. */
export function landingMarks(timeline: Timeline): number[] {
	return timeline.parts
		.filter((part) => part.kind === "stop")
		.map((part) => part.startMs / timeline.totalMs);
}

export type MapPin = { code: string; at: LonLat };

/**
 * The airports on the map, at the ends of the routes, each one time. A
 * transfer is a line on the ground between two airports: a leg that departs
 * from another airport than the arrival of the previous leg.
 */
export function journeyMap(timeline: Timeline): {
	pins: MapPin[];
	transfers: [LonLat, LonLat][];
} {
	const pins: MapPin[] = [];
	const transfers: [LonLat, LonLat][] = [];
	const add = (code: string, at: LonLat | undefined) => {
		if (at && !pins.some((pin) => pin.code === code)) {
			pins.push({ code, at });
		}
	};
	timeline.legs.forEach((leg, index) => {
		const route = timeline.routes[index] ?? [];
		add(leg.origin.iata, route[0]);
		add(leg.destination.iata, route.at(-1));
		const next = timeline.legs[index + 1];
		const end = route.at(-1);
		const start = timeline.routes[index + 1]?.[0];
		if (next && next.origin.iata !== leg.destination.iata && end && start) {
			transfers.push([end, start]);
		}
	});
	return { pins, transfers };
}
