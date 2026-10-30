import catalogue from "../logos/airlines.json" with { type: "json" };

/**
 * The logo of an airline on the day of a flight, from the static catalogue
 * `src/client/logos/airlines.json`. Paragraph 5.4.1 of `docs/architecture.md`
 * gives the rules, and `scripts/logos/add.ts` adds a logo.
 */
export type AirlineLogo = { title: string; viewBox: string; path: string };

type Entry = AirlineLogo & {
	codes: readonly string[];
	since?: string;
	until?: string;
};

/** A code goes to a new airline over time: the date of the flight selects the period. */
export function airlineLogo(
	code: string,
	date: string,
	entries: readonly Entry[] = catalogue,
): AirlineLogo | null {
	const entry = entries.find(
		(e) =>
			e.codes.includes(code) &&
			(e.since === undefined || date >= e.since) &&
			(e.until === undefined || date <= e.until),
	);
	return entry
		? { title: entry.title, viewBox: entry.viewBox, path: entry.path }
		: null;
}
