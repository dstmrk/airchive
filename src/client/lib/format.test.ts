import { describe, expect, it } from "vitest";
import { formatDate } from "./format.ts";

describe("formatDate", () => {
	it("writes the day of the boarding pass, with no change of time zone", () => {
		// A conversion to the zone of the browser can move 2024-05-12 to the 11th.
		expect(formatDate("2024-05-12", "en")).toBe("May 12, 2024");
	});

	it("uses the locale", () => {
		expect(formatDate("2024-05-12", "it")).toBe("12 mag 2024");
	});
});
