import { describe, expect, it, vi } from "vitest";
import { withViewTransition } from "./view-transition.ts";

describe("withViewTransition", () => {
	it("gives the update to the View Transitions API", () => {
		const update = vi.fn();
		const start = vi.fn((callback: () => void) => callback());

		withViewTransition(update, { reduce: false, start });

		expect(start).toHaveBeenCalledOnce();
		expect(update).toHaveBeenCalledOnce();
	});

	it("updates with no transition when the person reduces the motion", () => {
		const update = vi.fn();
		const start = vi.fn();

		withViewTransition(update, { reduce: true, start });

		expect(start).not.toHaveBeenCalled();
		expect(update).toHaveBeenCalledOnce();
	});

	it("updates with no transition when the browser has no API", () => {
		const update = vi.fn();

		withViewTransition(update, { reduce: false, start: undefined });

		expect(update).toHaveBeenCalledOnce();
	});
});
