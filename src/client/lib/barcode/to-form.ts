import { dateFromJulian, parseBcbp } from "../bcbp.ts";
import type { ImportedValues } from "../pkpass/to-form.ts";

/**
 * The values of the form from the text of a BCBP barcode. The barcode gives
 * the day of the year and no year: the date is the most recent one on or
 * before today. It gives no time. The person completes the form.
 */
export function bcbpToForm(text: string, today: string): ImportedValues | null {
	const leg = parseBcbp(text);
	if (!leg) {
		return null;
	}
	const values: ImportedValues = {
		designator: `${leg.airlineCode} ${leg.flightNumber}`,
		origin: leg.origin,
		destination: leg.destination,
		departureDate: dateFromJulian(leg.dayOfYear, today) ?? undefined,
		seat: leg.seat ?? undefined,
		cabinClass: leg.cabinClass ?? undefined,
		passengerName: leg.passengerName || undefined,
		bookingReference: leg.bookingReference || undefined,
	};
	return Object.fromEntries(
		Object.entries(values).filter(([, value]) => value !== undefined),
	) as ImportedValues;
}
