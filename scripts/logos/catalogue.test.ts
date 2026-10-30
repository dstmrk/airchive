import { describe, expect, it } from "vitest";
import catalogue from "../../src/client/logos/airlines.json" with {
	type: "json",
};
import {
	addLogo,
	type LogoEntry,
	missingLogosSql,
	parseSingleColourSvg,
	validateCatalogue,
} from "./catalogue.ts";

const entry = (overrides: Partial<LogoEntry> = {}): LogoEntry => ({
	codes: ["XA"],
	title: "Example Air",
	source: "Simple Icons 16.36.0, icon `example`, CC0 1.0.",
	viewBox: "0 0 24 24",
	path: "M0 0h24v24H0z",
	...overrides,
});

describe("the catalogue in the repository", () => {
	it("is valid", () => {
		expect(validateCatalogue(catalogue as LogoEntry[])).toEqual([]);
	});
});

describe("validateCatalogue", () => {
	it.each([
		["a code that is not IATA", [entry({ codes: ["XAA"] })], "XAA"],
		["no code", [entry({ codes: [] })], "no code"],
		["no source", [entry({ source: " " })], "source"],
		["a bad view box", [entry({ viewBox: "0 0 24" })], "viewBox"],
		["a path with other characters", [entry({ path: "M0 0<script>" })], "path"],
		["a bad date", [entry({ since: "2021-13-01" })], "since"],
		[
			"an end before the start",
			[entry({ since: "2021-01-01", until: "2020-01-01" })],
			"until",
		],
		[
			"the same code twice with no dates",
			[entry(), entry({ title: "Other" })],
			"XA",
		],
		[
			"two periods that overlap",
			[
				entry({ until: "2021-10-14" }),
				entry({ title: "New", since: "2021-10-01" }),
			],
			"XA",
		],
		[
			"an order that is not by title",
			[entry({ title: "Z" }), entry({ title: "A", codes: ["XB"] })],
			"order",
		],
	])("finds %s", (_label, entries, word) => {
		const errors = validateCatalogue(entries);

		expect(errors.join(" ")).toContain(word);
	});

	it("accepts one code with two periods that follow each other", () => {
		expect(
			validateCatalogue([
				entry({ title: "Alitalia", until: "2021-10-14" }),
				entry({ title: "ITA Airways", since: "2021-10-15" }),
			]),
		).toEqual([]);
	});
});

describe("addLogo", () => {
	it("puts the new logo in the order of the titles", () => {
		const result = addLogo(
			[
				entry({ title: "Alpha", codes: ["AA"] }),
				entry({ title: "Gamma", codes: ["GG"] }),
			],
			entry({ title: "beta", codes: ["BB"] }),
		);

		expect(result.map((e) => e.title)).toEqual(["Alpha", "beta", "Gamma"]);
	});

	it("refuses a logo that makes the catalogue invalid", () => {
		expect(() => addLogo([entry()], entry({ title: "Copy" }))).toThrow(/XA/);
	});
});

describe("parseSingleColourSvg", () => {
	it("gives the view box and the path of a Simple Icons file", () => {
		expect(
			parseSingleColourSvg(
				'<svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>Example</title><path d="M0 0h24v24H0z"/></svg>',
			),
		).toEqual({ viewBox: "0 0 24 24", path: "M0 0h24v24H0z" });
	});

	it("joins the paths of a file with more than one path", () => {
		expect(
			parseSingleColourSvg(
				'<svg viewBox="0 0 100 40"><path d="M0 0h10v10H0z" fill="#123"/><path fill="#123" d="M20 0h10v10H20z"/></svg>',
			).path,
		).toBe("M0 0h10v10H0z M20 0h10v10H20z");
	});

	it.each([
		["no view box", '<svg><path d="M0 0h1"/></svg>', "viewBox"],
		[
			"a transform",
			'<svg viewBox="0 0 1 1"><g transform="scale(2)"><path d="M0 0h1"/></g></svg>',
			"transform",
		],
		[
			"a shape that is not a path",
			'<svg viewBox="0 0 1 1"><circle r="1"/></svg>',
			"circle",
		],
		[
			"two colours",
			'<svg viewBox="0 0 1 1"><path fill="#000" d="M0 0h1"/><path fill="#f00" d="M0 0v1"/></svg>',
			"colour",
		],
		["no path", '<svg viewBox="0 0 1 1"></svg>', "path"],
	])("refuses a file with %s", (_label, svg, word) => {
		expect(() => parseSingleColourSvg(svg)).toThrow(word);
	});
});

describe("missingLogosSql", () => {
	it("counts the flights of each code with no logo", () => {
		const sql = missingLogosSql([
			entry({ codes: ["AZ"], since: "2021-10-15" }),
			entry({ codes: ["LH"] }),
		]);

		expect(sql).toContain("FROM flight");
		expect(sql).toContain("GROUP BY airline_code");
		expect(sql).toContain("'LH'");
		// A code with a period needs the date of each flight.
		expect(sql).toContain(
			"airline_code = 'AZ' AND departure_date >= '2021-10-15'",
		);
		expect(sql).not.toContain("passenger");
	});
});
