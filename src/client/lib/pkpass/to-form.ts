import { SEAT, splitFlightDesignator } from "../../../shared/flight.ts";
import { dateFromJulian, parseBcbp } from "../bcbp.ts";
import { parsePassColor } from "../color.ts";
import type { FlightFormValues } from "../flight-form.ts";

/**
 * The values of the form from the `pass.json` of a boarding pass. The person
 * examines them in the form before the save, and the schema of the form
 * examines each one: this function only finds them.
 *
 * Three sources, the most reliable first (paragraph 3.1 of
 * `docs/architecture.md`):
 *
 * 1. the semantic tags (`semantics`), since iOS 12;
 * 2. the IATA BCBP barcode, which each boarding pass holds;
 * 3. the free fields of the pass, by their key or their label.
 *
 * The object comes from a file that is not trusted. Each value must have the
 * expected type and a length limit, or the function ignores it.
 */

export type ImportedValues = Partial<FlightFormValues>;

type Options = {
	/** The IANA time zone of an airport, or undefined for an unknown code. */
	tzOf: (code: string) => string | undefined;
	/** The date of today, "YYYY-MM-DD": the reference for the year of a barcode. */
	today: string;
};

type PassField = { key: string; label: string; value: string };

function record(value: unknown): Record<string, unknown> | null {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: null;
}

function text(value: unknown, max: number): string | undefined {
	if (typeof value !== "string") {
		return undefined;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 && trimmed.length <= max ? trimmed : undefined;
}

function airportCode(value: unknown): string | undefined {
	const code = text(value, 3)?.toUpperCase();
	return code && /^[A-Z]{3}$/.test(code) ? code : undefined;
}

function designator(value: string | undefined): string | undefined {
	const split = value ? splitFlightDesignator(value) : null;
	return split ? `${split.airlineCode} ${split.flightNumber}` : undefined;
}

/**
 * The local date and time of an ISO instant at an airport. With no time zone,
 * the date and the time as the text writes them: the offset of a pass is
 * normally the offset of the airport.
 */
function localDateTime(
	value: unknown,
	zone: string | undefined,
): { date: string; time: string } | undefined {
	const iso = text(value, 40);
	const written = iso
		? /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/.exec(
				iso,
			)
		: null;
	if (!iso || !written?.[1] || !written[2]) {
		return undefined;
	}
	const instant = new Date(iso);
	if (Number.isNaN(instant.getTime())) {
		return undefined;
	}
	if (!zone) {
		return { date: written[1], time: written[2] };
	}
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: zone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(instant);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? "";
	return {
		date: `${part("year")}-${part("month")}-${part("day")}`,
		time: `${part("hour")}:${part("minute")}`,
	};
}

function passFields(boardingPass: Record<string, unknown>): {
	all: PassField[];
	primary: PassField[];
} {
	const read = (group: unknown): PassField[] =>
		(Array.isArray(group) ? group : []).flatMap((item) => {
			const field = record(item);
			const value =
				typeof field?.value === "number"
					? String(field.value)
					: text(field?.value, 100);
			return field && value
				? [
						{
							key: text(field.key, 100) ?? "",
							label: text(field.label, 100) ?? "",
							value,
						},
					]
				: [];
		});
	const groups = [
		"headerFields",
		"primaryFields",
		"secondaryFields",
		"auxiliaryFields",
		"backFields",
	];
	return {
		all: groups.flatMap((group) => read(boardingPass[group])),
		primary: read(boardingPass.primaryFields),
	};
}

function fieldValue(fields: PassField[], pattern: RegExp): string | undefined {
	return fields.find((f) => pattern.test(f.key) || pattern.test(f.label))
		?.value;
}

function seatOf(value: unknown): string | undefined {
	const seat = text(value, 4)?.toUpperCase();
	return seat && SEAT.test(seat) ? seat : undefined;
}

export function passToForm(
	pass: Record<string, unknown>,
	{ tzOf, today }: Options,
): { values: ImportedValues } | { error: "not_boarding_pass" } {
	const boardingPass = record(pass.boardingPass);
	if (
		!boardingPass ||
		(boardingPass.transitType ?? "PKTransitTypeAir") !== "PKTransitTypeAir"
	) {
		return { error: "not_boarding_pass" };
	}

	const semantics = record(pass.semantics) ?? {};
	const barcodes = [
		...(Array.isArray(pass.barcodes) ? pass.barcodes : []),
		pass.barcode,
	];
	const bcbp =
		barcodes
			.map((code) => text(record(code)?.message, 1000))
			.map((message) => (message ? parseBcbp(message) : null))
			.find((leg) => leg !== null) ?? null;
	const { all, primary } = passFields(boardingPass);

	const origin =
		airportCode(semantics.departureAirportCode) ??
		bcbp?.origin ??
		airportCode(primary[0]?.value);
	const destination =
		airportCode(semantics.destinationAirportCode) ??
		bcbp?.destination ??
		airportCode(primary[1]?.value);

	const semanticNumber =
		typeof semantics.flightNumber === "number"
			? String(semantics.flightNumber)
			: text(semantics.flightNumber, 5);
	const flight =
		designator(
			text(semantics.airlineCode, 3) && semanticNumber
				? `${text(semantics.airlineCode, 3)} ${semanticNumber}`
				: undefined,
		) ??
		designator(text(semantics.flightCode, 10)) ??
		(bcbp ? `${bcbp.airlineCode} ${bcbp.flightNumber}` : undefined) ??
		designator(fieldValue(all, /flight/i));

	const departure = localDateTime(
		semantics.originalDepartureDate ?? semantics.currentDepartureDate,
		origin ? tzOf(origin) : undefined,
	);
	const arrival = localDateTime(
		semantics.originalArrivalDate ?? semantics.currentArrivalDate,
		destination ? tzOf(destination) : undefined,
	);
	// relevantDate is when the pass becomes relevant (often the boarding), thus only its day is used.
	const relevantDay = localDateTime(
		pass.relevantDate,
		origin ? tzOf(origin) : undefined,
	)?.date;
	const barcodeDay = bcbp
		? dateFromJulian(bcbp.dayOfYear, relevantDay ?? today)
		: null;
	const departureDate = departure?.date ?? barcodeDay ?? relevantDay;

	const name = record(semantics.passengerName);
	const semanticName = [text(name?.givenName, 50), text(name?.familyName, 50)]
		.filter(Boolean)
		.join(" ");
	const seats = Array.isArray(semantics.seats) ? semantics.seats : [];

	const values: ImportedValues = {
		designator: flight,
		airlineName: text(pass.organizationName, 80),
		origin,
		destination,
		departureDate,
		departureTime: departure?.time,
		arrivalDate: arrival?.date,
		arrivalTime: arrival?.time,
		seat:
			seatOf(record(seats[0])?.seatIdentifier) ??
			bcbp?.seat ??
			seatOf(fieldValue(all, /seat/i)),
		cabinClass: bcbp?.cabinClass ?? undefined,
		passengerName:
			text(semanticName, 100) ??
			bcbp?.passengerName ??
			text(fieldValue(all, /passenger|name/i), 100),
		bookingReference:
			text(semantics.confirmationNumber, 8) ??
			text(bcbp?.bookingReference, 8) ??
			text(fieldValue(all, /pnr|booking|confirmation|record|locator/i), 8),
		accentColor: parsePassColor(pass.backgroundColor) ?? undefined,
	};
	return {
		values: Object.fromEntries(
			Object.entries(values).filter(([, value]) => value !== undefined),
		) as ImportedValues,
	};
}
