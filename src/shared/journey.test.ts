import { describe, expect, it } from "vitest";
import {
	journeyTitleSchema,
	type LegOrder,
	orderLegs,
	overlapsLeg,
} from "./journey.ts";

const leg = (
	origin: string,
	destination: string,
	departureDate: string,
	departureTime: string | null = null,
): LegOrder => ({ origin, destination, departureDate, departureTime });

const codes = (legs: readonly LegOrder[]) =>
	legs.map((l) => `${l.origin}-${l.destination}`);

describe("orderLegs", () => {
	it("orders the legs by date", () => {
		const legs = [
			leg("AUH", "NRT", "2024-05-13"),
			leg("TRN", "FCO", "2024-05-12"),
		];

		expect(codes(orderLegs(legs))).toEqual(["TRN-FCO", "AUH-NRT"]);
	});

	it("follows the chain of the airports on one day with no times", () => {
		const legs = [
			leg("AUH", "NRT", "2024-05-12"),
			leg("FCO", "AUH", "2024-05-12"),
			leg("TRN", "FCO", "2024-05-12"),
		];

		expect(codes(orderLegs(legs))).toEqual(["TRN-FCO", "FCO-AUH", "AUH-NRT"]);
	});

	it("follows the chain before the dates across the date line", () => {
		// Tokyo to Honolulu lands on the previous local day: the next leg has an earlier date.
		const legs = [
			leg("NRT", "HNL", "2024-05-13", "21:00"),
			leg("HNL", "LAX", "2024-05-12", "13:00"),
		];

		expect(codes(orderLegs(legs))).toEqual(["NRT-HNL", "HNL-LAX"]);
	});

	it("follows the chain before the local times, which are in different zones", () => {
		// 06:10 in Abu Dhabi is after 00:30 in Rome on this day, but the chain decides.
		const legs = [
			leg("AUH", "NRT", "2024-05-12", "00:30"),
			leg("FCO", "AUH", "2024-05-12", "06:10"),
		];

		expect(codes(orderLegs(legs))).toEqual(["FCO-AUH", "AUH-NRT"]);
	});

	it("orders by time when the legs of one day make no chain", () => {
		const legs = [
			leg("LGW", "NRT", "2024-05-12", "18:00"),
			leg("TRN", "LHR", "2024-05-12", "07:00"),
		];

		expect(codes(orderLegs(legs))).toEqual(["TRN-LHR", "LGW-NRT"]);
	});

	it("starts a loop of one day at the earliest time", () => {
		const legs = [
			leg("FCO", "TRN", "2024-05-12", "19:00"),
			leg("TRN", "FCO", "2024-05-12", "07:00"),
		];

		expect(codes(orderLegs(legs))).toEqual(["TRN-FCO", "FCO-TRN"]);
	});

	it("puts a leg with no time after the legs with a time when no chain decides", () => {
		const legs = [
			leg("MXP", "CDG", "2024-05-12"),
			leg("TRN", "FCO", "2024-05-12", "07:00"),
		];

		expect(codes(orderLegs(legs))).toEqual(["TRN-FCO", "MXP-CDG"]);
	});

	it("does not change the array that it receives", () => {
		const legs = [leg("B", "C", "2024-05-13"), leg("A", "B", "2024-05-12")];

		orderLegs(legs);

		expect(codes(legs)).toEqual(["B-C", "A-B"]);
	});

	it("gives an empty list for no legs", () => {
		expect(orderLegs([])).toEqual([]);
	});
});

describe("journeyTitleSchema", () => {
	it("keeps a title with no spaces at the ends", () => {
		expect(journeyTitleSchema.parse({ title: "  Japan 2024 " })).toEqual({
			title: "Japan 2024",
		});
	});

	it.each([[""], ["   "], [null]])(
		"gives null for the title %o, thus the client gives the default",
		(title) => {
			expect(journeyTitleSchema.parse({ title })).toEqual({ title: null });
		},
	);

	it("refuses a title of more than 80 characters", () => {
		expect(
			journeyTitleSchema.safeParse({ title: "x".repeat(81) }).success,
		).toBe(false);
	});

	it("refuses another field", () => {
		expect(
			journeyTitleSchema.safeParse({ title: "A", ownerId: "x" }).success,
		).toBe(false);
	});
});

describe("overlapsLeg", () => {
	const ZONES: Record<string, string> = {
		FCO: "Europe/Rome",
		AUH: "Asia/Dubai",
		NRT: "Asia/Tokyo",
	};
	const zone = (code: string) => ZONES[code];
	const fcoAuh = {
		origin: "FCO",
		destination: "AUH",
		departureDate: "2024-05-12",
		departureTime: "10:45",
		arrivalDate: "2024-05-12",
		arrivalTime: "18:30",
	};
	const auhNrt = (departureTime: string | null) => ({
		origin: "AUH",
		destination: "NRT",
		departureDate: "2024-05-12",
		departureTime,
		arrivalDate: "2024-05-13",
		arrivalTime: departureTime && "12:25",
	});

	it("is false for a connection after the landing", () => {
		expect(overlapsLeg(auhNrt("21:50"), [fcoAuh], zone)).toBe(false);
	});

	it("is true for a departure before the previous landing", () => {
		// 18:00 in Abu Dhabi is before the landing at 18:30.
		expect(overlapsLeg(auhNrt("18:00"), [fcoAuh], zone)).toBe(true);
	});

	it("is false for a departure at the minute of the landing", () => {
		expect(overlapsLeg(auhNrt("18:30"), [fcoAuh], zone)).toBe(false);
	});

	it("is false when a leg has no times", () => {
		expect(overlapsLeg(auhNrt(null), [fcoAuh], zone)).toBe(false);
	});

	it("is false for an airport with no time zone", () => {
		expect(overlapsLeg(auhNrt("18:00"), [fcoAuh], () => undefined)).toBe(false);
	});
});
