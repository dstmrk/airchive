import { describe, expect, it } from "vitest";
import type { Airport } from "./rows.ts";
import { createAirportIndex } from "./search.ts";

function airport(iata: string, name: string, city: string): Airport {
	return { iata, name, city, country: "XX", lat: 0, lon: 0, tz: "UTC" };
}

const index = createAirportIndex([
	airport("FCO", "Leonardo Da Vinci (Fiumicino) International Airport", "Rome"),
	airport("CIA", "Ciampino–G. B. Pastine International Airport", "Rome"),
	airport("ROM", "Roma Urbe", "Romeo"),
	airport("MXP", "Malpensa International Airport", "Milan"),
	airport("ZRH", "Zürich Airport", "Zürich"),
	airport("SAO", "São Paulo Airport", "São Paulo"),
]);

const codes = (query: string, limit?: number) =>
	index.search(query, limit).map((a) => a.iata);

describe("the airport index", () => {
	it("gives an airport for its code", () => {
		expect(index.get("FCO")?.city).toBe("Rome");
	});

	it("gives no airport for an unknown code", () => {
		expect(index.get("XXX")).toBeUndefined();
	});

	it("compares the code with no regard to the case", () => {
		expect(index.get("fco")?.iata).toBe("FCO");
	});
});

describe("the search of airports", () => {
	it("puts the exact code first", () => {
		expect(codes("rom")[0]).toBe("ROM");
	});

	it("puts a city that starts with the text before a name that contains it", () => {
		expect(codes("rome")).toEqual(["CIA", "FCO", "ROM"]);
	});

	it("finds a word inside the name", () => {
		expect(codes("fiumicino")).toEqual(["FCO"]);
	});

	it("ignores the accents and the case", () => {
		expect(codes("zurich")).toEqual(["ZRH"]);
		expect(codes("SAO PAULO")).toEqual(["SAO"]);
	});

	it("gives nothing for a text of fewer than 2 characters", () => {
		expect(codes("r")).toEqual([]);
		expect(codes(" ")).toEqual([]);
	});

	it("gives nothing when no airport matches", () => {
		expect(codes("qwerty")).toEqual([]);
	});

	it("gives at most the limit", () => {
		expect(codes("airport", 2)).toHaveLength(2);
	});

	it("trims the spaces of the text", () => {
		expect(codes("  fco  ")[0]).toBe("FCO");
	});
});
