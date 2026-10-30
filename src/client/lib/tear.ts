/**
 * The tear of the stub. The stub turns about one end of the perforation while
 * the tear opens, then it falls with gravity. A finger can pull the stub to the
 * limit of the tear, or the button gives the same tear with no finger.
 */

/** The side of the body where the stub is: below on a telephone, on the right from 640 px. */
export type TearAxis = "below" | "right";

export type Pose = { x: number; y: number; angle: number; opacity: number };

/** The time from the button to the cabin. */
export const TEAR_MS = 700;
/** The time of the tear along the perforation. Then the stub falls. */
export const SNAP_MS = 280;
/** The distance of a pull that tears the stub, in CSS pixels. */
export const PULL_LIMIT = 72;
/** A shorter movement of the pointer is a tap, not a pull. */
export const DRAG_SLOP = 4;
/** The stub covers this strip of the body, and the line of the tear stays in it. */
export const TEAR_DEPTH = 3;

/** The paper resists: the stub moves less than the finger. */
const FOLLOW = 0.15;
const GRAVITY = 1500;
const FALL_MS = TEAR_MS - SNAP_MS;
const FADE_FROM_S = 0.1;

const MOTION: Record<
	TearAxis,
	{ angle: number; drift: number; spin: number; origin: string }
> = {
	// The stub turns about its top left corner: the tear opens from the right.
	below: {
		angle: 8,
		drift: (2 * PULL_LIMIT * FOLLOW) / (SNAP_MS / 1000),
		spin: 40,
		origin: "0 0",
	},
	// The stub turns about its bottom left corner: the tear opens from the top.
	// A short drift keeps the stub near the page, thus the page does not scroll sideways.
	right: { angle: 4, drift: 60, spin: 0, origin: "0 100%" },
};

const IDENTITY: Pose = { x: 0, y: 0, angle: 0, opacity: 1 };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The pose of the stub for a fraction of the tear, from 0 (on the pass) to 1 (torn). */
function tearPose(axis: TearAxis, fraction: number): Pose {
	const p = clamp01(fraction);
	const shift = PULL_LIMIT * FOLLOW * p;
	return {
		x: axis === "right" ? shift : 0,
		y: axis === "below" ? shift : 0,
		angle: MOTION[axis].angle * p,
		opacity: 1,
	};
}

/** The distance of the pointer away from the body. A push into the body gives zero. */
export function pullDistance(axis: TearAxis, dx: number, dy: number): number {
	return Math.max(0, axis === "below" ? dy : dx);
}

/** The pose of the stub under the finger. */
export function pullPose(axis: TearAxis, distance: number): Pose {
	return tearPose(axis, distance / PULL_LIMIT);
}

/** The pose of the stub after the end of the tear. */
function fallPose(axis: TearAxis, ms: number): Pose {
	const s = Math.min(ms, FALL_MS) / 1000;
	const { angle, drift, spin } = MOTION[axis];
	const start = tearPose(axis, 1);
	const turn = (2 * angle) / (SNAP_MS / 1000);
	const along = start.x + start.y + drift * s;
	const fall = (GRAVITY * s * s) / 2;
	return {
		x: axis === "right" ? along : 0,
		y: axis === "below" ? along + fall : fall,
		angle: angle + turn * s + (spin * s * s) / 2,
		opacity: clamp01(1 - (s - FADE_FROM_S) / (FALL_MS / 1000 - FADE_FROM_S)),
	};
}

/** The pose of the stub after the button, `ms` after the start of the tear. */
export function stubPose(axis: TearAxis, ms: number): Pose {
	if (ms <= SNAP_MS) {
		// The tear accelerates along the perforation.
		const u = Math.max(0, ms) / SNAP_MS;
		return tearPose(axis, u * u);
	}
	return fallPose(axis, ms - SNAP_MS);
}

const round = (value: number) => +value.toFixed(2);

export function poseTransform({ x, y, angle }: Pose): string {
	return `translate(${round(x)}px, ${round(y)}px) rotate(${round(angle)}deg)`;
}

