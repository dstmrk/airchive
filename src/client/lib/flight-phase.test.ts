import { describe, expect, it } from "vitest";
import type { Airport } from "../../shared/airport.ts";
import { journeyPhase } from "./flight-phase.ts";
import {
	type JourneyLeg,
	journeyMomentAt,
	journeyTimeline,
	type Timeline,
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
const LHR = airport("LHR", -0.4543, 51.47);
const NRT = airport("NRT", 140.3864, 35.7647);

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

/** The phase at `ms` from the start of the journey. */
const at = (timeline: Timeline, ms: number) =>
	journeyPhase(timeline, journeyMomentAt(timeline, ms / timeline.totalMs));

// Rome to London (2 h 30 min), a stop of 2 h, London to Rome (2 h 30 min).
const london = journeyTimeline([
	leg(FCO, LHR, T0, 2.5),
	leg(LHR, FCO, T0 + 4.5 * HOUR, 2.5),
]);
const [first] = london.profiles;
const start = (id: string) =>
	first?.phases.find((phase) => phase.id === id)?.startMs ?? 0;

describe("journeyPhase", () => {
	it("waits at the gate and counts down to the take-off", () => {
		expect(at(london, 60_000)).toEqual({
			phase: "gateOut",
			next: "takeOff",
			inMs: start("takeOff") - 60_000,
		});
	});

	it("gives each phase of the flight and the time to the next one", () => {
		const middle = (a: string, b: string) => (start(a) + start(b)) / 2;

		expect(at(london, middle("takeOff", "climb"))).toMatchObject({
			phase: "takeOff",
			next: "climb",
		});
		expect(at(london, middle("climb", "cruise"))).toMatchObject({
			phase: "climb",
			next: "cruise",
		});
		expect(at(london, middle("cruise", "descent"))).toMatchObject({
			phase: "cruise",
			next: "descent",
			inMs: start("descent") - middle("cruise", "descent"),
		});
		expect(at(london, middle("descent", "landing"))).toMatchObject({
			phase: "descent",
			next: "landing",
		});
		expect(at(london, middle("landing", "gateIn"))).toMatchObject({
			phase: "landing",
			next: "arrival",
		});
	});

	it("counts down to the next departure at the gate before a stop", () => {
		const ms = start("gateIn") + 60_000;

		expect(at(london, ms)).toEqual({
			phase: "gateIn",
			next: "departure",
			inMs: 4.5 * HOUR - ms,
		});
	});

	it("counts down to the next departure during a stop", () => {
		expect(at(london, 3.5 * HOUR)).toEqual({
			phase: "layover",
			next: "departure",
			inMs: HOUR,
		});
	});

	it("waits at the gate of the next leg after the stop", () => {
		expect(at(london, 4.5 * HOUR + 60_000)).toMatchObject({
			phase: "gateOut",
			next: "takeOff",
		});
	});

	it("gives no next phase at the final gate", () => {
		expect(at(london, london.totalMs)).toEqual({
			phase: "gateIn",
			next: null,
			inMs: 0,
		});
	});

	it("starts with the take-off run when a flight has no wait", () => {
		const tokyo = journeyTimeline([leg(FCO, NRT, T0, 12)]);

		expect(at(tokyo, 0)).toMatchObject({ phase: "takeOff", next: "climb" });
	});
});
