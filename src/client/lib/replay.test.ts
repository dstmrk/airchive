import { describe, expect, it } from "vitest";
import { greatCircle, type LonLat } from "./great-circle.ts";
import {
	advance,
	DEFAULT_SPEED,
	flownRoute,
	inCabin,
	initialReplay,
	isLongSpeed,
	isTorn,
	position,
	type ReplayState,
	replay,
	replayMs,
	SPEEDS,
} from "./replay.ts";

const FCO: LonLat = [12.2508, 41.8045];
const NRT: LonLat = [140.3864, 35.7647];
const LAX: LonLat = [-118.4085, 33.9416];
const route = greatCircle(FCO, NRT);

describe("position", () => {
	it("is at the origin for t = 0 and at the destination for t = 1", () => {
		const start = position(route, 0);
		const end = position(route, 1);

		expect(start.lon).toBeCloseTo(FCO[0], 3);
		expect(start.lat).toBeCloseTo(FCO[1], 3);
		expect(end.lon).toBeCloseTo(NRT[0], 3);
		expect(end.lat).toBeCloseTo(NRT[1], 3);
	});

	it("goes north-east from Rome to Tokyo, over Siberia", () => {
		const start = position(route, 0);
		const middle = position(route, 0.5);

		expect(start.bearing).toBeGreaterThan(20);
		expect(start.bearing).toBeLessThan(60);
		expect(middle.lat).toBeGreaterThan(55);
	});

	it("keeps t in the range from 0 to 1", () => {
		expect(position(route, -1)).toEqual(position(route, 0));
		expect(position(route, 2)).toEqual(position(route, 1));
	});

	it("moves without a jump at the antimeridian", () => {
		const pacific = greatCircle(NRT, LAX);
		let previous = position(pacific, 0).lon;
		for (let i = 1; i <= 200; i += 1) {
			const { lon } = position(pacific, i / 200);
			expect(Math.abs(lon - previous)).toBeLessThan(2);
			previous = lon;
		}
	});

	it("gives a bearing from 0 to 360 at the last point", () => {
		const { bearing } = position(greatCircle(NRT, LAX), 1);

		expect(bearing).toBeGreaterThanOrEqual(0);
		expect(bearing).toBeLessThan(360);
	});

	it("gives a position for a route of two points", () => {
		expect(position([FCO, FCO], 0.5)).toMatchObject({
			lon: FCO[0],
			lat: FCO[1],
		});
	});
});

describe("flownRoute", () => {
	it("gives the part of the route before the aircraft", () => {
		const flown = flownRoute(route, 0.5);
		const here = position(route, 0.5);

		expect(flown[0]).toEqual(route[0]);
		expect(flown.at(-1)).toEqual([here.lon, here.lat]);
		expect(flown.length).toBeLessThan(route.length);
	});

	it("gives no line at the start", () => {
		expect(flownRoute(route, 0)).toEqual([]);
	});
});

describe("isLongSpeed", () => {
	it("is true only for a multiple of the real time", () => {
		expect(SPEEDS.filter((s) => isLongSpeed(s.id)).map((s) => s.id)).toEqual([
			"4x",
			"1x",
		]);
	});
});

describe("replayMs", () => {
	const hour = 3_600_000;

	it.each([
		["15s", 15_000],
		["30s", 30_000],
		["1min", 60_000],
		["5min", 300_000],
		["4x", hour / 4],
		["1x", hour],
	] as const)("gives the length of %s for a flight of one hour", (id, ms) => {
		expect(replayMs(id, hour)).toBe(ms);
	});

	it("starts at 30 seconds", () => {
		expect(DEFAULT_SPEED).toBe("30s");
	});

	it("gives each speed once, the shortest first", () => {
		const lengths = SPEEDS.map((speed) => replayMs(speed.id, 12 * hour));

		expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
		expect(new Set(SPEEDS.map((speed) => speed.id)).size).toBe(SPEEDS.length);
	});
});

