import { describe, expect, it } from "vitest";
import { type Airport, fromRows, toRows } from "./rows.ts";

const fco: Airport = {
	iata: "FCO",
	name: "Leonardo Da Vinci (Fiumicino) International Airport",
	city: "Rome",
	country: "IT",
	lat: 41.8045,
	lon: 12.2508,
	tz: "Europe/Rome",
};

describe("the rows of airports.json", () => {
	it("gives back the same airports after toRows and fromRows", () => {
		expect(fromRows(toRows([fco]))).toEqual([fco]);
	});

	it("writes one array for each airport, in a fixed order", () => {
		expect(toRows([fco])).toEqual([
			["FCO", fco.name, "Rome", "IT", 41.8045, 12.2508, "Europe/Rome"],
		]);
	});
});
