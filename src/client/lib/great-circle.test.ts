import { describe, expect, it } from "vitest";
import {
	distanceKm,
	greatCircle,
	type LonLat,
	routeBounds,
} from "./great-circle.ts";

const FCO: LonLat = [12.2508, 41.8045];
const NRT: LonLat = [140.3864, 35.7647];
const LAX: LonLat = [-118.4085, 33.9416];
const JFK: LonLat = [-73.7781, 40.6413];

function close(a: number, b: number, digits = 3) {
	expect(a).toBeCloseTo(b, digits);
}

describe("greatCircle", () => {
	it("starts and ends at the two airports", () => {
		const line = greatCircle(FCO, NRT);

		close(line[0]?.[0] ?? 0, FCO[0]);
		close(line[0]?.[1] ?? 0, FCO[1]);
		close(line.at(-1)?.[0] ?? 0, NRT[0]);
		close(line.at(-1)?.[1] ?? 0, NRT[1]);
	});

	it("gives the number of segments plus one point", () => {
		expect(greatCircle(FCO, NRT, 64)).toHaveLength(65);
	});

	it("passes through the known middle of a meridian", () => {
		const line = greatCircle([0, 0], [0, 90], 2);

		close(line[1]?.[0] ?? 1, 0);
		close(line[1]?.[1] ?? 0, 45);
	});

	it("goes north of the straight line on the map between Rome and New York", () => {
		const line = greatCircle(FCO, JFK, 2);

		expect(line[1]?.[1] ?? 0).toBeGreaterThan(50);
	});

	it("crosses the antimeridian with no jump of the longitude", () => {
		const line = greatCircle(NRT, LAX);
		const steps = line
			.slice(1)
			.map((point, i) => Math.abs(point[0] - (line[i]?.[0] ?? 0)));

		expect(Math.max(...steps)).toBeLessThan(10);
		// The line goes east from Tokyo, thus the longitudes pass 180.
		expect(line.at(-1)?.[0]).toBeCloseTo(LAX[0] + 360, 3);
	});

	it("gives two equal points for the same airport", () => {
		expect(greatCircle(FCO, FCO)).toEqual([FCO, FCO]);
	});

	it("gives a line with no NaN for two antipodes", () => {
		const line = greatCircle([0, 0], [180, 0]);

		expect(line.flat().every(Number.isFinite)).toBe(true);
	});
});

describe("routeBounds", () => {
	it("gives the south-west and the north-east corners", () => {
		expect(routeBounds([FCO, NRT])).toEqual([
			[FCO[0], NRT[1]],
			[NRT[0], FCO[1]],
		]);
	});

	it("keeps the longitudes past 180 of an unwrapped line", () => {
		const bounds = routeBounds(greatCircle(NRT, LAX));

		expect(bounds[0][0]).toBeCloseTo(NRT[0], 3);
		expect(bounds[1][0]).toBeCloseTo(LAX[0] + 360, 3);
	});
});

describe("distanceKm", () => {
	it("gives the distance on the great circle", () => {
		// Rome Fiumicino to Tokyo Narita: 9,860 km on the ellipsoid. The sphere is within 0.5%.
		expect(distanceKm(FCO, NRT)).toBeGreaterThan(9810);
		expect(distanceKm(FCO, NRT)).toBeLessThan(9910);
	});

	it("gives the same distance in the two directions", () => {
		close(distanceKm(LAX, NRT), distanceKm(NRT, LAX));
	});

	it("gives 0 for one point", () => {
		expect(distanceKm(JFK, JFK)).toBe(0);
	});
});
