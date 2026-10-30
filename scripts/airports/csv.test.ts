import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv.ts";

describe("parseCsv", () => {
	it("gives one object for each row, with the header as keys", () => {
		expect(parseCsv('"a","b"\n"1","2"\n')).toEqual([{ a: "1", b: "2" }]);
	});

	it("reads fields with no quotes", () => {
		expect(parseCsv("a,b\n1,2")).toEqual([{ a: "1", b: "2" }]);
	});

	it("keeps a comma in a quoted field", () => {
		expect(parseCsv('name,city\n"Rome, Fiumicino",Rome')).toEqual([
			{ name: "Rome, Fiumicino", city: "Rome" },
		]);
	});

	it("reads two quotes as one quote", () => {
		expect(parseCsv('name\n"The ""Big"" One"')).toEqual([
			{ name: 'The "Big" One' },
		]);
	});

	it("keeps a line break in a quoted field", () => {
		expect(parseCsv('a,b\n"x\ny",z')).toEqual([{ a: "x\ny", b: "z" }]);
	});

	it("reads CRLF line ends", () => {
		expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([{ a: "1", b: "2" }]);
	});

	it("gives an empty string for an empty field", () => {
		expect(parseCsv("a,b,c\n1,,3")).toEqual([{ a: "1", b: "", c: "3" }]);
	});

	it("gives no row for a file with a header only", () => {
		expect(parseCsv("a,b\n")).toEqual([]);
	});
});
