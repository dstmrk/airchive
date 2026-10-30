import type { Airport } from "../../shared/airport.ts";
import type { FlightView } from "../../shared/flight.ts";
import { legInstants } from "../../shared/zoned-time.ts";
import { distanceKm } from "./great-circle.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** The local time "HH:MM" of an instant in a time zone. */
export function clockAt(instant: number, zone: string): string {
	return new Intl.DateTimeFormat("en-GB", {
		timeZone: zone,
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).format(instant);
}

/** A duration as "H:MM", with the minutes that are complete. */
export function durationText(ms: number): string {
	const minutes = Math.floor(ms / MINUTE);
	return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;
}

/**
 * An estimate of the time from the gate to the gate: a mean speed of
 * 800 km/h, plus 30 minutes for the taxi, the take-off and the landing.
 */
export function estimatedDurationMs(km: number): number {
	const ms = (km / 800) * HOUR + 30 * MINUTE;
	return Math.round(ms / (5 * MINUTE)) * 5 * MINUTE;
}

export type FlightTiming = {
	durationMs: number;
	/** The instant of the departure, or null when the flight has no departure time. */
	departure: number | null;
	estimated: boolean;
};

type TimingInput = Pick<
	FlightView,
	"departureDate" | "departureTime" | "arrivalDate" | "arrivalTime"
> & { originAirport: Airport; destinationAirport: Airport };

/**
 * The duration of the flight from the times of the pass and the time zone of
 * each airport (`legInstants`), or an estimate from the distance.
 */
export function flightTiming(flight: TimingInput): FlightTiming {
	const { originAirport: from, destinationAirport: to } = flight;
	const { departure, arrival } = legInstants(flight, from.tz, to.tz);
	if (departure !== null && arrival !== null) {
		return { durationMs: arrival - departure, departure, estimated: false };
	}
	const km = distanceKm([from.lon, from.lat], [to.lon, to.lat]);
	return { durationMs: estimatedDurationMs(km), departure, estimated: true };
}
