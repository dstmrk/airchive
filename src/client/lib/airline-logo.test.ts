import { describe, expect, it } from "vitest";
import { airlineLogo } from "./airline-logo.ts";

const entries = [
	{
		codes: ["AZ"],
		title: "Alitalia",
		until: "2021-10-14",
		source: "s",
		viewBox: "0 0 1 1",
		path: "M0 0",
	},
	{
		codes: ["AZ"],
		title: "ITA Airways",
		since: "2021-10-15",
		source: "s",
		viewBox: "0 0 24 24",
		path: "M1 1",
	},
	{
		codes: ["HV", "TO"],
		title: "Transavia",
		source: "s",
		viewBox: "0 0 2 2",
		path: "M2 2",
	},
];

describe("airlineLogo", () => {
	it.each([
		["AZ", "2021-10-14", "Alitalia"],
		["AZ", "2021-10-15", "ITA Airways"],
		["TO", "2024-05-12", "Transavia"],
		["HV", "1999-01-01", "Transavia"],
	])("gives the logo of %s on %s", (code, date, title) => {
		expect(airlineLogo(code, date, entries)?.title).toBe(title);
	});

	it("gives only the items that the pass draws", () => {
		expect(airlineLogo("HV", "2024-05-12", entries)).toEqual({
			title: "Transavia",
			viewBox: "0 0 2 2",
			path: "M2 2",
		});
	});

	it("gives null for a code with no logo", () => {
		expect(airlineLogo("XX", "2024-05-12", entries)).toBeNull();
	});

	it("gives null before the first period of a code", () => {
		expect(airlineLogo("AZ", "2021-10-14", entries.slice(1))).toBeNull();
	});

	it("reads the catalogue of the repository by default", () => {
		expect(airlineLogo("LH", "2024-05-12")?.title).toBe("Lufthansa");
		expect(airlineLogo("AZ", "2019-06-01")).toBeNull();
	});
});
