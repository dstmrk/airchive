import { describe, expect, it } from "vitest";
import type { Airport } from "../../shared/airport.ts";
import type { FlightView } from "../../shared/flight.ts";
import {
	finalArrival,
	hasKnownStop,
	type JourneyLeg,
	journeyLegs,
	journeyMap,
	journeyMomentAt,
	journeyStretches,
	journeyTimeline,
	landingMarks,
	SHORT_GATE_MS,
	SHORT_STOP_MS,
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
	// Rome to London, 1,450 km in 2 h 30 min: the aircraft waits at the gates.
	const london = journeyTimeline([leg(FCO, LHR, T0, 2.5)]);
	const [gates] = london.profiles;
	const outMs = gates?.gateOutMs ?? 0;
	const inMs = gates?.gateInMs ?? 0;
	const airMs = 2.5 * HOUR - outMs - inMs;
	const sum = (stretches: { ms: number }[]) =>
		stretches.reduce((total, s) => total + s.ms, 0);

	it("splits a flight into the wait at the gate, the air and the wait at the gate", () => {
		expect(outMs).toBeGreaterThan(inMs);
		expect(inMs).toBeGreaterThan(0);
		expect(journeyStretches(london, "30s", "real")).toEqual([
			{ kind: "gate", width: outMs / (2.5 * HOUR), ms: SHORT_GATE_MS },
			{
				kind: "air",
				width: airMs / (2.5 * HOUR),
				ms: 30_000 - 2 * SHORT_GATE_MS,
			},
			{ kind: "gate", width: inMs / (2.5 * HOUR), ms: SHORT_GATE_MS },
		]);
	});

	it("skips the waits at the gates in a long replay", () => {
		for (const speed of ["4x", "1x"] as const) {
			const factor = speed === "4x" ? 4 : 1;
			expect(journeyStretches(london, speed, "real").map((s) => s.ms)).toEqual([
				0,
				airMs / factor,
				0,
			]);
		}
	});

	it("gives no wait at the gates to a flight that needs all its time", () => {
		const timeline = journeyTimeline([leg(FCO, NRT, T0, 12)]);

		expect(journeyStretches(timeline, "1min", "real")).toEqual([
			{ kind: "air", width: 1, ms: 60_000 },
		]);
		expect(hasKnownStop(timeline)).toBe(false);
		expect(hasKnownStop(tokyo)).toBe(true);
	});

	it("waits a short time at a stop and at each gate in a short replay", () => {
		const stretches = journeyStretches(tokyo, "30s", "real");
		const air = stretches.filter((s) => s.kind === "air");

		expect(stretches.filter((s) => s.kind === "stop")).toEqual([
			{ kind: "stop", width: 3 / 18, ms: SHORT_STOP_MS },
		]);
		for (const gate of stretches.filter((s) => s.kind === "gate")) {
			expect(gate.ms).toBe(SHORT_GATE_MS);
		}
		expect(sum(stretches)).toBeCloseTo(30_000, 6);
		// The flights share the rest by their time in the air: one speed.
		expect(air[0] && air[0].ms / air[0].width).toBeCloseTo(
			air[1] ? air[1].ms / air[1].width : 0,
			6,
		);
	});

	it("gives a short replay the same parts with the two modes of the stops", () => {
		expect(journeyStretches(tokyo, "1min", "skip")).toEqual(
			journeyStretches(tokyo, "1min", "real"),
		);
	});

	it("keeps the waits of a short replay to a fifth of its length", () => {
		const legs = Array.from({ length: 12 }, (_, i) =>
			leg(i % 2 ? LHR : FCO, i % 2 ? FCO : LHR, T0 + i * 4 * HOUR, 2.5),
		);
		const stretches = journeyStretches(journeyTimeline(legs), "15s", "real");
		const waits = stretches.filter((s) => s.kind !== "air");

		expect(waits).toHaveLength(11 + 24);
		expect(sum(waits)).toBeCloseTo(3000, 6);
		expect(sum(stretches)).toBeCloseTo(15_000, 6);
	});

	it("waits the real time of a stop, divided by the factor, in a long replay", () => {
		const stretches = journeyStretches(tokyo, "4x", "real");

		expect(stretches.find((s) => s.kind === "stop")?.ms).toBe(0.75 * HOUR);
		expect(sum(stretches.filter((s) => s.kind === "gate"))).toBe(0);
	});

	it("skips the stop in a long replay when the person chooses it", () => {
		const stretches = journeyStretches(tokyo, "1x", "skip");

		expect(stretches.find((s) => s.kind === "stop")?.ms).toBe(0);
	});

	it("does not wait at an unknown stop", () => {
		const timeline = journeyTimeline([
			leg(FCO, AUH, T0, 6),
			leg(AUH, NRT, null, 9),
		]);

		expect(
			journeyStretches(timeline, "30s", "real").filter(
				(s) => s.kind === "stop",
			),
		).toEqual([{ kind: "stop", width: 0, ms: 0 }]);
		expect(hasKnownStop(timeline)).toBe(false);
	});

	it("makes the widths of the parts equal to 1", () => {
		for (const timeline of [tokyo, london]) {
			const widths = journeyStretches(timeline, "30s", "real").map(
				(s) => s.width,
			);
			expect(widths.reduce((total, w) => total + w, 0)).toBeCloseTo(1, 9);
		}
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
