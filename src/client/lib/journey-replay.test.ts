import { describe, expect, it } from "vitest";
import type { Airport } from "../../shared/airport.ts";
import type { FlightView } from "../../shared/flight.ts";
import {
	finalArrival,
	type JourneyLeg,
	journeyLegs,
	journeyMap,
	journeyMomentAt,
	journeyStretches,
	journeyTimeline,
	landingMarks,
} from "./journey-replay.ts";

const airport = (iata: string, lon: number, lat: number): Airport => ({
	iata,
	name: iata,
	city: iata,
	country: "XX",
	lat,
	lon,
	tz: "UTC",
});

const FCO = airport("FCO", 12.2508, 41.8045);
const AUH = airport("AUH", 54.6511, 24.4329);
const NRT = airport("NRT", 140.3864, 35.7647);
const HNL = airport("HNL", -157.9251, 21.3187);
const LAX = airport("LAX", -118.4085, 33.9416);
const LHR = airport("LHR", -0.4543, 51.47);
const LGW = airport("LGW", -0.1821, 51.1537);

const HOUR = 3_600_000;
const T0 = Date.UTC(2024, 4, 12, 8, 45);

const leg = (
	origin: Airport,
	destination: Airport,
	departure: number | null,
	hours: number,
): JourneyLeg => ({
	origin,
	destination,
	timing: { departure, durationMs: hours * HOUR, estimated: false },
});

// FCO 08:45 to AUH (6 h), a stop of 3 h, AUH to NRT (9 h).
const tokyo = journeyTimeline([
	leg(FCO, AUH, T0, 6),
	leg(AUH, NRT, T0 + 9 * HOUR, 9),
]);

describe("journeyTimeline", () => {
	it("puts the stop between the flights, in real time", () => {
		expect(tokyo.parts).toEqual([
			{ kind: "flight", leg: 0, startMs: 0, ms: 6 * HOUR },
			{ kind: "stop", leg: 0, startMs: 6 * HOUR, ms: 3 * HOUR },
			{ kind: "flight", leg: 1, startMs: 9 * HOUR, ms: 9 * HOUR },
		]);
		expect(tokyo.totalMs).toBe(18 * HOUR);
	});

	it("gives a stop with no length when a leg has no departure time", () => {
		const timeline = journeyTimeline([
			leg(FCO, AUH, T0, 6),
			leg(AUH, NRT, null, 9),
		]);

		expect(timeline.parts[1]).toMatchObject({ kind: "stop", ms: 0 });
		expect(timeline.totalMs).toBe(15 * HOUR);
	});

	it("gives a stop with no length for two legs that overlap", () => {
		const timeline = journeyTimeline([
			leg(FCO, AUH, T0, 6),
			leg(AUH, NRT, T0 + 5 * HOUR, 9),
		]);

		expect(timeline.parts[1]).toMatchObject({ ms: 0 });
	});

	it("keeps the longitudes continuous from one leg to the next across the antimeridian", () => {
		const timeline = journeyTimeline([
			leg(NRT, HNL, null, 7),
			leg(HNL, LAX, null, 5),
		]);
		const [first = [], second = []] = timeline.routes;

		expect(first.at(-1)?.[0]).toBeCloseTo(360 + HNL.lon, 6);
		expect(second[0]?.[0]).toBeCloseTo(360 + HNL.lon, 6);
		expect(second.at(-1)?.[0]).toBeCloseTo(360 + LAX.lon, 6);
	});

	it("gives one part for one leg", () => {
		const timeline = journeyTimeline([leg(FCO, NRT, T0, 12)]);

		expect(timeline.parts).toEqual([
			{ kind: "flight", leg: 0, startMs: 0, ms: 12 * HOUR },
		]);
	});
});

describe("journeyStretches", () => {
	it("shares a short replay between the flights by duration, and skips the stop", () => {
		expect(journeyStretches(tokyo, "30s")).toEqual([
			{ width: 6 / 18, ms: 12_000 },
			{ width: 3 / 18, ms: 0 },
			{ width: 9 / 18, ms: 18_000 },
		]);
	});

	it("gives a long replay as a multiple of the flight time", () => {
		expect(journeyStretches(tokyo, "4x").map((s) => s.ms)).toEqual([
			1.5 * HOUR,
			0,
			2.25 * HOUR,
		]);
	});

	it("gives the replay of one flight for one leg", () => {
		const timeline = journeyTimeline([leg(FCO, NRT, T0, 12)]);

		expect(journeyStretches(timeline, "1min")).toEqual([
			{ width: 1, ms: 60_000 },
		]);
	});
});

