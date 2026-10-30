import data from "./airports.json";
import { type AirportRow, fromRows } from "./rows.ts";
import { createAirportIndex } from "./search.ts";

/**
 * The airports of `airports.json`, read one time when the isolate starts.
 * `npm run airports:build` writes that file.
 */
export const airports = createAirportIndex(fromRows(data as AirportRow[]));

export type { Airport } from "./rows.ts";
