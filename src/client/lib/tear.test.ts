import { describe, expect, it } from "vitest";
import {
	PULL_LIMIT,
	poseTransform,
	pullDistance,
	pullPose,
	returnKeyframes,
	SNAP_MS,
	stubKeyframes,
	stubPose,
	TEAR_DEPTH,
	TEAR_MS,
	tearLine,
	tornEdge,
} from "./tear.ts";

const AXES = ["below", "right"] as const;

describe("tearLine", () => {
	it("crosses the perforation from one end to the other", () => {
		const line = tearLine();

		expect(line[0]?.at).toBe(0);
		expect(line.at(-1)?.at).toBe(100);
		for (let i = 1; i < line.length; i++) {
			expect(line[i]?.at).toBeGreaterThan(line[i - 1]?.at ?? -1);
		}
	});

	it("stays in the strip where the stub covers the body", () => {
		for (const point of tearLine()) {
			expect(point.depth).toBeGreaterThanOrEqual(0);
			expect(point.depth).toBeLessThanOrEqual(TEAR_DEPTH);
		}
	});

	it("is not a straight line", () => {
		const depths = new Set(tearLine().map((point) => point.depth));

		expect(depths.size).toBeGreaterThan(10);
	});

	it("gives the same line at each call, thus the two edges fit", () => {
		expect(tearLine()).toEqual(tearLine());
	});
});

describe("tornEdge", () => {
	it("keeps the body above the line when the stub is below", () => {
		const edge = tornEdge("body", "below");
		const first = tearLine()[0];

		expect(edge.startsWith("polygon(0 0, 100% 0, ")).toBe(true);
		expect(edge).toContain(`0% calc(100% - ${first?.depth}px)`);
	});

	it("keeps the stub under the same line when the stub is below", () => {
		const edge = tornEdge("stub", "below");
		const first = tearLine()[0];

		expect(edge).toContain(`0% ${TEAR_DEPTH - (first?.depth ?? 0)}px`);
		expect(edge.endsWith("100% 100%, 0 100%)")).toBe(true);
	});

	it("cuts the right side of the body when the stub is on the right", () => {
		const edge = tornEdge("body", "right");
		const last = tearLine().at(-1);

		expect(edge.startsWith("polygon(0 0, ")).toBe(true);
		expect(edge).toContain(`calc(100% - ${last?.depth}px) 100%`);
		expect(edge.endsWith("0 100%)")).toBe(true);
	});

	it("cuts the left side of the stub when the stub is on the right", () => {
		const edge = tornEdge("stub", "right");
		const first = tearLine()[0];

		expect(edge).toContain(`${TEAR_DEPTH - (first?.depth ?? 0)}px 0%`);
		expect(edge).toContain("100% 0, 100% 100%");
	});

	it("gives each point of the line to the two edges", () => {
		for (const axis of AXES) {
			expect(tornEdge("body", axis).split(", ").length).toBe(
				tearLine().length + 2,
			);
			expect(tornEdge("stub", axis).split(", ").length).toBe(
				tearLine().length + 2,
			);
		}
	});
});

describe("pullDistance", () => {
	it("measures a pull down when the stub is below", () => {
		expect(pullDistance("below", 30, 50)).toBe(50);
	});

	it("measures a pull to the right when the stub is on the right", () => {
		expect(pullDistance("right", 30, 50)).toBe(30);
	});

	it("gives zero for a push into the body", () => {
		expect(pullDistance("below", 0, -40)).toBe(0);
		expect(pullDistance("right", -40, 0)).toBe(0);
	});
});

describe("pullPose", () => {
	it("leaves the stub on the pass with no pull", () => {
		for (const axis of AXES) {
			expect(pullPose(axis, 0)).toEqual({ x: 0, y: 0, angle: 0, opacity: 1 });
		}
	});

	it("follows the finger along one axis, with the resistance of the paper", () => {
		const below = pullPose("below", 40);
		const right = pullPose("right", 40);

		expect(below.x).toBe(0);
		expect(below.y).toBeGreaterThan(0);
		expect(below.y).toBeLessThan(40);
		expect(right.y).toBe(0);
		expect(right.x).toBeGreaterThan(0);
		expect(right.x).toBeLessThan(40);
	});

	it("opens the tear more for a longer pull", () => {
		expect(pullPose("below", 50).angle).toBeGreaterThan(
			pullPose("below", 20).angle,
		);
	});

	it("stops at the pose of the tear after the limit", () => {
		expect(pullPose("below", PULL_LIMIT * 3)).toEqual(
			pullPose("below", PULL_LIMIT),
		);
	});

	it("gives the pose of the tear at the limit", () => {
		for (const axis of AXES) {
			expect(pullPose(axis, PULL_LIMIT)).toEqual(stubPose(axis, SNAP_MS));
		}
	});
});

