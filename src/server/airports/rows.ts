/**
 * The format of `airports.json`: one array for each airport, not one object.
 * The keys are the same for 8,000 airports, thus an object for each one makes
 * the file approximately two times larger.
 */
import type { Airport } from "../../shared/airport.ts";

export type { Airport };

export type AirportRow = [
	iata: string,
	name: string,
	city: string,
	country: string,
	lat: number,
	lon: number,
	tz: string,
];

export function toRows(airports: readonly Airport[]): AirportRow[] {
	return airports.map((a) => [
		a.iata,
		a.name,
		a.city,
		a.country,
		a.lat,
		a.lon,
		a.tz,
	]);
}

export function fromRows(rows: readonly AirportRow[]): Airport[] {
	return rows.map(([iata, name, city, country, lat, lon, tz]) => ({
		iata,
		name,
		city,
		country,
		lat,
		lon,
		tz,
	}));
}
