import { describe, expect, it } from "vitest";
import { legInstants, zonedInstant } from "./zoned-time.ts";

describe("zonedInstant", () => {
	it("reads a wall-clock time in a time zone", () => {
		expect(
			new Date(
				zonedInstant("2024-05-12", "13:05", "Europe/Rome"),
			).toISOString(),
		).toBe("2024-05-12T11:05:00.000Z");
	});

	it("uses the offset of winter in winter", () => {
		expect(
			new Date(
				zonedInstant("2024-01-12", "13:05", "Europe/Rome"),
			).toISOString(),
		).toBe("2024-01-12T12:05:00.000Z");
	});

	it("reads a zone west of Greenwich", () => {
		expect(
			new Date(
				zonedInstant("2024-11-03", "08:40", "America/New_York"),
			).toISOString(),
		).toBe("2024-11-03T13:40:00.000Z");
	});
});

describe("legInstants", () => {
	const iso = (instant: number | null) =>
		instant === null ? null : new Date(instant).toISOString();
	const leg = {
		departureDate: "2024-05-12",
		departureTime: "21:50",
		arrivalDate: "2024-05-13",
		arrivalTime: "12:25",
	};

	it("gives the two instants of a leg", () => {
		const { departure, arrival } = legInstants(leg, "Asia/Dubai", "Asia/Tokyo");

		expect(iso(departure)).toBe("2024-05-12T17:50:00.000Z");
		expect(iso(arrival)).toBe("2024-05-13T03:25:00.000Z");
	});

	it("puts an arrival with no date on the next day when its time is earlier", () => {
		const { arrival } = legInstants(
			{ ...leg, arrivalDate: null },
			"Asia/Dubai",
			"Asia/Tokyo",
		);

		expect(iso(arrival)).toBe("2024-05-13T03:25:00.000Z");
	});

	it("gives no arrival with no departure time or no arrival time", () => {
		expect(legInstants({ ...leg, departureTime: null }, "UTC", "UTC")).toEqual({
			departure: null,
			arrival: null,
		});
		expect(
			legInstants({ ...leg, arrivalTime: null }, "UTC", "UTC").arrival,
		).toBe(null);
	});

	it("gives no arrival for a flight of one day or more", () => {
		expect(
			legInstants({ ...leg, arrivalDate: "2024-05-14" }, "UTC", "UTC").arrival,
		).toBe(null);
	});
});
