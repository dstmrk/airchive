import * as z from "zod";
import type { Airport } from "./airport.ts";

/**
 * The flight that a person enters or edits. The form and the API read this
 * one schema. Paragraph 3.1 of `docs/architecture.md` gives the fields.
 *
 * The times are local "wall clock" times, as the boarding pass gives them.
 * The time zone of each airport converts them to UTC when necessary.
 */

export const CABIN_CLASSES = [
	"economy",
	"premium_economy",
	"business",
	"first",
] as const;

/** The first year that the form accepts. Older dates are an error of input. */
const FIRST_YEAR = 1950;

/** An identifier that `crypto.randomUUID` gives. */
export const UUID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** An empty text, or only spaces, is the same as no value. */
export function optional<T extends z.ZodType>(schema: T) {
	return z.preprocess(
		(value) =>
			value === undefined || (typeof value === "string" && value.trim() === "")
				? null
				: value,
		schema.nullable(),
	);
}

const upper = (pattern: RegExp) =>
	z.string().trim().toUpperCase().regex(pattern);

/** A real calendar day from 1950: "2023-02-29" is not valid. */
const isoDate = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((value) => {
		const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
		const date = new Date(Date.UTC(year, month - 1, day));
		return (
			year >= FIRST_YEAR &&
			date.getUTCFullYear() === year &&
			date.getUTCMonth() === month - 1 &&
			date.getUTCDate() === day
		);
	});

const localTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

/** IATA (two characters, at least one letter) or ICAO (three letters). */
const AIRLINE_CODE = /^(?=[A-Z0-9]*[A-Z])[A-Z0-9]{2}[A-Z]?$/;
const AIRPORT_CODE = /^[A-Z]{3}$/;

/** A row and a letter ("14A"), or "INF": an infant on the lap of an adult has no seat. */
export const SEAT = /^(\d{1,3}[A-Z]|INF)$/;

export const flightInputSchema = z
	.strictObject({
		airlineCode: upper(AIRLINE_CODE),
		flightNumber: upper(/^\d{1,4}[A-Z]?$/)
			.transform((value) => value.replace(/^0+/, ""))
			.pipe(z.string().min(1)),
		airlineName: optional(z.string().trim().max(80)),
		origin: upper(AIRPORT_CODE),
		destination: upper(AIRPORT_CODE),
		departureDate: isoDate,
		departureTime: optional(localTime),
		arrivalDate: optional(isoDate),
		arrivalTime: optional(localTime),
		seat: optional(upper(SEAT)),
		cabinClass: optional(z.enum(CABIN_CLASSES)),
		passengerName: optional(z.string().trim().max(100)),
		bookingReference: optional(upper(/^[A-Z0-9]{5,8}$/)),
		// The journey of the flight. With no value, the flight starts a new journey.
		journeyId: optional(z.string().regex(UUID)),
		// The background colour of the `.pkpass` file of the airline, if any.
		accentColor: optional(
			z
				.string()
				.trim()
				.toLowerCase()
				.regex(/^#[0-9a-f]{6}$/),
		),
	})
	.superRefine((flight, ctx) => {
		if (flight.origin === flight.destination) {
			ctx.addIssue({
				code: "custom",
				path: ["destination"],
				message: "same_airport",
			});
		}
		if (
			flight.arrivalDate !== null &&
			flight.arrivalDate < flight.departureDate
		) {
			ctx.addIssue({
				code: "custom",
				path: ["arrivalDate"],
				message: "arrival_before_departure",
			});
		}
	});

export type FlightInput = z.output<typeof flightInputSchema>;
export type CabinClass = (typeof CABIN_CLASSES)[number];

/**
 * It splits a flight designator such as "AZ 784" or "BAW123" into the code of
 * the airline and the number. It gives null for a text that is not a
 * designator. A code of two digits does not exist, thus "784" gives null.
 */
export function splitFlightDesignator(
	text: string,
): { airlineCode: string; flightNumber: string } | null {
	const match = /^([A-Z0-9]{2}[A-Z]?)\s*(\d{1,4}[A-Z]?)$/.exec(
		text.trim().toUpperCase(),
	);
	const airlineCode = match?.[1];
	const number = match?.[2]?.replace(/^0+/, "");
	if (!airlineCode || !number || !AIRLINE_CODE.test(airlineCode)) {
		return null;
	}
	return { airlineCode, flightNumber: number };
}

/**
 * A flight as the API gives it: the fields of the form, the identifier, the
 * journey and the two airports. The owner and the dates of the row stay on the server.
 */
export type FlightView = Omit<FlightInput, "journeyId"> & {
	id: string;
	journeyId: string;
	originAirport: Airport | null;
	destinationAirport: Airport | null;
};

/** The body of a response 400 of the API of the flights. */
export type FlightIssue = { path: (string | number)[]; message: string };
