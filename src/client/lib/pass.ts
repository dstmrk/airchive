import type { CabinClass, FlightView } from "../../shared/flight.ts";
import { usableAccent } from "./color.ts";

/** The paper of the pass: `--color-paper` of `app.css`. The contrast of the accent is measured on it. */
export const PAPER = "#fbf7ee";

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDay(isoDate: string): number {
	return Date.parse(`${isoDate}T00:00:00Z`);
}

/**
 * The date as a boarding pass prints it: "12 MAY 2024", and "12 MAY" for the
 * stub. The month comes from the locale. The format uses UTC on purpose: the
 * date is the local day of the boarding pass, and a conversion to the time
 * zone of the browser can move it.
 */
export function passDate(
	isoDate: string,
	locale: string,
): { full: string; short: string } {
	const parts = new Intl.DateTimeFormat(locale, {
		day: "2-digit",
		month: "short",
		year: "numeric",
		timeZone: "UTC",
	}).formatToParts(new Date(utcDay(isoDate)));
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? "";
	// Some locales write "Jan." with a dot; a printed pass has none.
	const month = part("month").replace(/\.$/, "").toLocaleUpperCase(locale);
	const short = `${part("day")} ${month}`;
	return { full: `${short} ${part("year")}`, short };
}

/** The days between the departure and the arrival: 1 for an arrival on the next day. */
export function arrivalDayOffset(
	departureDate: string,
	arrivalDate: string | null,
): number {
	if (arrivalDate === null) {
		return 0;
	}
	return Math.round((utcDay(arrivalDate) - utcDay(departureDate)) / DAY_MS);
}

export type PassView = {
	designator: string;
	airlineName: string | null;
	origin: { code: string; city: string };
	destination: { code: string; city: string };
	date: string;
	shortDate: string;
	departureTime: string | null;
	arrivalTime: string | null;
	arrivalOffset: string | null;
	seat: string | null;
	cabinClass: CabinClass | null;
	passengerName: string | null;
	bookingReference: string | null;
	/** The colour of the airline, or null for the default accent of the theme. */
	accent: string | null;
};

/**
 * The texts of the paper boarding pass for one flight. The component only
 * places them; this function decides each value. A value that the flight
 * does not have is null.
 */
export function passView(flight: FlightView, locale: string): PassView {
	const date = passDate(flight.departureDate, locale);
	const offset = arrivalDayOffset(flight.departureDate, flight.arrivalDate);
	return {
		designator: `${flight.airlineCode} ${flight.flightNumber}`,
		airlineName: flight.airlineName,
		origin: {
			code: flight.origin,
			city: flight.originAirport?.city ?? flight.origin,
		},
		destination: {
			code: flight.destination,
			city: flight.destinationAirport?.city ?? flight.destination,
		},
		date: date.full,
		shortDate: date.short,
		departureTime: flight.departureTime,
		arrivalTime: flight.arrivalTime,
		arrivalOffset: offset > 0 ? `+${offset}` : null,
		seat: flight.seat,
		cabinClass: flight.cabinClass,
		passengerName: flight.passengerName?.toLocaleUpperCase(locale) ?? null,
		bookingReference: flight.bookingReference,
		accent: usableAccent(flight.accentColor, PAPER),
	};
}