describe("stubPose", () => {
	it("starts on the pass", () => {
		for (const axis of AXES) {
			expect(stubPose(axis, 0)).toEqual({ x: 0, y: 0, angle: 0, opacity: 1 });
		}
	});

	it("turns about the end of the perforation before it falls", () => {
		for (const axis of AXES) {
			const snap = stubPose(axis, SNAP_MS);

			expect(snap.angle).toBeGreaterThan(0);
			expect(snap.opacity).toBe(1);
		}
	});

	it("falls faster and faster after the tear", () => {
		for (const axis of AXES) {
			const a = stubPose(axis, SNAP_MS + 100).y - stubPose(axis, SNAP_MS).y;
			const b =
				stubPose(axis, SNAP_MS + 200).y - stubPose(axis, SNAP_MS + 100).y;

			expect(b).toBeGreaterThan(a);
		}
	});

	it("turns always in the same direction", () => {
		for (const axis of AXES) {
			let last = -1;
			for (let ms = 0; ms <= TEAR_MS; ms += 20) {
				const { angle } = stubPose(axis, ms);
				expect(angle).toBeGreaterThan(last);
				last = angle;
			}
		}
	});

	it("goes away from the body", () => {
		expect(stubPose("below", TEAR_MS).y).toBeGreaterThan(100);
		expect(stubPose("right", TEAR_MS).x).toBeGreaterThan(0);
	});

	it("has no horizontal drift when the stub is below", () => {
		for (let ms = 0; ms <= TEAR_MS; ms += 50) {
			expect(stubPose("below", ms).x).toBe(0);
		}
	});

	it("is not visible at the end", () => {
		for (const axis of AXES) {
			expect(stubPose(axis, TEAR_MS).opacity).toBe(0);
		}
	});

	it("stays at the end after the duration", () => {
		expect(stubPose("below", TEAR_MS + 500)).toEqual(
			stubPose("below", TEAR_MS),
		);
	});
});

describe("poseTransform", () => {
	it("writes the translation before the rotation", () => {
		expect(poseTransform({ x: 1.234, y: 5, angle: 6.5, opacity: 1 })).toBe(
			"translate(1.23px, 5px) rotate(6.5deg)",
		);
	});
});

describe("stubKeyframes", () => {
	it("gives offsets from 0 to 1 in order", () => {
		for (const axis of AXES) {
			for (const start of ["pass", "tear"] as const) {
				const offsets = stubKeyframes(axis, start).map(
					(frame) => frame.offset as number,
				);

				expect(offsets[0]).toBe(0);
				expect(offsets.at(-1)).toBe(1);
				for (let i = 1; i < offsets.length; i++) {
					expect(offsets[i]).toBeGreaterThan(offsets[i - 1] ?? -1);
				}
			}
		}
	});

	it("starts on the pass for the button", () => {
		const first = stubKeyframes("below", "pass")[0];

		expect(first?.transform).toBe("translate(0px, 0px) rotate(0deg)");
		expect(first?.opacity).toBe(1);
	});

	it("has a frame at the tear for the button", () => {
		const offsets = stubKeyframes("below", "pass").map((frame) => frame.offset);

		expect(offsets).toContain(SNAP_MS / TEAR_MS);
	});

	it("starts at the pose of the tear after a pull", () => {
		for (const axis of AXES) {
			expect(stubKeyframes(axis, "tear")[0]?.transform).toBe(
				poseTransform(pullPose(axis, PULL_LIMIT)),
			);
		}
	});

	it("ends with the stub not visible", () => {
		for (const start of ["pass", "tear"] as const) {
			expect(stubKeyframes("right", start).at(-1)?.opacity).toBe(0);
		}
	});

	it("turns the stub about the end of the perforation", () => {
		expect(stubKeyframes("below", "pass")[0]?.transformOrigin).toBe("0 0");
		expect(stubKeyframes("right", "tear")[0]?.transformOrigin).toBe("0 100%");
	});
});

describe("returnKeyframes", () => {
	it("puts the stub back on the pass from the pose of the finger", () => {
		const pose = pullPose("below", 30);
		const frames = returnKeyframes("below", pose);

		expect(frames[0]?.transform).toBe(poseTransform(pose));
		expect(frames.at(-1)?.transform).toBe("translate(0px, 0px) rotate(0deg)");
		expect(frames[0]?.transformOrigin).toBe("0 0");
	});
});
