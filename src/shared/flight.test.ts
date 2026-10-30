import { describe, expect, it } from "vitest";
import { flightInputSchema, splitFlightDesignator } from "./flight.ts";

const valid = {
	airlineCode: "AZ",
	flightNumber: "784",
	airlineName: null,
	origin: "FCO",
	destination: "NRT",
	departureDate: "2024-05-12",
	departureTime: "13:05",
	arrivalDate: "2024-05-13",
	arrivalTime: "09:10",
	seat: "14A",
	cabinClass: "economy",
	passengerName: null,
	bookingReference: "ABC123",
};

function parse(overrides: Record<string, unknown>) {
	return flightInputSchema.safeParse({ ...valid, ...overrides });
}

describe("flightInputSchema", () => {
	it("accepts a complete flight", () => {
		expect(parse({}).success).toBe(true);
	});

	it("accepts a flight with only the required fields", () => {
		const result = flightInputSchema.safeParse({
			airlineCode: "AZ",
			flightNumber: "784",
			origin: "FCO",
			destination: "NRT",
			departureDate: "2024-05-12",
		});

		expect(result.success).toBe(true);
		expect(result.data?.departureTime).toBeNull();
		expect(result.data?.seat).toBeNull();
	});

	it("writes the codes in uppercase and trims the spaces", () => {
		const result = parse({
			airlineCode: " az ",
			origin: "fco",
			seat: "14a",
			bookingReference: "abc123",
		});

		expect(result.data).toMatchObject({
			airlineCode: "AZ",
			origin: "FCO",
			seat: "14A",
			bookingReference: "ABC123",
		});
	});

	it.each(["INF", "inf"])(
		"accepts the seat %s of an infant with no seat",
		(seat) => {
			expect(parse({ seat }).data?.seat).toBe("INF");
		},
	);

	it("removes the leading zeros of the flight number", () => {
		expect(parse({ flightNumber: "0784" }).data?.flightNumber).toBe("784");
		expect(parse({ flightNumber: "0000" }).success).toBe(false);
	});

	it("makes an empty optional text null", () => {
		expect(parse({ airlineName: "  ", seat: "" }).data).toMatchObject({
			airlineName: null,
			seat: null,
		});
	});

	it.each([
		["airlineCode", "A"],
		["airlineCode", "ABCD"],
		["flightNumber", "12345"],
		["flightNumber", "AB"],
		["origin", "FC"],
		["destination", "1234"],
		["departureDate", "2024-02-30"],
		["departureDate", "12/05/2024"],
		["departureTime", "25:00"],
		["departureTime", "9:5"],
		["seat", "14AB5"],
		["seat", "INFT"],
		["seat", "1INF"],
		["cabinClass", "luxury"],
		["bookingReference", "AB"],
		["passengerName", "x".repeat(101)],
		["airlineName", "x".repeat(81)],
	])("refuses %s = %j", (field, value) => {
		expect(parse({ [field]: value }).success).toBe(false);
	});

	it("refuses the same airport for the origin and the destination", () => {
		const result = parse({ destination: "FCO" });

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual(["destination"]);
	});

	it("refuses an arrival date before the departure date", () => {
		const result = parse({ arrivalDate: "2024-05-11" });

		expect(result.success).toBe(false);
		expect(result.error?.issues[0]?.path).toEqual(["arrivalDate"]);
	});

	it("accepts a leap day", () => {
		expect(
			parse({ departureDate: "2024-02-29", arrivalDate: null }).success,
		).toBe(true);
		expect(
			parse({ departureDate: "2023-02-29", arrivalDate: null }).success,
		).toBe(false);
	});

	it("refuses a departure date before 1950", () => {
		expect(
			parse({ departureDate: "1949-12-31", arrivalDate: null }).success,
		).toBe(false);
	});

	it("accepts the colour of an airline as #rrggbb, in lowercase", () => {
		expect(parse({ accentColor: "#00205B" }).data?.accentColor).toBe("#00205b");
		expect(parse({}).data?.accentColor).toBeNull();
	});

	it.each(["rgb(0,0,0)", "#fff", "blue", "#00205bff"])(
		"refuses the colour %j",
		(accentColor) => {
			expect(parse({ accentColor }).success).toBe(false);
		},
	);

	it("refuses a field that the schema does not know", () => {
		expect(parse({ ownerId: "someone-else" }).success).toBe(false);
	});
});

describe("splitFlightDesignator", () => {
	it.each([
		["AZ784", { airlineCode: "AZ", flightNumber: "784" }],
		["AZ 784", { airlineCode: "AZ", flightNumber: "784" }],
		["az 0784", { airlineCode: "AZ", flightNumber: "784" }],
		["U2 1234", { airlineCode: "U2", flightNumber: "1234" }],
		["4U 22", { airlineCode: "4U", flightNumber: "22" }],
		["BAW 123", { airlineCode: "BAW", flightNumber: "123" }],
		["LH400A", { airlineCode: "LH", flightNumber: "400A" }],
	])("splits %j", (text, expected) => {
		expect(splitFlightDesignator(text)).toEqual(expected);
	});

	it.each(["", "AZ", "784", "A 784", "AZ 12345", "AZ-784x9"])(
		"gives null for %j",
		(text) => {
			expect(splitFlightDesignator(text)).toBeNull();
		},
	);
});
