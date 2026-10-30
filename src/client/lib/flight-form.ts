import {
	type FlightInput,
	type FlightIssue,
	type FlightView,
	flightInputSchema,
	splitFlightDesignator,
} from "../../shared/flight.ts";

/**
 * The values of the form, all as text. The person writes the flight as one
 * designator ("AZ 784"); the API receives the code and the number.
 */
export type FlightFormValues = {
	designator: string;
	airlineName: string;
	origin: string;
	destination: string;
	departureDate: string;
	departureTime: string;
	arrivalDate: string;
	arrivalTime: string;
	seat: string;
	cabinClass: string;
	passengerName: string;
	bookingReference: string;
};

export type FormField = keyof FlightFormValues;

/**
 * The code of an issue for the user interface. The catalogue of text gives
 * one message for each code.
 */
export type IssueCode =
	| "invalid"
	| "same_airport"
	| "arrival_before_departure"
	| "unknown_airport";

export type FieldIssues = Partial<Record<FormField, IssueCode>>;

const SPECIFIC: ReadonlySet<string> = new Set([
	"same_airport",
	"arrival_before_departure",
	"unknown_airport",
]);

export function emptyForm(): FlightFormValues {
	return {
		designator: "",
		airlineName: "",
		origin: "",
		destination: "",
		departureDate: "",
		departureTime: "",
		arrivalDate: "",
		arrivalTime: "",
		seat: "",
		cabinClass: "",
		passengerName: "",
		bookingReference: "",
	};
}

export function formFromFlight(flight: FlightView): FlightFormValues {
	return {
		designator: `${flight.airlineCode} ${flight.flightNumber}`,
		airlineName: flight.airlineName ?? "",
		origin: flight.origin,
		destination: flight.destination,
		departureDate: flight.departureDate,
		departureTime: flight.departureTime ?? "",
		arrivalDate: flight.arrivalDate ?? "",
		arrivalTime: flight.arrivalTime ?? "",
		seat: flight.seat ?? "",
		cabinClass: flight.cabinClass ?? "",
		passengerName: flight.passengerName ?? "",
		bookingReference: flight.bookingReference ?? "",
	};
}

/**
 * The issues of the schema or of the API, one for each field of the form.
 * The code of the airline and the number are one field: the designator.
 */
export function issuesByField(issues: readonly FlightIssue[]): FieldIssues {
	const result: FieldIssues = {};
	for (const issue of issues) {
		const key = issue.path[0];
		if (typeof key !== "string") {
			continue;
		}
		const field = (
			key === "airlineCode" || key === "flightNumber" ? "designator" : key
		) as FormField;
		result[field] ??= SPECIFIC.has(issue.message)
			? (issue.message as IssueCode)
			: "invalid";
	}
	return result;
}

/**
 * The flight for the API, or the issues by field. The client applies the
 * schema of the API, thus most errors show before the request.
 */
export function toPayload(
	form: FlightFormValues,
): { flight: FlightInput } | { issues: FieldIssues } {
	const designator = splitFlightDesignator(form.designator);
	const { designator: _text, ...fields } = form;
	// With no valid designator, a placeholder lets the schema examine the other fields.
	const parsed = flightInputSchema.safeParse({
		...fields,
		...(designator ?? { airlineCode: "XX", flightNumber: "1" }),
	});

	const issues: FieldIssues = parsed.success
		? {}
		: issuesByField(
				parsed.error.issues.map((issue) => ({
					path: issue.path.map(String),
					message: issue.message,
				})),
			);
	if (designator === null) {
		issues.designator = "invalid";
	}
	if (Object.keys(issues).length > 0 || !parsed.success) {
		return { issues };
	}
	return { flight: parsed.data };
}
