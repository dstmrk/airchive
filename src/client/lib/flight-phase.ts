import type { Messages } from "../i18n/messages.ts";
import type { FlightPhase } from "./flight-profile.ts";
import type { JourneyMoment, Timeline } from "./journey-replay.ts";

/**
 * The phase of "relive your flight" for the label under the map, and the time
 * to the next phase. Paragraph 5.6 of `docs/architecture.md` gives the
 * decisions.
 */

export type PhaseId = FlightPhase["id"] | "layover";

/** The next event: a phase of the flight, the gate of the arrival or the next departure. */
export type NextId =
	| "takeOff"
	| "climb"
	| "cruise"
	| "descent"
	| "landing"
	| "arrival"
	| "departure";

export type JourneyPhase = {
	phase: PhaseId;
	/** Null at the final gate: nothing comes next. */
	next: NextId | null;
	/** The time to `next`, in real time. */
	inMs: number;
};

/** The key of the label of each phase. The two waits at a gate have one label. */
export const PHASE_TEXT: Record<PhaseId, keyof Messages> = {
	gateOut: "phaseGate",
	takeOff: "phaseTakeOff",
	climb: "phaseClimb",
	cruise: "phaseCruise",
	descent: "phaseDescent",
	landing: "phaseLanding",
	gateIn: "phaseGate",
	layover: "phaseLayover",
};

/** The key of the text of each next event. The text holds `{time}`. */
export const NEXT_TEXT: Record<NextId, keyof Messages> = {
	takeOff: "nextTakeOff",
	climb: "nextClimb",
	cruise: "nextCruise",
	descent: "nextDescent",
	landing: "nextLanding",
	arrival: "nextArrival",
	departure: "nextDeparture",
};

const NEXT_OF: Record<FlightPhase["id"], NextId | null> = {
	gateOut: null,
	takeOff: "takeOff",
	climb: "climb",
	cruise: "cruise",
	descent: "descent",
	landing: "landing",
	gateIn: "arrival",
};

/**
 * The phase at `moment`. A phase with no length is skipped: at its start, the
 * next phase is current. After the last phase of a leg, the next event is the
 * next departure, or nothing at the final gate.
 */
export function journeyPhase(
	timeline: Timeline,
	moment: JourneyMoment,
): JourneyPhase {
	const flights = timeline.parts.filter((part) => part.kind === "flight");
	const nextFlight = flights.find((part) => part.leg === moment.leg + 1);
	const departure = (now: number): JourneyPhase =>
		nextFlight
			? {
					phase: "layover",
					next: "departure",
					inMs: nextFlight.startMs - now,
				}
			: { phase: "gateIn", next: null, inMs: 0 };

	if (moment.stop) {
		return departure(moment.elapsedMs);
	}
	const flight = flights.find((part) => part.leg === moment.leg);
	const phases = timeline.profiles[moment.leg]?.phases ?? [];
	const local = moment.elapsedMs - (flight?.startMs ?? 0);
	const index = phases.findLastIndex((phase) => phase.startMs <= local);
	const current = phases[Math.max(0, index)];
	const coming = phases.slice(index + 1).find((phase) => phase.startMs > local);
	const next = coming ? NEXT_OF[coming.id] : null;
	if (coming && next) {
		return {
			phase: current?.id ?? "gateOut",
			next,
			inMs: coming.startMs - local,
		};
	}
	return { ...departure(moment.elapsedMs), phase: current?.id ?? "gateIn" };
}
