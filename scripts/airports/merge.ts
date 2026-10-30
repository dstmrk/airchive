/**
 * The merge of the two sources of airports. Paragraph 3.4 of
 * `docs/architecture.md` gives the decision:
 *
 * - mwgg/Airports (MIT) is the base. It holds the IANA time zone of each
 *   airport, and it keeps the closed airports (for example TXL).
 * - OurAirports (public domain) adds each IATA code that mwgg does not have.
 *   The time zone of those airports comes from the coordinates.
 * - A code of the previous file never goes away. A saved flight holds only the
 *   codes, thus a removed code breaks that flight.
 *
 * This file is pure. `build.ts` reads the sources and writes the result.
 */

import type { Airport } from "../../src/server/airports/rows.ts";

export type { Airport };

/** One value of `airports.json` of mwgg/Airports. */
export type MwggAirport = {
	iata?: string;
	name: string;
	city: string;
	country: string;
	lat: number;
	lon: number;
	tz: string;
};

/** One row of `airports.csv` of OurAirports, with the columns that the merge reads. */
export type OurAirportsRow = {
	iata_code: string;
	name: string;
	municipality: string;
	iso_country: string;
	latitude_deg: string;
	longitude_deg: string;
	type: string;
};

type MergeInput = {
	previous: readonly Airport[];
	mwgg: readonly MwggAirport[];
	ourAirports: readonly OurAirportsRow[];
	tzOf: (lat: number, lon: number) => string;
};

const IATA = /^[A-Z]{3}$/;

function round4(value: number): number {
	return Math.round(value * 10_000) / 10_000;
}

function validCoordinates(lat: number, lon: number): boolean {
	return (
		Number.isFinite(lat) &&
		Number.isFinite(lon) &&
		Math.abs(lat) <= 90 &&
		Math.abs(lon) <= 180
	);
}

function fromMwgg(entry: MwggAirport): Airport | null {
	const iata = entry.iata ?? "";
	if (
		!IATA.test(iata) ||
		!entry.tz ||
		!validCoordinates(entry.lat, entry.lon)
	) {
		return null;
	}
	return {
		iata,
		name: entry.name,
		city: entry.city || entry.name,
		country: entry.country,
		lat: round4(entry.lat),
		lon: round4(entry.lon),
		tz: entry.tz,
	};
}

function fromOurAirports(
	row: OurAirportsRow,
	tzOf: MergeInput["tzOf"],
): Airport | null {
	const lat = row.latitude_deg === "" ? Number.NaN : Number(row.latitude_deg);
	const lon = row.longitude_deg === "" ? Number.NaN : Number(row.longitude_deg);
	if (
		!IATA.test(row.iata_code) ||
		row.type === "closed" ||
		!validCoordinates(lat, lon)
	) {
		return null;
	}
	return {
		iata: row.iata_code,
		name: row.name,
		city: row.municipality || row.name,
		country: row.iso_country,
		lat: round4(lat),
		lon: round4(lon),
		tz: tzOf(lat, lon),
	};
}

export function mergeAirports({
	previous,
	mwgg,
	ourAirports,
	tzOf,
}: MergeInput): Airport[] {
	const byCode = new Map<string, Airport>();

	for (const entry of mwgg) {
		const airport = fromMwgg(entry);
		if (airport && !byCode.has(airport.iata)) {
			byCode.set(airport.iata, airport);
		}
	}
	for (const row of ourAirports) {
		const airport = fromOurAirports(row, tzOf);
		if (airport && !byCode.has(airport.iata)) {
			byCode.set(airport.iata, airport);
		}
	}
	for (const airport of previous) {
		if (!byCode.has(airport.iata)) {
			byCode.set(airport.iata, airport);
		}
	}

	return [...byCode.values()].sort((a, b) => a.iata.localeCompare(b.iata));
}
