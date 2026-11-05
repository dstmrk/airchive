import { describe, expect, it } from "vitest";
import { CRUISE_ALTITUDE_M } from "./flight-profile.ts";
import {
	AIRPORT_ZOOM,
	type AutoZoomEvent,
	autoZoom,
	cruiseZoom,
	INITIAL_AUTO_ZOOM,
	MAX_CRUISE_ZOOM,
	MIN_CRUISE_ZOOM,
	profileZoom,
} from "./profile-zoom.ts";

describe("cruiseZoom", () => {
	it("keeps the zoom that fits the leg between the limits", () => {
		expect(cruiseZoom(5.5)).toBe(5.5);
	});

	it("does not show the whole world for a long leg", () => {
		expect(cruiseZoom(1.5)).toBe(MIN_CRUISE_ZOOM);
	});

	it("shows a large area for a short leg", () => {
		expect(cruiseZoom(9)).toBe(MAX_CRUISE_ZOOM);
	});

	it("gives the minimum when the map cannot fit the leg", () => {
		expect(cruiseZoom(undefined)).toBe(MIN_CRUISE_ZOOM);
		expect(cruiseZoom(Number.NaN)).toBe(MIN_CRUISE_ZOOM);
		expect(cruiseZoom(Number.POSITIVE_INFINITY)).toBe(MIN_CRUISE_ZOOM);
	});
});

describe("profileZoom", () => {
	it("shows the airport on the ground", () => {
		expect(profileZoom(0, 5)).toBe(AIRPORT_ZOOM);
	});

	it("gives the cruise zoom at the cruise altitude", () => {
		expect(profileZoom(CRUISE_ALTITUDE_M, 5)).toBe(5);
	});

	it("is linear in the zoom between the two", () => {
		expect(profileZoom(CRUISE_ALTITUDE_M / 2, 5)).toBe((AIRPORT_ZOOM + 5) / 2);
	});

	it("zooms out less for the lower cruise of a short flight", () => {
		expect(profileZoom(CRUISE_ALTITUDE_M / 2, 7)).toBeGreaterThan(
			profileZoom(CRUISE_ALTITUDE_M, 7),
		);
	});

	it("stays between the airport and the cruise for an altitude out of range", () => {
		expect(profileZoom(-50, 5)).toBe(AIRPORT_ZOOM);
		expect(profileZoom(CRUISE_ALTITUDE_M * 2, 5)).toBe(5);
	});
});

const run = (events: AutoZoomEvent[], from = INITIAL_AUTO_ZOOM) =>
	events.reduce(autoZoom, from);

describe("autoZoom", () => {
	it("is on before an event", () => {
		expect(INITIAL_AUTO_ZOOM).toBe(true);
	});

	it("stops on a zoom of the person", () => {
		expect(run(["zoom"])).toBe(false);
	});

	it("stays off on a second zoom of the person", () => {
		expect(run(["zoom", "zoom"])).toBe(false);
	});

	it("starts again with the toggle", () => {
		expect(run(["zoom", "toggle"])).toBe(true);
	});

	it("stops with the toggle", () => {
		expect(run(["toggle"])).toBe(false);
	});

	it("is on again when the replay has no aircraft", () => {
		expect(run(["zoom", "reset"])).toBe(true);
	});
});
