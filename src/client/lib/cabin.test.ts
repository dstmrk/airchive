import { describe, expect, it } from "vitest";
import { flightSearch, syncCabin } from "./cabin.ts";

describe("flightSearch", () => {
	it("keeps the cabin of the replay", () => {
		expect(flightSearch({ replay: true })).toEqual({ replay: true });
	});

	it.each([
		{},
		{ replay: false },
		{ replay: "1" },
		{ replay: null },
		{ other: true },
	])("gives no cabin for %o", (search) => {
		expect(flightSearch(search)).toEqual({});
	});
});

describe("syncCabin", () => {
	it("adds an entry to the history when the cabin opens", () => {
		expect(syncCabin({ open: true, inUrl: false, wasInUrl: false })).toBe(
			"push",
		);
	});

	it("stops the replay when the person goes back", () => {
		expect(syncCabin({ open: true, inUrl: false, wasInUrl: true })).toBe(
			"stop",
		);
	});

	it("removes the cabin from the URL when the replay did not start", () => {
		// A reload or a forward: the replay never starts alone.
		expect(syncCabin({ open: false, inUrl: true, wasInUrl: false })).toBe(
			"strip",
		);
		expect(syncCabin({ open: false, inUrl: true, wasInUrl: true })).toBe(
			"strip",
		);
	});

	it("does nothing when the URL and the cabin agree", () => {
		expect(syncCabin({ open: true, inUrl: true, wasInUrl: true })).toBeNull();
		expect(syncCabin({ open: true, inUrl: true, wasInUrl: false })).toBeNull();
		expect(syncCabin({ open: false, inUrl: false, wasInUrl: true })).toBeNull();
		expect(
			syncCabin({ open: false, inUrl: false, wasInUrl: false }),
		).toBeNull();
	});
});