const frame = (axis: TearAxis, pose: Pose, offset: number): Keyframe => ({
	offset,
	transform: poseTransform(pose),
	transformOrigin: MOTION[axis].origin,
	opacity: round(pose.opacity),
});

const STEP_MS = 35;

/**
 * The keyframes of the stub for the Web Animations API, with a linear easing.
 * `pass` starts on the pass, after the button. `tear` starts at the limit of a pull.
 */
export function stubKeyframes(
	axis: TearAxis,
	start: "pass" | "tear",
): Keyframe[] {
	const frames: Keyframe[] = [];
	if (start === "pass") {
		for (let ms = 0; ms < SNAP_MS; ms += SNAP_MS / 4) {
			frames.push(frame(axis, stubPose(axis, ms), ms / TEAR_MS));
		}
		for (let ms = SNAP_MS; ms <= TEAR_MS; ms += STEP_MS) {
			frames.push(frame(axis, stubPose(axis, ms), ms / TEAR_MS));
		}
		return frames;
	}
	for (let ms = 0; ms <= FALL_MS; ms += STEP_MS) {
		frames.push(frame(axis, fallPose(axis, ms), ms / FALL_MS));
	}
	return frames;
}

/** The duration of the keyframes of `stubKeyframes`. */
export const fallDuration = (start: "pass" | "tear") =>
	start === "pass" ? TEAR_MS : FALL_MS;

/** The keyframes that put the stub back on the pass after a short pull. */
export function returnKeyframes(axis: TearAxis, pose: Pose): Keyframe[] {
	const origin = MOTION[axis].origin;
	return [
		{ transform: poseTransform(pose), transformOrigin: origin },
		{ transform: poseTransform(IDENTITY), transformOrigin: origin },
	];
}

/** The transform origin of the stub, at the end of the perforation that holds last. */
export const tearOrigin = (axis: TearAxis) => MOTION[axis].origin;

const POINTS = 40;

/**
 * The line of the tear: for each position along the perforation (0 to 100 %),
 * the depth into the strip where the stub covers the body. One fixed seed
 * gives the same line to the body and to the stub, thus the two edges fit.
 */
export function tearLine(): { at: number; depth: number }[] {
	let seed = 0x2f6b;
	const random = () => {
		// mulberry32
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	const line: { at: number; depth: number }[] = [];
	let depth = TEAR_DEPTH / 2;
	for (let i = 0; i <= POINTS; i++) {
		// A random walk gives the long waves of the paper, the noise gives the fibres.
		depth = Math.min(
			TEAR_DEPTH * 0.8,
			Math.max(TEAR_DEPTH * 0.2, depth + (random() - 0.5) * 1.2),
		);
		const fibre = (random() - 0.5) * 0.8;
		line.push({
			at: round((i * 100) / POINTS),
			depth: round(Math.min(TEAR_DEPTH, Math.max(0, depth + fibre))),
		});
	}
	return line;
}

/** The `clip-path` of the body or of the stub along the line of the tear. */
export function tornEdge(part: "body" | "stub", axis: TearAxis): string {
	const line = tearLine();
	const reversed = [...line].reverse();
	let points: string[];
	if (axis === "below") {
		points =
			part === "body"
				? [
						"0 0",
						"100% 0",
						...reversed.map((p) => `${p.at}% calc(100% - ${p.depth}px)`),
					]
				: [
						...line.map((p) => `${p.at}% ${TEAR_DEPTH - p.depth}px`),
						"100% 100%",
						"0 100%",
					];
	} else {
		points =
			part === "body"
				? [
						"0 0",
						...line.map((p) => `calc(100% - ${p.depth}px) ${p.at}%`),
						"0 100%",
					]
				: [
						"100% 0",
						"100% 100%",
						...reversed.map((p) => `${TEAR_DEPTH - p.depth}px ${p.at}%`),
					];
	}
	return `polygon(${points.join(", ")})`;
}

export const reducedMotion = () =>
	globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
