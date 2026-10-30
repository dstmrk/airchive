import type { LonLat } from "./great-circle.ts";

/**
 * The terminator: the line between the day and the night, for the replay.
 * Paragraph 5.6 of `docs/architecture.md` gives the decisions.
 */

const RAD = Math.PI / 180;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** The Unix time of J2000.0, 2000-01-01 12:00 TT, as UTC. */
const J2000 = Date.UTC(2000, 0, 1, 12);

/** The altitude of the centre of the sun at the sunset: the refraction and the radius of the disc. */
export const SUNSET = -0.833;
/** The altitude of the sun at the end of the civil dusk. */
export const CIVIL_DUSK = -6;

const wrap = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;

/**
 * The point where the sun is at the zenith. The approximation of the
 * Astronomical Almanac gives the declination and the equation of time, with
 * an error of approximately 0.01 degrees from 1950 to 2050.
 */
export function subsolarPoint(instant: number): LonLat {
	const n = (instant - J2000) / DAY;
	const mean = 280.46 + 0.9856474 * n;
	const anomaly = (357.528 + 0.9856003 * n) * RAD;
	const ecliptic =
		(mean + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD;
	const obliquity = (23.439 - 0.0000004 * n) * RAD;
	const declination = Math.asin(Math.sin(obliquity) * Math.sin(ecliptic));
	const ascension = Math.atan2(
		Math.cos(obliquity) * Math.sin(ecliptic),
		Math.cos(ecliptic),
	);
	// The equation of time in degrees: the true sun minus the mean sun.
	const equation = wrap(mean - ascension / RAD);
	const hours = (((instant % DAY) + DAY) % DAY) / HOUR;
	return [wrap(-15 * (hours - 12) - equation), declination / RAD];
}

const POINTS = 360;

/**
 * The ring of the area where the altitude of the sun is less than
 * `altitude` (a negative value). The area is a circle around the antisolar
 * point. When the circle holds a pole, the ring goes from -180 to 180 and
 * closes along the pole. Otherwise the longitudes are continuous, and they
 * can go across the antimeridian, as the route does.
 */
export function darkArea(instant: number, altitude: number): LonLat[] {
	const [sunLon, sunLat] = subsolarPoint(instant);
	const lon = wrap(sunLon + 180) * RAD;
	const lat = -sunLat * RAD;
	const radius = (90 + altitude) * RAD;
	const circle: LonLat[] = [];
	for (let i = 0; i < POINTS; i++) {
		const bearing = (i / POINTS) * 2 * Math.PI;
		const phi = Math.asin(
			Math.sin(lat) * Math.cos(radius) +
				Math.cos(lat) * Math.sin(radius) * Math.cos(bearing),
		);
		const lambda =
			lon +
			Math.atan2(
				Math.sin(bearing) * Math.sin(radius) * Math.cos(lat),
				Math.cos(radius) - Math.sin(lat) * Math.sin(phi),
			);
		circle.push([lambda / RAD, phi / RAD]);
	}

	if (Math.abs(sunLat) <= -altitude) {
		return [...circle, circle[0] ?? [0, 0]];
	}
	// Each meridian goes across the circle one time, thus an order by the longitude gives the line.
	const line = circle
		.map(([x, y]): LonLat => [wrap(x), y])
		.sort((a, b) => a[0] - b[0]);
	const [firstLon, firstLat] = line[0] ?? [0, 0];
	const [lastLon, lastLat] = line.at(-1) ?? [0, 0];
	const edge =
		lastLat +
		((firstLat - lastLat) * (180 - lastLon)) / (firstLon + 360 - lastLon);
	const pole = sunLat > 0 ? -90 : 90;
	return [
		[-180, edge],
		...line,
		[180, edge],
		[180, pole],
		[-180, pole],
		[-180, edge],
	];
}

/**
 * The instant of the replay, to the minute. The terminator moves 0.25
 * degrees in one minute, thus the map draws it again only at a new minute.
 * With no departure time, there is no instant.
 */
export function replayMinute(instant: number | null): number | null {
	return instant === null ? null : Math.floor(instant / MINUTE) * MINUTE;
}
