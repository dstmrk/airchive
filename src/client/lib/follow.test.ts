import { describe, expect, it } from "vitest";
import { type FollowEvent, follow, INITIAL_FOLLOW } from "./follow.ts";

const run = (events: FollowEvent[], from = INITIAL_FOLLOW) =>
	events.reduce(follow, from);

describe("follow", () => {
	it("is on before an event", () => {
		expect(INITIAL_FOLLOW).toBe(true);
	});

	it("stops on a tap of the aircraft", () => {
		expect(run(["tap"])).toBe(false);
	});

	it("starts again on a second tap of the aircraft", () => {
		expect(run(["tap", "tap"])).toBe(true);
	});

	it("stops when the person moves the map", () => {
		expect(run(["drag"])).toBe(false);
	});

	it("stays off when the person moves the map and follow is off", () => {
		expect(run(["drag", "drag"])).toBe(false);
	});

	it("needs a tap after a drag", () => {
		expect(run(["drag", "tap"])).toBe(true);
	});

	it("is on again when the replay has no aircraft", () => {
		expect(run(["drag", "reset"])).toBe(true);
	});
});
