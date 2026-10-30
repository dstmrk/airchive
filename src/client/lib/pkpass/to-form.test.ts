import { describe, expect, it } from "vitest";
import { passToForm } from "./to-form.ts";

const zones: Record<string, string> = {
	FCO: "Europe/Rome",
	NRT: "Asia/Tokyo",
	LHR: "Europe/London",
	JFK: "America/New_York",
};
const options = { tzOf: (code: string) => zones[code], today: "2024-06-01" };

/** A BCBP leg of 60 characters: Rome to Tokyo, AZ 784, day 133, seat 14A. */
const BCBP = "M1TRAVELER/ALEX MR    EK7Q2XD FCONRTAZ 0784 133Y014A0042 100";

const semanticPass = {
	formatVersion: 1,
	organizationName: "ITA Airways",
	backgroundColor: "rgb(0, 32, 91)",
	boardingPass: { transitType: "PKTransitTypeAir", primaryFields: [] },
	semantics: {
		airlineCode: "AZ",
		flightNumber: 784,
		departureAirportCode: "FCO",
		destinationAirportCode: "NRT",
		originalDepartureDate: "2024-05-12T11:05:00Z",
		originalArrivalDate: "2024-05-13T00:10:00Z",
		passengerName: { givenName: "Alex", familyName: "Traveler" },
		seats: [{ seatIdentifier: "14A" }],
		confirmationNumber: "K7Q2XD",
	},
};