describe("advance", () => {
	const flights = [
		{ width: 0.4, ms: 4000 },
		{ width: 0.2, ms: 0 },
		{ width: 0.4, ms: 2000 },
	];

	it("moves t at the speed of its part", () => {
		expect(advance(flights, 0.1, 1000)).toBeCloseTo(0.2);
		expect(advance(flights, 0.6, 1000)).toBeCloseTo(0.8);
	});

	it("goes across the end of a part at the speed of the next part", () => {
		// 1000 ms to the end of the first part, then 1000 ms of the last part: the second part has no length.
		expect(advance(flights, 0.3, 2000)).toBeCloseTo(0.8);
	});

	it("skips a part with no length", () => {
		expect(advance(flights, 0.4, 0)).toBeCloseTo(0.6);
		expect(advance(flights, 0.5, 1)).toBeCloseTo(0.6002);
	});

	it("stops at 1", () => {
		expect(advance(flights, 0.9, 60_000)).toBe(1);
		expect(advance(flights, 1, 10)).toBe(1);
	});

	it("gives the same t for no time in a part with a length", () => {
		expect(advance(flights, 0.1, 0)).toBeCloseTo(0.1);
	});
});

describe("replay", () => {
	const at = (phase: ReplayState["phase"], t: number): ReplayState => ({
		phase,
		t,
	});

	it("waits for the person: it never starts alone", () => {
		expect(initialReplay).toEqual(at("idle", 0));
	});

	it("tears the stub, then flies", () => {
		const boarding = replay(initialReplay, { type: "play" });

		expect(boarding).toEqual(at("boarding", 0));
		expect(replay(boarding, { type: "boarded" })).toEqual(at("playing", 0));
	});

	it("moves t with the time and the length of the replay", () => {
		expect(
			replay(at("playing", 0.25), {
				type: "tick",
				ms: 500,
				stretches: [{ width: 1, ms: 2000 }],
			}),
		).toEqual(at("playing", 0.5));
	});

	it("lands at t = 1", () => {
		expect(
			replay(at("playing", 0.9), {
				type: "tick",
				ms: 500,
				stretches: [{ width: 1, ms: 1000 }],
			}),
		).toEqual(at("landed", 1));
	});

	it("moves t only when it plays", () => {
		const paused = at("paused", 0.3);

		expect(
			replay(paused, {
				type: "tick",
				ms: 500,
				stretches: [{ width: 1, ms: 1000 }],
			}),
		).toBe(paused);
		expect(
			replay(at("boarding", 0), {
				type: "tick",
				ms: 500,
				stretches: [{ width: 1, ms: 1000 }],
			}),
		).toEqual(at("boarding", 0));
	});

	it("pauses and plays from the same point", () => {
		const paused = replay(at("playing", 0.4), { type: "pause" });

		expect(paused).toEqual(at("paused", 0.4));
		expect(replay(paused, { type: "play" })).toEqual(at("playing", 0.4));
	});

	it("flies again from the origin after the landing, with no tear", () => {
		expect(replay(at("landed", 1), { type: "play" })).toEqual(at("playing", 0));
	});

	it("flies again from the origin when the timeline is at the end", () => {
		expect(replay(at("paused", 1), { type: "play" })).toEqual(at("playing", 0));
	});

	it.each(["boarding", "playing", "paused", "landed"] as const)(
		"goes back to the pass from %s on a stop",
		(phase) => {
			expect(replay(at(phase, 0.6), { type: "stop" })).toEqual(initialReplay);
		},
	);

	it("keeps the state on a stop before the replay", () => {
		expect(replay(initialReplay, { type: "stop" })).toBe(initialReplay);
	});

	it("pauses at the point of the timeline", () => {
		expect(replay(at("playing", 0.2), { type: "seek", t: 0.7 })).toEqual(
			at("paused", 0.7),
		);
		expect(replay(initialReplay, { type: "seek", t: 1.5 })).toEqual(
			at("paused", 1),
		);
	});

	it("ignores a late end of the boarding", () => {
		const paused = at("paused", 0.5);

		expect(replay(paused, { type: "boarded" })).toBe(paused);
	});
});

describe("isTorn", () => {
	it.each([
		["idle", false],
		["boarding", true],
		["playing", true],
		["paused", true],
		["landed", false],
	] as const)("gives %s: %s", (phase, torn) => {
		expect(isTorn({ phase, t: 0.5 })).toBe(torn);
	});
});

describe("inCabin", () => {
	it.each([
		["idle", false],
		["boarding", false],
		["playing", true],
		["paused", true],
		["landed", true],
	] as const)("gives %s: %s", (phase, cabin) => {
		expect(inCabin({ phase, t: 0.5 })).toBe(cabin);
	});
});
