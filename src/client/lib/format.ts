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

/**
 * The time to the next phase of the replay, for example "21 minutes" or
 * "1 ora e 20 minuti". `Intl` gives the singular and the plural of each
 * locale. The value is rounded up: seconds in the last minute, minutes below
 * one hour, then hours and minutes.
 */
export function formatCountdown(ms: number, locale: string): string {
	const unit = (value: number, name: "second" | "minute" | "hour") =>
		new Intl.NumberFormat(locale, {
			style: "unit",
			unit: name,
			unitDisplay: "long",
		}).format(value);
	const seconds = Math.max(0, Math.ceil(ms / 1000));
	if (seconds < 60) {
		return unit(seconds, "second");
	}
	const minutes = Math.ceil(ms / 60_000);
	if (minutes < 60) {
		return unit(minutes, "minute");
	}
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	const parts = [unit(hours, "hour")];
	if (rest > 0) {
		parts.push(unit(rest, "minute"));
	}
	return new Intl.ListFormat(locale, { type: "unit", style: "long" }).format(
		parts,
	);
}

/** A text of the catalogue with each `{name}` replaced by its value. */
export function fillText(
	template: string,
	values: Readonly<Record<string, string>>,
): string {
	return template.replace(
		/\{(\w+)\}/g,
		(whole, name: string) => values[name] ?? whole,
	);
}
