/**
 * The date of a flight, for example "May 12, 2024". The date is the local day
 * of the boarding pass. The format uses UTC on purpose: a conversion to the
 * time zone of the browser can move the day.
 */
export function formatDate(isoDate: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeZone: "UTC",
	}).format(new Date(`${isoDate}T00:00:00Z`));
}

export type Unit = "kilometer" | "kilometer-per-hour" | "meter";

/** A value of the in-flight panel, for example "10,668 km", with no decimals. */
export function formatUnit(value: number, unit: Unit, locale: string): string {
	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit,
		maximumFractionDigits: 0,
	}).format(value);
}
