import type { Airport } from "../../../shared/airport.ts";
import { PkpassError, type PkpassErrorCode, readPassJson } from "./extract.ts";
import { type ImportedValues, passToForm } from "./to-form.ts";

export type ImportError =
	| PkpassErrorCode
	| "not_boarding_pass"
	| "no_flight_data";

export type ImportResult =
	| {
			values: ImportedValues;
			airports: { origin: Airport | null; destination: Airport | null };
	  }
	| { error: ImportError };

type Options = {
	findAirport: (code: string) => Promise<Airport | null>;
	today: string;
};

/**
 * A `.pkpass` file to the values of the form, in the browser: the file does
 * not go to the server. The times need the time zone of each airport, thus a
 * first reading finds the codes, the API gives the two airports, and a second
 * reading converts the times. Refer to paragraph 3.1 of `docs/architecture.md`.
 */
export async function importPass(
	bytes: Uint8Array,
	{ findAirport, today }: Options,
): Promise<ImportResult> {
	let pass: Record<string, unknown>;
	try {
		pass = await readPassJson(bytes);
	} catch (error) {
		if (error instanceof PkpassError) {
			return { error: error.code };
		}
		throw error;
	}

	const first = passToForm(pass, { tzOf: () => undefined, today });
	if ("error" in first) {
		return first;
	}
	if (
		!first.values.origin &&
		!first.values.destination &&
		!first.values.designator
	) {
		return { error: "no_flight_data" };
	}

	const [origin, destination] = await Promise.all([
		first.values.origin ? findAirport(first.values.origin) : null,
		first.values.destination ? findAirport(first.values.destination) : null,
	]);
	const zones: Record<string, string> = {};
	for (const airport of [origin, destination]) {
		if (airport) {
			zones[airport.iata] = airport.tz;
		}
	}
	const second = passToForm(pass, { tzOf: (code) => zones[code], today });
	if ("error" in second) {
		return second;
	}
	return { values: second.values, airports: { origin, destination } };
}
