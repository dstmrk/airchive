import type { LonLat } from "./great-circle.ts";

/**
 * The logic of "relive your flight": the position of the aircraft on the route,
 * the speeds and the states of the replay. Paragraph 5.6 of
 * `docs/architecture.md` gives the decisions.
 */

/** The position of the aircraft. The bearing is in degrees from the north, clockwise. */
export type Position = { lon: number; lat: number; bearing: number };

const RAD = Math.PI / 180;

function bearing([lon1, lat1]: LonLat, [lon2, lat2]: LonLat): number {
	const phi1 = lat1 * RAD;
	const phi2 = lat2 * RAD;
	const delta = (lon2 - lon1) * RAD;
	const degrees =
		Math.atan2(
			Math.sin(delta) * Math.cos(phi2),
			Math.cos(phi1) * Math.sin(phi2) -
				Math.sin(phi1) * Math.cos(phi2) * Math.cos(delta),
		) / RAD;
	return (degrees + 360) % 360;
}

function segmentAt(route: readonly LonLat[], t: number) {
	const last = route.length - 1;
	const x = Math.min(1, Math.max(0, t)) * last;
	const index = Math.max(0, Math.min(last - 1, Math.floor(x)));
	return { index, fraction: x - index };
}

/**
 * The position for `t` from 0 (the origin) to 1 (the destination), on the
 * points of `greatCircle`. The points have equal angles between them, thus a
 * linear step of `t` is a constant speed. The longitudes of the route are
 * continuous, thus the aircraft does not jump at the antimeridian.
 */
export function position(route: readonly LonLat[], t: number): Position {
	const { index, fraction } = segmentAt(route, t);
	const a = route[index] ?? [0, 0];
	const b = route[index + 1] ?? a;
	return {
		lon: a[0] + (b[0] - a[0]) * fraction,
		lat: a[1] + (b[1] - a[1]) * fraction,
		bearing: bearing(a, b),
	};
}

/** The part of the route behind the aircraft. */
export function flownRoute(route: readonly LonLat[], t: number): LonLat[] {
	if (t <= 0) {
		return [];
	}
	const { index } = segmentAt(route, t);
	const here = position(route, t);
	return [...route.slice(0, index + 1), [here.lon, here.lat]];
}

/**
 * The speeds, the shortest replay first. A short replay has a fixed length:
 * a flight of one hour and a flight of twelve hours both take 30 seconds. A
 * long replay is a multiple of the real time.
 */
export const SPEEDS = [
	{ id: "15s", ms: 15_000 },
	{ id: "30s", ms: 30_000 },
	{ id: "1min", ms: 60_000 },
	{ id: "5min", ms: 300_000 },
	{ id: "4x", factor: 4 },
	{ id: "1x", factor: 1 },
] as const;

export type SpeedId = (typeof SPEEDS)[number]["id"];

export const DEFAULT_SPEED: SpeedId = "30s";

/** The length of the replay in milliseconds, for a flight of `flightMs`. */
export function replayMs(id: SpeedId, flightMs: number): number {
	const speed = SPEEDS.find((s) => s.id === id) ?? SPEEDS[1];
	return "ms" in speed ? speed.ms : flightMs / speed.factor;
}

/**
 * A part of the timeline: `width` is its part of `t`, and `ms` is its length
 * in the replay. A part with no length is skipped: the replay goes through
 * it in no time. The widths of a timeline make 1.
 */
export type Stretch = { width: number; ms: number };

/**
 * The `t` after `ms` of replay from `t`. Each part has its own speed, thus
 * one step can go across the end of a part into the next one.
 */
export function advance(
	stretches: readonly Stretch[],
	t: number,
	ms: number,
): number {
	let now = Math.min(1, Math.max(0, t));
	let left = ms;
	let start = 0;
	for (const { width, ms: length } of stretches) {
		const end = start + width;
		if (now < end) {
			const rest = end - now;
			const needed = length * (rest / width);
			if (needed > left) {
				return now + (left / length) * width;
			}
			left -= needed;
			now = end;
		}
		start = end;
	}
	return 1;
}

/**
 * - `idle`: the stub is on the pass, and the aircraft is at the origin.
 * - `boarding`: the stub tears.
 * - `playing` and `paused`: the stub is off. The map fills the screen.
 * - `landed`: the stub is on the pass again, and the aircraft is at the destination.
 *   The map still fills the screen: a stop goes back to the pass.
 */
export type ReplayState = {
	phase: "idle" | "boarding" | "playing" | "paused" | "landed";
	t: number;
};

export type ReplayEvent =
	| { type: "play" }
	| { type: "boarded" }
	| { type: "pause" }
	| { type: "tick"; ms: number; stretches: readonly Stretch[] }
	| { type: "seek"; t: number }
	| { type: "stop" };

/** The replay never starts alone, thus `prefers-reduced-motion` needs no other rule. */
export const initialReplay: ReplayState = { phase: "idle", t: 0 };

export function replay(state: ReplayState, event: ReplayEvent): ReplayState {
	switch (event.type) {
		case "play":
			if (state.phase === "paused" && state.t < 1) {
				return { ...state, phase: "playing" };
			}
			// The stub is under the cabin: a second tear has no audience.
			if (state.phase === "landed" || state.phase === "paused") {
				return { phase: "playing", t: 0 };
			}
			return state.phase === "boarding" || state.phase === "playing"
				? state
				: { phase: "boarding", t: 0 };
		case "boarded":
			return state.phase === "boarding"
				? { ...state, phase: "playing" }
				: state;
		case "pause":
			return state.phase === "boarding" || state.phase === "playing"
				? { ...state, phase: "paused" }
				: state;
		case "tick": {
			if (state.phase !== "playing") {
				return state;
			}
			const t = advance(event.stretches, state.t, event.ms);
			return t >= 1 ? { phase: "landed", t: 1 } : { ...state, t };
		}
		case "seek":
			return { phase: "paused", t: Math.min(1, Math.max(0, event.t)) };
		case "stop":
			return state.phase === "idle" ? state : initialReplay;
	}
}

/** The stub is off the pass from the tear to the landing. */
export function isTorn({ phase }: ReplayState): boolean {
	return phase === "boarding" || phase === "playing" || phase === "paused";
}

/** The map and the controls fill the screen from the end of the tear to a stop. */
export function inCabin({ phase }: ReplayState): boolean {
	return phase === "playing" || phase === "paused" || phase === "landed";
}
