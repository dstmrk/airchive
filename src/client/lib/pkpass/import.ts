import type { Airport } from "../../../shared/airport.ts";
import { bcbpToForm } from "../barcode/to-form.ts";
import { PkpassError, type PkpassErrorCode, readPassJson } from "./extract.ts";
import { type ImportedValues, passToForm } from "./to-form.ts";

export type ImportError =
	| PkpassErrorCode
	| "not_boarding_pass"
	| "no_flight_data"
	| "pdf_not_supported"
	| "no_barcode";

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

/** A photo of a telephone can be large. The `.pkpass` limit of `extract.ts` is smaller. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

async function withAirports(
	values: ImportedValues,
	findAirport: Options["findAirport"],
) {
	const [origin, destination] = await Promise.all([
		values.origin ? findAirport(values.origin) : null,
		values.destination ? findAirport(values.destination) : null,
	]);
	return { origin, destination };
}

const startsWith = (bytes: Uint8Array, prefix: number[]) =>
	prefix.every((byte, i) => bytes[i] === byte);

/**
 * A file that the person selects: the content decides, not the name. A zip
 * archive is a `.pkpass` file. A PDF file is not read: a screenshot of its
 * barcode is. Another file goes to `readBarcode`, which throws when the file
 * is not an image. Paragraph 3.1 of `docs/architecture.md` gives the rules.
 */
export async function importFile(
	bytes: Uint8Array,
	{
		readBarcode,
		...options
	}: Options & { readBarcode: (bytes: Uint8Array) => Promise<string | null> },
): Promise<ImportResult> {
	if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) {
		return importPass(bytes, options);
	}
	if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) {
		return { error: "pdf_not_supported" };
	}
	if (bytes.length > MAX_IMAGE_BYTES) {
		return { error: "file_too_large" };
	}
	let text: string | null;
	try {
		text = await readBarcode(bytes);
	} catch {
		return { error: "not_a_pass" };
	}
	const values = text ? bcbpToForm(text, options.today) : null;
	if (!values) {
		return { error: "no_barcode" };
	}
	return {
		values,
		airports: await withAirports(values, options.findAirport),
	};
}

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

	const { origin, destination } = await withAirports(first.values, findAirport);
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
