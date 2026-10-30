import { describe, expect, it } from "vitest";
import { type FollowEvent, follow } from "./follow.ts";

const run = (events: FollowEvent[], from = false) =>
	events.reduce(follow, from);

describe("follow", () => {
	it("starts on a tap of the aircraft", () => {
		expect(run(["tap"])).toBe(true);
	});

	it("stops on a second tap of the aircraft", () => {
		expect(run(["tap", "tap"])).toBe(false);
	});

	it("stops when the person moves the map", () => {
		expect(run(["tap", "drag"])).toBe(false);
	});

	it("stays off when the person moves the map and follow is off", () => {
		expect(run(["drag"])).toBe(false);
	});

	it("needs a new tap after a drag", () => {
		expect(run(["tap", "drag", "tap"])).toBe(true);
	});

	it("stops when the replay has no aircraft", () => {
		expect(run(["reset"], true)).toBe(false);
	});
});
