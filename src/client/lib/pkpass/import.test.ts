import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import type { Airport } from "../../../shared/airport.ts";
import { importPass } from "./import.ts";

const airports: Record<string, Airport> = {
	FCO: {
		iata: "FCO",
		name: "Fiumicino",
		city: "Rome",
		country: "IT",
		lat: 41.8,
		lon: 12.25,
		tz: "Europe/Rome",
	},
	NRT: {
		iata: "NRT",
		name: "Narita",
		city: "Tokyo",
		country: "JP",
		lat: 35.76,
		lon: 140.39,
		tz: "Asia/Tokyo",
	},
};

function pkpass(pass: unknown): Uint8Array {
	return zipSync({ "pass.json": strToU8(JSON.stringify(pass)) });
}

const pass = {
	boardingPass: { transitType: "PKTransitTypeAir" },
	semantics: {
		airlineCode: "AZ",
		flightNumber: 784,
		departureAirportCode: "FCO",
		destinationAirportCode: "NRT",
		originalDepartureDate: "2024-05-12T11:05:00Z",
	},
};

describe("importPass", () => {
	it("gives the values with the local time and the two airports", async () => {
		const findAirport = vi.fn(async (code: string) => airports[code] ?? null);

		const result = await importPass(pkpass(pass), {
			findAirport,
			today: "2024-06-01",
		});

		expect(result).toEqual({
			values: expect.objectContaining({
				origin: "FCO",
				departureTime: "13:05",
			}),
			airports: { origin: airports.FCO, destination: airports.NRT },
		});
		expect(findAirport).toHaveBeenCalledTimes(2);
	});

	it("gives the values also when an airport is not known", async () => {
		const result = await importPass(pkpass(pass), {
			findAirport: async () => null,
			today: "2024-06-01",
		});

		expect(result).toMatchObject({
			values: { origin: "FCO", departureTime: "11:05" },
			airports: { origin: null, destination: null },
		});
	});

	it("gives the error of a file that is not a pass", async () => {
		const result = await importPass(strToU8("not a zip"), {
			findAirport: async () => null,
			today: "2024-06-01",
		});

		expect(result).toEqual({ error: "not_a_pass" });
	});

	it("gives the error of a pass that is not a boarding pass", async () => {
		const result = await importPass(pkpass({ eventTicket: {} }), {
			findAirport: async () => null,
			today: "2024-06-01",
		});

		expect(result).toEqual({ error: "not_boarding_pass" });
	});

	it("gives an error when the pass has no data of a flight", async () => {
		const result = await importPass(
			pkpass({ boardingPass: { transitType: "PKTransitTypeAir" } }),
			{
				findAirport: async () => null,
				today: "2024-06-01",
			},
		);

		expect(result).toEqual({ error: "no_flight_data" });
	});
});
