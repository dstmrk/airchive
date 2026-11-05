/**
 * The 3D view of the replay: the map has a pitch, and its bearing follows the
 * bearing of the aircraft. The person sees the route in front of the aircraft.
 * Paragraph 5.6 of `docs/architecture.md` gives the decisions.
 */

/** The pitch of the 3D view in degrees. Above approximately 60 degrees, MapLibre shows the horizon. */
export const PITCH_3D = 50;

/**
 * The maximum speed of the turn of the map. On a great circle the bearing of
 * the aircraft changes slowly. A new leg can turn it by 180 degrees at once.
 */
export const TURN_DEG_PER_S = 30;

const normalize = (degrees: number) => ((degrees % 360) + 360) % 360;

/** The shortest turn from `from` to `to`, from -180 (excluded) to 180 degrees. */
export function angleBetween(from: number, to: number): number {
	const turn = normalize(to - from);
	return turn > 180 ? turn - 360 : turn;
}

/**
 * The bearing of the map after `ms`. With no bearing before, or when the
 * replay does not play (a seek of the person), the map goes to the bearing of
 * the aircraft at once. During the replay it turns at `TURN_DEG_PER_S`.
 */
export function heading(
	current: number | null,
	target: number,
	ms: number,
	playing: boolean,
): number {
	if (current === null || !playing) {
		return normalize(target);
	}
	const turn = angleBetween(current, target);
	const step = (TURN_DEG_PER_S * Math.max(0, ms)) / 1000;
	if (Math.abs(turn) <= step) {
		return normalize(target);
	}
	return normalize(current + Math.sign(turn) * step);
}

/**
 * The padding of the camera: the aircraft is at two thirds of the height of
 * the map, thus the map shows more of the route in front of it.
 */
export function aheadPadding(height: number) {
	const top =
		Number.isFinite(height) && height > 0 ? Math.round(height / 3) : 0;
	return { top, bottom: 0, left: 0, right: 0 };
}

/**
 * Whether the replay shows the 3D view. When the replay starts, it is on,
 * but off with `prefers-reduced-motion`: a map that turns can make a person
 * ill. A button on the map starts and stops it.
 */
export type ThreeDEvent =
	| { type: "toggle" }
	| { type: "reset"; reduced: boolean };

export function threeD(on: boolean, event: ThreeDEvent): boolean {
	switch (event.type) {
		case "toggle":
			return !on;
		case "reset":
			return !event.reduced;
	}
}
