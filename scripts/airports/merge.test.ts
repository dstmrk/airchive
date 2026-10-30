import { describe, expect, it } from "vitest";
import {
	type Airport,
	type MwggAirport,
	mergeAirports,
	type OurAirportsRow,
} from "./merge.ts";

const tzOf = (_lat: number, lon: number) =>
	lon > 0 ? "Europe/Rome" : "America/Anchorage";

function mwgg(iata: string, extra: Partial<MwggAirport> = {}): MwggAirport {
	return {
		iata,
		name: `${iata} Airport`,
		city: `${iata} City`,
		country: "IT",
		lat: 41.8,
		lon: 12.25,
		tz: "Europe/Rome",
		...extra,
	};
}

function oa(iata: string, extra: Partial<OurAirportsRow> = {}): OurAirportsRow {
	return {
		iata_code: iata,
		name: `${iata} OA`,
		municipality: `${iata} Town`,
		iso_country: "US",
		latitude_deg: "61.17",
		longitude_deg: "-150.0",
		type: "small_airport",
		...extra,
	};
}

const codes = (airports: Airport[]) => airports.map((a) => a.iata);

describe("mergeAirports", () => {
	it("takes each airport of mwgg with its time zone", () => {
		const result = mergeAirports({
			previous: [],
			mwgg: [mwgg("FCO")],
			ourAirports: [],
			tzOf,
		});

		expect(result).toEqual([
			{
				iata: "FCO",
				name: "FCO Airport",
				city: "FCO City",
				country: "IT",
				lat: 41.8,
				lon: 12.25,
				tz: "Europe/Rome",
			},
		]);
	});

	it("adds a code of OurAirports that mwgg does not have, with the time zone from the coordinates", () => {
		const result = mergeAirports({
			previous: [],
			mwgg: [mwgg("FCO")],
			ourAirports: [oa("KTN")],
			tzOf,
		});

		const ktn = result.find((a) => a.iata === "KTN");
		expect(ktn).toEqual({
			iata: "KTN",
			name: "KTN OA",
			city: "KTN Town",
			country: "US",
			lat: 61.17,
			lon: -150,
			tz: "America/Anchorage",
		});
	});

	it("keeps the entry of mwgg when the two sources have the same code", () => {
		const result = mergeAirports({
			previous: [],
			mwgg: [mwgg("FCO")],
			ourAirports: [oa("FCO", { name: "Other name" })],
			tzOf,
		});

		expect(result).toHaveLength(1);
		expect(result[0]?.name).toBe("FCO Airport");
	});

	it("never removes a code of the previous file", () => {
		const previous: Airport[] = [
			{
				iata: "TXL",
				name: "Tegel",
				city: "Berlin",
				country: "DE",
				lat: 52.56,
				lon: 13.29,
				tz: "Europe/Berlin",
			},
		];

		const result = mergeAirports({
			previous,
			mwgg: [mwgg("FCO")],
			ourAirports: [],
			tzOf,
		});

		expect(codes(result)).toEqual(["FCO", "TXL"]);
		expect(result.find((a) => a.iata === "TXL")).toEqual(previous[0]);
	});

	it("updates a previous code with the new data of the sources", () => {
		const previous: Airport[] = [
			{
				iata: "FCO",
				name: "Old name",
				city: "Rome",
				country: "IT",
				lat: 41.8,
				lon: 12.25,
				tz: "Europe/Rome",
			},
		];

		const result = mergeAirports({
			previous,
			mwgg: [mwgg("FCO")],
			ourAirports: [],
			tzOf,
		});

		expect(result[0]?.name).toBe("FCO Airport");
	});

	it("keeps the first entry when mwgg has a code two times", () => {
		const result = mergeAirports({
			previous: [],
			mwgg: [mwgg("FCO", { name: "First" }), mwgg("FCO", { name: "Second" })],
			ourAirports: [],
			tzOf,
		});

		expect(result.map((a) => a.name)).toEqual(["First"]);
	});

	it.each([
		["an empty code", mwgg("")],
		["a code of two letters", mwgg("FC")],
		["a lowercase code", mwgg("fco")],
		["no time zone", mwgg("FCO", { tz: "" })],
		["a latitude out of range", mwgg("FCO", { lat: 91 })],
		["a longitude that is not a number", mwgg("FCO", { lon: Number.NaN })],
	])("skips an entry of mwgg with %s", (_label, entry) => {
		expect(
			mergeAirports({ previous: [], mwgg: [entry], ourAirports: [], tzOf }),
		).toEqual([]);
	});

	it.each([
		["a closed airport", oa("ABC", { type: "closed" })],
		["coordinates that are not numbers", oa("ABC", { latitude_deg: "" })],
		["no code", oa("")],
	])("skips a row of OurAirports with %s", (_label, row) => {
		expect(
			mergeAirports({ previous: [], mwgg: [], ourAirports: [row], tzOf }),
		).toEqual([]);
	});

	it("uses the name as the city when OurAirports gives no city", () => {
		const result = mergeAirports({
			previous: [],
			mwgg: [],
			ourAirports: [oa("ABC", { municipality: "" })],
			tzOf,
		});

		expect(result[0]?.city).toBe("ABC OA");
	});

	it("sorts the airports by code", () => {
		const result = mergeAirports({
			previous: [],
			mwgg: [mwgg("MXP"), mwgg("BER")],
			ourAirports: [oa("KTN")],
			tzOf,
		});

		expect(codes(result)).toEqual(["BER", "KTN", "MXP"]);
	});

	it("rounds the coordinates to four decimals", () => {
		const result = mergeAirports({
			previous: [],
			mwgg: [mwgg("FCO", { lat: 41.8045005798, lon: 12.2508001328 })],
			ourAirports: [],
			tzOf,
		});

		expect(result[0]).toMatchObject({ lat: 41.8045, lon: 12.2508 });
	});
});
