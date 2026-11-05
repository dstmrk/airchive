import { describe, expect, it } from "vitest";
import {
	aheadPadding,
	angleBetween,
	heading,
	PITCH_3D,
	TURN_DEG_PER_S,
	threeD,
} from "./camera.ts";

describe("angleBetween", () => {
	it("gives the shortest turn to the right", () => {
		expect(angleBetween(10, 40)).toBe(30);
	});

	it("gives the shortest turn to the left", () => {
		expect(angleBetween(40, 10)).toBe(-30);
	});

	it("turns across the north", () => {
		expect(angleBetween(350, 10)).toBe(20);
		expect(angleBetween(10, 350)).toBe(-20);
	});

	it("gives 180 for a half turn, not -180", () => {
		expect(angleBetween(0, 180)).toBe(180);
		expect(angleBetween(90, 270)).toBe(180);
	});

	it("accepts angles out of the range from 0 to 360", () => {
		expect(angleBetween(-10, 370)).toBe(20);
	});
});

describe("heading", () => {
	const step = TURN_DEG_PER_S / 10; // In 100 ms.

	it("goes to the bearing of the aircraft with no heading before", () => {
		expect(heading(null, 120, 16, true)).toBe(120);
	});

	it("goes to the bearing of the aircraft when the change is small", () => {
		expect(heading(100, 101, 100, true)).toBe(101);
	});

	it("turns at a limited speed when the change is large", () => {
		expect(heading(100, 200, 100, true)).toBeCloseTo(100 + step, 9);
		expect(heading(100, 0, 100, true)).toBeCloseTo(100 - step, 9);
	});

	it("turns across the north in the range from 0 to 360", () => {
		const turned = heading(359, 90, 100, true);

		expect(turned).toBeCloseTo(359 + step - 360, 9);
		expect(turned).toBeGreaterThanOrEqual(0);
		expect(heading(1, 270, 100, true)).toBeCloseTo(1 - step + 360, 9);
	});

	it("arrives at the bearing after enough time", () => {
		let current = 0;
		for (let frame = 0; frame < 400; frame += 1) {
			current = heading(current, 170, 16, true);
		}

		expect(current).toBe(170);
	});

	it("goes to the bearing at once when the replay does not play", () => {
		// A seek of the person: the jump is the request.
		expect(heading(100, 280, 16, false)).toBe(280);
	});

	it("does not turn with no time or a negative time", () => {
		expect(heading(100, 200, 0, true)).toBe(100);
		expect(heading(100, 200, -50, true)).toBe(100);
	});

	it("does not turn more than the change after a long frame", () => {
		expect(heading(100, 110, 10_000, true)).toBe(110);
	});

	it("gives the bearing in the range from 0 to 360", () => {
		expect(heading(null, 360, 16, true)).toBe(0);
		expect(heading(null, -90, 16, false)).toBe(270);
	});
});

describe("aheadPadding", () => {
	it("puts the aircraft in the lower part of the map", () => {
		expect(aheadPadding(600)).toEqual({
			top: 200,
			bottom: 0,
			left: 0,
			right: 0,
		});
	});

	it("gives whole pixels", () => {
		expect(aheadPadding(640).top).toBe(213);
	});

	it("gives no padding for a map with no height", () => {
		expect(aheadPadding(0).top).toBe(0);
		expect(aheadPadding(-10).top).toBe(0);
		expect(aheadPadding(Number.NaN).top).toBe(0);
	});
});

describe("threeD", () => {
	it("is on when the replay starts, with no preference", () => {
		expect(threeD(false, { type: "reset", reduced: false })).toBe(true);
	});

	it("is off when the replay starts, with prefers-reduced-motion", () => {
		expect(threeD(true, { type: "reset", reduced: true })).toBe(false);
	});

	it("changes with the toggle", () => {
		expect(threeD(true, { type: "toggle" })).toBe(false);
		expect(threeD(false, { type: "toggle" })).toBe(true);
	});

	it("has a pitch that keeps the horizon out of the map", () => {
		// MapLibre shows the horizon above approximately 60 degrees.
		expect(PITCH_3D).toBeGreaterThan(0);
		expect(PITCH_3D).toBeLessThan(60);
	});
});
