import type { CabinClass } from "../../shared/flight.ts";

/**
 * The fields of the first leg of an IATA BCBP barcode (Resolution 792). Each
 * boarding pass holds one: in a `.pkpass` file, the message of the barcode;
 * on paper or in a PDF file, the PDF417, Aztec or QR code. Refer to paragraph
 * 3.1 of `docs/architecture.md`.
 *
 * The barcode gives the day of the year and no year, and no time.
 */
export type BcbpLeg = {
	passengerName: string;
	bookingReference: string;
	origin: string;
	destination: string;
	airlineCode: string;
	flightNumber: string;
	dayOfYear: number;
	cabinClass: CabinClass | null;
	seat: string | null;
};

/** The mandatory items of one leg take 60 characters. */
const MANDATORY_LENGTH = 60;

/** A title at the end of the given name: "ALEX MR" is "ALEX". */
const TITLE = /\s+(MR|MRS|MS|MISS|MSTR|DR|PROF)$/;

/** Only the compartments with one clear meaning. Another letter gives no class. */
const COMPARTMENTS: Record<string, CabinClass> = {
	F: "first",
	A: "first",
	J: "business",
	C: "business",
	W: "premium_economy",
	Y: "economy",
};

function field(text: string, start: number, length: number): string {
	return text.slice(start, start + length).trim();
}

function readName(raw: string): string {
	const [family = "", given = ""] = raw.split("/");
	const first = given.replace(TITLE, "").trim();
	return first ? `${first} ${family.trim()}` : family.trim();
}

/** "014A" is "14A". An infant ("INF") or an empty seat gives null. */
function readSeat(raw: string): string | null {
	const match = /^0*(\d{1,3}[A-Z])$/.exec(raw);
	return match?.[1] ?? null;
}

export function parseBcbp(text: string): BcbpLeg | null {
	if (text.length < MANDATORY_LENGTH || text[0] !== "M") {
		return null;
	}
	const origin = field(text, 30, 3);
	const destination = field(text, 33, 3);
	const airlineCode = field(text, 36, 3);
	const flight = /^0*(\d{1,4}[A-Z]?)$/.exec(field(text, 39, 5));
	const julian = field(text, 44, 3);
	const dayOfYear = Number(julian);
	if (
		!/^[A-Z]{3}$/.test(origin) ||
		!/^[A-Z]{3}$/.test(destination) ||
		!/^[A-Z0-9]{2,3}$/.test(airlineCode) ||
		!flight?.[1] ||
		!/^\d{3}$/.test(julian) ||
		dayOfYear < 1 ||
		dayOfYear > 366
	) {
		return null;
	}
	return {
		passengerName: readName(field(text, 2, 20)),
		bookingReference: field(text, 23, 7),
		origin,
		destination,
		airlineCode,
		flightNumber: flight[1],
		dayOfYear,
		cabinClass: COMPARTMENTS[field(text, 47, 1)] ?? null,
		seat: readSeat(field(text, 48, 4)),
	};
}

function isoOfDay(year: number, dayOfYear: number): string | null {
	const date = new Date(Date.UTC(year, 0, dayOfYear));
	return date.getUTCFullYear() === year
		? date.toISOString().slice(0, 10)
		: null;
}

/**
 * The date of a day of the year: the most recent one on or before the
 * reference date. A person imports a pass after the flight, thus a pass of
 * December imported in January is of the previous year.
 */
export function dateFromJulian(
	dayOfYear: number,
	referenceDate: string,
): string | null {
	const year = Number(referenceDate.slice(0, 4));
	const sameYear = isoOfDay(year, dayOfYear);
	if (sameYear !== null && sameYear <= referenceDate) {
		return sameYear;
	}
	return isoOfDay(year - 1, dayOfYear);
}
