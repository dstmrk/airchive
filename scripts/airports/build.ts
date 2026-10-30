/**
 * It writes `src/server/airports/airports.json` from mwgg/Airports and
 * OurAirports. Run it with `npm run airports:build`, then commit the file.
 * `merge.ts` holds the rules; this file only reads and writes.
 *
 * The previous file is an input: the merge keeps each of its codes.
 */
import { readFile, writeFile } from "node:fs/promises";
import tzLookup from "@photostructure/tz-lookup";
import {
	type AirportRow,
	fromRows,
	toRows,
} from "../../src/server/airports/rows.ts";
import { parseCsv } from "./csv.ts";
import {
	type MwggAirport,
	mergeAirports,
	type OurAirportsRow,
} from "./merge.ts";

const MWGG_URL =
	"https://raw.githubusercontent.com/mwgg/Airports/master/airports.json";
const OUR_AIRPORTS_URL =
	"https://davidmegginson.github.io/ourairports-data/airports.csv";
const OUTPUT = new URL(
	"../../src/server/airports/airports.json",
	import.meta.url,
);

async function download(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`${url} gave the status ${response.status}.`);
	}
	return response.text();
}

const previous = fromRows(
	JSON.parse(await readFile(OUTPUT, "utf8").catch(() => "[]")) as AirportRow[],
);
const mwgg = Object.values(
	JSON.parse(await download(MWGG_URL)) as Record<string, MwggAirport>,
);
const ourAirports = parseCsv(
	await download(OUR_AIRPORTS_URL),
) as unknown as OurAirportsRow[];

const airports = mergeAirports({ previous, mwgg, ourAirports, tzOf: tzLookup });

// One airport on each line, thus a change of the data gives a readable diff.
const lines = toRows(airports).map((row) => JSON.stringify(row));
await writeFile(OUTPUT, `[\n${lines.join(",\n")}\n]\n`);

console.info(
	`${airports.length} airports (previous file: ${previous.length}).`,
);