describe("passToForm", () => {
	it("reads the semantic tags, with the local times of each airport", () => {
		expect(passToForm(semanticPass, options)).toEqual({
			values: {
				designator: "AZ 784",
				airlineName: "ITA Airways",
				origin: "FCO",
				destination: "NRT",
				departureDate: "2024-05-12",
				departureTime: "13:05",
				arrivalDate: "2024-05-13",
				arrivalTime: "09:10",
				seat: "14A",
				passengerName: "Alex Traveler",
				bookingReference: "K7Q2XD",
				accentColor: "#00205b",
			},
		});
	});

	it("reads the barcode when the pass has no semantic tags", () => {
		const pass = {
			organizationName: "ITA Airways",
			relevantDate: "2024-05-12T12:20+02:00",
			boardingPass: { transitType: "PKTransitTypeAir" },
			barcodes: [{ format: "PKBarcodeFormatPDF417", message: BCBP }],
		};

		expect(passToForm(pass, options)).toEqual({
			values: {
				designator: "AZ 784",
				airlineName: "ITA Airways",
				origin: "FCO",
				destination: "NRT",
				departureDate: "2024-05-12",
				seat: "14A",
				cabinClass: "economy",
				passengerName: "ALEX TRAVELER",
				bookingReference: "K7Q2XD",
			},
		});
	});

	it("reads the old barcode key of the format", () => {
		const pass = {
			boardingPass: { transitType: "PKTransitTypeAir" },
			barcode: { message: BCBP },
		};

		expect(passToForm(pass, options)).toMatchObject({
			values: { origin: "FCO", departureDate: "2024-05-12" },
		});
	});

	it("reads the fields of the pass when nothing else is there", () => {
		const pass = {
			organizationName: "Example Air",
			relevantDate: "2023-11-03T08:40:00+00:00",
			boardingPass: {
				transitType: "PKTransitTypeAir",
				headerFields: [{ key: "flight", label: "FLIGHT", value: "EX 12" }],
				primaryFields: [
					{ key: "from", label: "London", value: "LHR" },
					{ key: "to", label: "New York", value: "JFK" },
				],
				auxiliaryFields: [
					{ key: "seat", label: "SEAT", value: "32K" },
					{ key: "pnr", label: "BOOKING REF", value: "ZX9QW1" },
					{ key: "passenger", label: "PASSENGER", value: "Alex Traveler" },
				],
			},
		};

		expect(passToForm(pass, options)).toEqual({
			values: {
				designator: "EX 12",
				airlineName: "Example Air",
				origin: "LHR",
				destination: "JFK",
				departureDate: "2023-11-03",
				seat: "32K",
				passengerName: "Alex Traveler",
				bookingReference: "ZX9QW1",
			},
		});
	});

	it("reads INF in a free field when the barcode gives no seat", () => {
		const pass = {
			barcodes: [{ message: BCBP.replace("014A", "    ") }],
			boardingPass: {
				transitType: "PKTransitTypeAir",
				headerFields: [{ key: "seat", label: "Seat", value: "INF" }],
			},
		};

		expect(passToForm(pass, options)).toMatchObject({
			values: { seat: "INF" },
		});
	});

	it("reads INF in the semantic tags", () => {
		const pass = {
			...semanticPass,
			semantics: {
				...semanticPass.semantics,
				seats: [{ seatIdentifier: "inf" }],
			},
		};

		expect(passToForm(pass, options)).toMatchObject({
			values: { seat: "INF" },
		});
	});

	describe("the free fields of the time and the class", () => {
		/** The structure of a real pass, with no semantic tags and labels in Italian. */
		const freePass = (fields: Record<string, unknown>[]) => ({
			barcodes: [{ message: BCBP.replace("133Y", "133M") }],
			boardingPass: {
				transitType: "PKTransitTypeAir",
				auxiliaryFields: [
					{ key: "date", label: "Data di partenza", value: "12MAY24" },
					{ key: "boarding", label: "Imbarco", value: "12:35" },
					{ key: "gateCloses", label: "Chiusura imbarco", value: "12:50" },
				],
				backFields: fields,
			},
		});

		const valuesOf = (pass: Record<string, unknown>) => {
			const result = passToForm(pass, options);
			return "values" in result ? result.values : {};
		};

		it("reads the departure time and the class, and not the time of the boarding", () => {
			const pass = freePass([
				{ key: "class", label: "Classe", value: "Economy" },
				{ key: "fareInfo", label: "Tariffa", value: "BUSINESS SAVER" },
				{
					key: "departureTime",
					label: "Orario di partenza previsto",
					value: "13:05",
				},
			]);

			expect(passToForm(pass, options)).toMatchObject({
				values: { departureTime: "13:05", cabinClass: "economy" },
			});
		});

		it("gives no departure time when the pass has only the boarding", () => {
			expect(valuesOf(freePass([]))).not.toHaveProperty("departureTime");
		});

		it.each([
			["DEPARTS", "9:05", "09:05"],
			["Departure time", "13.05", "13:05"],
			["Ora di partenza", "25:00", undefined],
			["Departure", "1:05 PM", undefined],
		])("reads the label %s with %s as %s", (label, value, expected) => {
			const pass = freePass([{ key: "x", label, value }]);

			expect(valuesOf(pass).departureTime).toBe(expected);
		});

		it.each([
			["Economy", "economy"],
			["ECONOMY CLASS", "economy"],
			["Economica", "economy"],
			["Premium Economy", "premium_economy"],
			["Business", "business"],
			["First", "first"],
			["Prima", "first"],
			["Comfort", undefined],
			["M", undefined],
		])("reads the class %s as %s", (value, expected) => {
			const pass = freePass([{ key: "cabin", label: "Cabin", value }]);

			expect(valuesOf(pass).cabinClass).toBe(expected);
		});

		it("prefers the class of the barcode to the free field", () => {
			const pass = {
				...freePass([{ key: "class", label: "Class", value: "First" }]),
				barcodes: [{ message: BCBP }],
			};

			expect(passToForm(pass, options)).toMatchObject({
				values: { cabinClass: "economy" },
			});
		});

		it("prefers the semantic time to the free field", () => {
			const pass = {
				...semanticPass,
				boardingPass: {
					transitType: "PKTransitTypeAir",
					backFields: [{ key: "departureTime", label: "STD", value: "08:00" }],
				},
			};

			expect(passToForm(pass, options)).toMatchObject({
				values: { departureTime: "13:05" },
			});
		});
	});

	it("prefers the semantic tags to the barcode", () => {
		const pass = {
			...semanticPass,
			barcodes: [{ message: BCBP.replace("FCONRT", "LHRJFK") }],
		};

		expect(passToForm(pass, options)).toMatchObject({
			values: { origin: "FCO", destination: "NRT" },
		});
	});

	it("keeps the time of the text when the airport is not known", () => {
		const pass = {
			boardingPass: { transitType: "PKTransitTypeAir" },
			semantics: {
				departureAirportCode: "XYZ",
				destinationAirportCode: "FCO",
				originalDepartureDate: "2024-05-12T23:30:00-05:00",
			},
		};

		expect(passToForm(pass, options)).toMatchObject({
			values: { departureDate: "2024-05-12", departureTime: "23:30" },
		});
	});

	it("refuses a pass that is not a boarding pass", () => {
		expect(passToForm({ eventTicket: { primaryFields: [] } }, options)).toEqual(
			{
				error: "not_boarding_pass",
			},
		);
	});

	it("refuses a boarding pass of a train", () => {
		expect(
			passToForm(
				{ boardingPass: { transitType: "PKTransitTypeTrain" } },
				options,
			),
		).toEqual({
			error: "not_boarding_pass",
		});
	});

	it("ignores values of the wrong type and too long texts", () => {
		const pass = {
			organizationName: { evil: true },
			backgroundColor: "javascript:alert(1)",
			boardingPass: { transitType: "PKTransitTypeAir" },
			semantics: {
				departureAirportCode: 42,
				passengerName: { givenName: "x".repeat(500), familyName: "" },
				seats: "not a list",
				originalDepartureDate: "not a date",
			},
		};

		const result = passToForm(pass, options);
		expect(result).toEqual({ values: {} });
	});

	it("never copies a field that the form does not have", () => {
		const result = passToForm({ ...semanticPass, ownerId: "someone" }, options);

		expect(Object.keys("values" in result ? result.values : {})).not.toContain(
			"ownerId",
		);
	});
});