describe("journeyMomentAt", () => {
	it("starts at the first origin and lands at the final destination", () => {
		const start = journeyMomentAt(tokyo, 0);
		const end = journeyMomentAt(tokyo, 1);

		expect(start.aircraft.lon).toBeCloseTo(FCO.lon, 4);
		expect(start.leg).toBe(0);
		expect(end.aircraft.lon).toBeCloseTo(NRT.lon, 4);
		expect(end.leg).toBe(1);
		expect(end.remainingKm).toBe(0);
	});

	it("keeps the aircraft on the ground at the airport of the stop", () => {
		const moment = journeyMomentAt(tokyo, 7.5 / 18);

		expect(moment).toMatchObject({ leg: 0, stop: true });
		expect(moment.moment.speedKmh).toBe(0);
		expect(moment.moment.altitudeM).toBe(0);
		expect(moment.aircraft.lon).toBeCloseTo(AUH.lon, 4);
		expect(moment.flown).toHaveLength(1);
		expect(moment.instant).toBe(T0 + 7.5 * HOUR);
	});

	it("flies the second leg after the stop, with the first leg behind it", () => {
		const moment = journeyMomentAt(tokyo, 13.5 / 18);

		expect(moment).toMatchObject({ leg: 1, stop: false });
		expect(moment.moment.altitudeM).toBeGreaterThan(10_000);
		expect(moment.flown).toHaveLength(2);
		expect(moment.flown[0]).toEqual(tokyo.routes[0]);
		expect(moment.instant).toBe(T0 + 13.5 * HOUR);
	});

	it("gives the distance to the final destination, also from the first leg", () => {
		const [first, second] = tokyo.profiles;
		const total = (first?.distanceKm ?? 0) + (second?.distanceKm ?? 0);
		const stop = journeyMomentAt(tokyo, 7 / 18);

		expect(journeyMomentAt(tokyo, 0).remainingKm).toBeCloseTo(total, 6);
		expect(stop.remainingKm).toBeCloseTo(second?.distanceKm ?? 0, 6);
	});

	it("gives no instant for a leg with no departure time", () => {
		const timeline = journeyTimeline([
			leg(FCO, AUH, null, 6),
			leg(AUH, NRT, null, 9),
		]);

		expect(journeyMomentAt(timeline, 0.2).instant).toBeNull();
	});

	it("goes from one leg to the next with no stop when the stop is unknown", () => {
		const timeline = journeyTimeline([
			leg(FCO, AUH, T0, 6),
			leg(AUH, NRT, null, 9),
		]);

		expect(journeyMomentAt(timeline, 6 / 15)).toMatchObject({
			leg: 1,
			stop: false,
		});
	});
});

describe("finalArrival and landingMarks", () => {
	it("gives the last arrival", () => {
		expect(finalArrival(tokyo)).toBe(T0 + 18 * HOUR);
	});

	it("gives no last arrival when the last leg has no departure time", () => {
		expect(
			finalArrival(
				journeyTimeline([leg(FCO, AUH, T0, 6), leg(AUH, NRT, null, 9)]),
			),
		).toBeNull();
	});

	it("gives one mark for each landing before the final destination", () => {
		expect(landingMarks(tokyo)).toEqual([6 / 18]);
		expect(landingMarks(journeyTimeline([leg(FCO, NRT, T0, 12)]))).toEqual([]);
	});
});

describe("journeyMap", () => {
	it("gives each airport one time", () => {
		const { pins, transfers } = journeyMap(tokyo);

		expect(pins.map((pin) => pin.code)).toEqual(["FCO", "AUH", "NRT"]);
		expect(transfers).toEqual([]);
	});

	it("gives a transfer between two airports of one city", () => {
		const timeline = journeyTimeline([
			leg(FCO, LHR, null, 2.5),
			leg(LGW, NRT, null, 14),
		]);
		const { pins, transfers } = journeyMap(timeline);

		expect(pins.map((pin) => pin.code)).toEqual(["FCO", "LHR", "LGW", "NRT"]);
		expect(transfers).toHaveLength(1);
		expect(transfers[0]?.[0][0]).toBeCloseTo(LHR.lon, 4);
		expect(transfers[0]?.[1][0]).toBeCloseTo(LGW.lon, 4);
	});
});

describe("journeyLegs", () => {
	const flight = (
		origin: Airport | null,
		destination: Airport | null,
	): FlightView => ({
		id: "f",
		journeyId: "j",
		airlineCode: "EY",
		flightNumber: "88",
		airlineName: null,
		origin: origin?.iata ?? "XXX",
		destination: destination?.iata ?? "XXX",
		departureDate: "2024-05-12",
		departureTime: "10:45",
		arrivalDate: "2024-05-12",
		arrivalTime: "18:30",
		seat: null,
		cabinClass: null,
		passengerName: null,
		bookingReference: null,
		accentColor: null,
		originAirport: origin,
		destinationAirport: destination,
	});

	it("gives the timing of each leg from its times", () => {
		const legs = journeyLegs([flight(FCO, AUH)]);

		expect(legs?.[0]?.timing).toMatchObject({
			durationMs: 7.75 * HOUR,
			estimated: false,
		});
	});

	it("gives null when an airport is not in the dataset", () => {
		expect(journeyLegs([flight(FCO, AUH), flight(AUH, null)])).toBeNull();
	});

	it("gives null for no flights", () => {
		expect(journeyLegs([])).toBeNull();
	});
});
