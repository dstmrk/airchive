/**
 * The zoom of the map during the replay follows the simulated altitude of
 * `flight-profile.ts`. On the ground the person sees the airport, at the
 * cruise a large area. Paragraph 5.6 of `docs/architecture.md` gives the
 * decisions.
 */
import { CRUISE_ALTITUDE_M } from "./flight-profile.ts";

/** At 45 degrees of latitude, approximately 19 km on a width of 360 px. */
export const AIRPORT_ZOOM = 11;
/** A long leg does not show the whole world: the aircraft stays visible. */
export const MIN_CRUISE_ZOOM = 4;
/** A short leg shows a large area also. */
export const MAX_CRUISE_ZOOM = 7;

/**
 * The zoom at the cruise, from the zoom that fits the leg in the map. With no
 * zoom (the map cannot fit the leg), the minimum.
 */
export function cruiseZoom(fitZoom: number | undefined): number {
	if (fitZoom === undefined || !Number.isFinite(fitZoom)) {
		return MIN_CRUISE_ZOOM;
	}
	return Math.min(MAX_CRUISE_ZOOM, Math.max(MIN_CRUISE_ZOOM, fitZoom));
}

/**
 * A linear interpolation of the zoom, thus of the logarithm of the scale. It
 * uses the altitude, not the part of the cruise of the leg: the lower cruise of
 * a short flight zooms out less.
 */
export function profileZoom(altitudeM: number, cruise: number): number {
	const part = Math.min(1, Math.max(0, altitudeM / CRUISE_ALTITUDE_M));
	return AIRPORT_ZOOM + (cruise - AIRPORT_ZOOM) * part;
}

/**
 * Whether the profile sets the zoom. It is on when the replay starts. A zoom of
 * the person stops it, and the toggle stops and starts it. A drag does not
 * change it: the follow of `follow.ts` sets the centre.
 */
export type AutoZoomEvent = "zoom" | "toggle" | "reset";

export const INITIAL_AUTO_ZOOM = true;

export function autoZoom(on: boolean, event: AutoZoomEvent): boolean {
	switch (event) {
		case "zoom":
			return false;
		case "toggle":
			return !on;
		case "reset":
			return INITIAL_AUTO_ZOOM;
	}
}
