import { strToU8, zipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import type { Airport } from "../../../shared/airport.ts";
import { importFile, importPass, MAX_IMAGE_BYTES } from "./import.ts";

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

describe("importFile", () => {
	const BCBP = "M1TRAVELER/ALEX MR    EK7Q2XD FCONRTAZ 0784 133Y014A0042 100";
	const options = (
		readBarcode: (bytes: Uint8Array) => Promise<string | null>,
	) => ({
		findAirport: async (code: string) => airports[code] ?? null,
		today: "2024-06-01",
		readBarcode,
	});
	const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

	it("reads a .pkpass file as a pass, not as an image", async () => {
		const readBarcode = vi.fn(async () => null);

		const result = await importFile(pkpass(pass), options(readBarcode));

		expect(result).toMatchObject({ values: { departureTime: "13:05" } });
		expect(readBarcode).not.toHaveBeenCalled();
	});

	it("reads the barcode of an image, with the two airports", async () => {
		const result = await importFile(
			png,
			options(async () => BCBP),
		);

		expect(result).toEqual({
			values: expect.objectContaining({
				designator: "AZ 784",
				departureDate: "2024-05-12",
			}),
			airports: { origin: airports.FCO, destination: airports.NRT },
		});
	});

	it("asks for a screenshot for a PDF file", async () => {
		const readBarcode = vi.fn(async () => BCBP);
		const pdf = new TextEncoder().encode("%PDF-1.7 ...");

		expect(await importFile(pdf, options(readBarcode))).toEqual({
			error: "pdf_not_supported",
		});
		expect(readBarcode).not.toHaveBeenCalled();
	});

	it("gives an error for an image with no barcode of a boarding pass", async () => {
		expect(
			await importFile(
				png,
				options(async () => null),
			),
		).toEqual({
			error: "no_barcode",
		});
	});

	it("gives an error for a file that the browser cannot read as an image", async () => {
		const result = await importFile(
			new TextEncoder().encode("hello"),
			options(async () => {
				throw new DOMException("The source image cannot be decoded.");
			}),
		);

		expect(result).toEqual({ error: "not_a_pass" });
	});

	it("refuses an image that is too large before it reads it", async () => {
		const readBarcode = vi.fn(async () => BCBP);
		const large = new Uint8Array(MAX_IMAGE_BYTES + 1);

		expect(await importFile(large, options(readBarcode))).toEqual({
			error: "file_too_large",
		});
		expect(readBarcode).not.toHaveBeenCalled();
	});
});
