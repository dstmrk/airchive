import type { Airport } from "./rows.ts";

export type AirportIndex = {
	get: (code: string) => Airport | undefined;
	search: (query: string, limit?: number) => Airport[];
};

/** Lowercase, with no accents: "Zürich" and "zurich" are the same text. */
function normalize(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase()
		.trim();
}

/**
 * The rank of an airport for a text. A lower rank comes first; `null` is no
 * match. The order is: the exact code, a city that starts with the text, a
 * word of the name or of the city that starts with the text, the text in the
 * name.
 */
function rank(
	entry: { code: string; city: string; name: string },
	query: string,
): number | null {
	if (entry.code === query) {
		return 0;
	}
	if (entry.city.startsWith(query)) {
		return 1;
	}
	const words = `${entry.city} ${entry.name}`.split(/[^\p{L}\p{N}]+/u);
	if (words.some((word) => word.startsWith(query))) {
		return 2;
	}
	if (entry.name.includes(query)) {
		return 3;
	}
	return null;
}

/**
 * An index of the airports for the API. The Worker builds it one time, when
 * the isolate starts. Refer to paragraph 3.4 of `docs/architecture.md`.
 */
export function createAirportIndex(airports: readonly Airport[]): AirportIndex {
	const byCode = new Map(airports.map((a) => [a.iata, a]));
	const entries = airports.map((airport) => ({
		airport,
		code: airport.iata.toLowerCase(),
		city: normalize(airport.city),
		name: normalize(airport.name),
	}));

	return {
		get: (code) => byCode.get(code.toUpperCase()),
		search: (rawQuery, limit = 10) => {
			const query = normalize(rawQuery);
			if (query.length < 2) {
				return [];
			}
			return entries
				.map((entry) => ({ entry, rank: rank(entry, query) }))
				.filter(
					(match): match is { entry: (typeof entries)[number]; rank: number } =>
						match.rank !== null,
				)
				.sort(
					(a, b) =>
						a.rank - b.rank ||
						a.entry.airport.iata.localeCompare(b.entry.airport.iata),
				)
				.slice(0, limit)
				.map((match) => match.entry.airport);
		},
	};
}
