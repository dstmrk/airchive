import type { Airport } from "../../shared/airport.ts";
import type { FlightView } from "../../shared/flight.ts";
import { distanceKm } from "./great-circle.ts";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The offset of a time zone at an instant, in milliseconds east of UTC. */
function offsetMs(instant: number, zone: string): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: zone,
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		hourCycle: "h23",
	}).formatToParts(instant);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((p) => p.type === type)?.value);
	const wall = Date.UTC(
		part("year"),
		part("month") - 1,
		part("day"),
		part("hour"),
		part("minute"),
	);
	return wall - Math.floor(instant / MINUTE) * MINUTE;
}

/** The instant of a wall-clock date and time ("YYYY-MM-DD", "HH:MM") in a time zone. */
export function zonedInstant(date: string, time: string, zone: string): number {
	const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
	const [hour = 0, minute = 0] = time.split(":").map(Number);
	const wall = Date.UTC(year, month - 1, day, hour, minute);
	// A second pass corrects the offset when the first guess is on the other side of a change of the clocks.
	const guess = wall - offsetMs(wall, zone);
	return wall - offsetMs(guess, zone);
}

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
 * each airport, or an estimate from the distance. An arrival with no date is
 * on the day of the departure, or on the next day when its time is earlier.
 */
export function flightTiming(flight: TimingInput): FlightTiming {
	const { originAirport: from, destinationAirport: to } = flight;
	const departure = flight.departureTime
		? zonedInstant(flight.departureDate, flight.departureTime, from.tz)
		: null;
	if (departure !== null && flight.arrivalTime) {
		let arrival = zonedInstant(
			flight.arrivalDate ?? flight.departureDate,
			flight.arrivalTime,
			to.tz,
		);
		if (!flight.arrivalDate && arrival <= departure) {
			arrival += DAY;
		}
		const durationMs = arrival - departure;
		if (durationMs > 0 && durationMs < DAY) {
			return { durationMs, departure, estimated: false };
		}
	}
	const km = distanceKm([from.lon, from.lat], [to.lon, to.lat]);
	return { durationMs: estimatedDurationMs(km), departure, estimated: true };
}
