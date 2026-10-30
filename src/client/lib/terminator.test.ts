import { describe, expect, it } from "vitest";
import type { LonLat } from "./great-circle.ts";
import {
	CIVIL_DUSK,
	darkArea,
	replayMinute,
	SUNSET,
	subsolarPoint,
} from "./terminator.ts";

const RAD = Math.PI / 180;
const MINUTE = 60_000;

/** The altitude of the sun in degrees, from the subsolar point. */
function altitude(instant: number, [lon, lat]: LonLat): number {
	const sun = subsolarPoint(instant);
	const cos =
		Math.sin(lat * RAD) * Math.sin(sun[1] * RAD) +
		Math.cos(lat * RAD) *
			Math.cos(sun[1] * RAD) *
			Math.cos((lon - sun[0]) * RAD);
	return 90 - Math.acos(Math.max(-1, Math.min(1, cos))) / RAD;
}

/** A ray test on the plane of the longitude and the latitude. */
function inRing(ring: readonly LonLat[], [x, y]: LonLat): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i] ?? [0, 0];
		const [xj, yj] = ring[j] ?? [0, 0];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
			inside = !inside;
		}
	}
	return inside;
}

/** The ring can go across the antimeridian, thus the test examines the copies of the point. */
const inArea = (ring: readonly LonLat[], [lon, lat]: LonLat) =>
	[-360, 0, 360].some((shift) => inRing(ring, [lon + shift, lat]));

describe("subsolarPoint", () => {
	it("is near the Tropic of Cancer at the June solstice", () => {
		const [, lat] = subsolarPoint(Date.UTC(2025, 5, 21, 2, 42));
		expect(lat).toBeCloseTo(23.44, 1);
	});

	it("is near the Tropic of Capricorn at the December solstice", () => {
		const [, lat] = subsolarPoint(Date.UTC(2025, 11, 21, 15, 3));
		expect(lat).toBeCloseTo(-23.44, 1);
	});

	it("is near the equator at the March equinox", () => {
		const [, lat] = subsolarPoint(Date.UTC(2025, 2, 20, 9, 1));
		expect(Math.abs(lat)).toBeLessThan(0.05);
	});

	it("has the equation of time in its longitude", () => {
		// At 12:00 UTC the sun is ahead of the mean sun in November and behind it in February.
		const [november] = subsolarPoint(Date.UTC(2025, 10, 3, 12));
		const [february] = subsolarPoint(Date.UTC(2025, 1, 11, 12));
		expect(november * 4).toBeCloseTo(-16.4, 0);
		expect(february * 4).toBeCloseTo(14.2, 0);
	});

	it("moves 15 degrees to the west each hour", () => {
		const [a] = subsolarPoint(Date.UTC(2025, 6, 1, 0));
		const [b] = subsolarPoint(Date.UTC(2025, 6, 1, 1));
		expect(((a - b + 540) % 360) - 180).toBeCloseTo(15, 1);
	});

	it("gives a longitude from -180 to 180", () => {
		for (let hour = 0; hour < 24; hour++) {
			const [lon] = subsolarPoint(Date.UTC(2025, 3, 1, hour));
			expect(lon).toBeGreaterThanOrEqual(-180);
			expect(lon).toBeLessThan(180);
		}
	});
});

describe("darkArea", () => {
	const instants = {
		"the June solstice": Date.UTC(2025, 5, 21, 2, 42),
		"the December solstice": Date.UTC(2025, 11, 21, 15, 3),
		"the March equinox": Date.UTC(2025, 2, 20, 9, 1),
		// The declination is 2°: the sunset area holds the pole, the dusk area does not.
		"a declination between the two thresholds": Date.UTC(2025, 2, 25, 18),
		"a sun near the antimeridian": Date.UTC(2025, 8, 10, 0, 10),
	};

	for (const [name, instant] of Object.entries(instants)) {
		for (const [threshold, value] of [
			["the sunset", SUNSET],
			["the end of the civil dusk", CIVIL_DUSK],
		] as const) {
			it(`holds each point after ${threshold}, at ${name}`, () => {
				const ring = darkArea(instant, value);
				for (let lat = -88; lat <= 88; lat += 4) {
					for (let lon = -178; lon <= 178; lon += 4) {
						const sun = altitude(instant, [lon, lat]);
						// The ring is a line of points: near the line the test has no answer.
						if (Math.abs(sun - value) > 0.5) {
							expect(inArea(ring, [lon, lat]), `${lon} ${lat}`).toBe(
								sun < value,
							);
						}
					}
				}
			});
		}
	}

	it("is a closed ring", () => {
		const ring = darkArea(Date.UTC(2025, 5, 21), SUNSET);
		expect(ring.at(0)).toEqual(ring.at(-1));
	});

	it("holds the pole of the winter", () => {
		const june = darkArea(Date.UTC(2025, 5, 21), SUNSET);
		const december = darkArea(Date.UTC(2025, 11, 21), SUNSET);
		expect(inArea(june, [0, -89])).toBe(true);
		expect(inArea(june, [0, 89])).toBe(false);
		expect(inArea(december, [0, 89])).toBe(true);
		expect(inArea(december, [0, -89])).toBe(false);
	});
});

describe("replayMinute", () => {
	const departure = Date.UTC(2025, 5, 21, 22, 15);
	const hours = 10 * 60 * MINUTE;

	it("is the departure at the start and the arrival at the end", () => {
		expect(replayMinute(departure, hours, 0)).toBe(departure);
		expect(replayMinute(departure, hours, 1)).toBe(departure + hours);
	});

	it("keeps the same value in one simulated minute", () => {
		const a = replayMinute(departure, hours, 0.0001);
		const b = replayMinute(departure, hours, 0.0015);
		expect(a).toBe(b);
		expect((a ?? 1) % MINUTE).toBe(0);
	});

	it("gives null with no departure time", () => {
		expect(replayMinute(null, hours, 0.5)).toBeNull();
	});
});
