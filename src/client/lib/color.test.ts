import { describe, expect, it } from "vitest";
import { contrastRatio, parsePassColor, usableAccent } from "./color.ts";

describe("parsePassColor", () => {
	it.each([
		["rgb(0, 32, 91)", "#00205b"],
		["rgb(0,32,91)", "#00205b"],
		["  rgb( 255 , 255 , 255 )  ", "#ffffff"],
		["#1F5F74", "#1f5f74"],
	])("reads %j as %s", (text, expected) => {
		expect(parsePassColor(text)).toBe(expected);
	});

	it.each([
		["a channel over 255", "rgb(256, 0, 0)"],
		["a colour name", "red"],
		["rgba", "rgba(0, 0, 0, 0.5)"],
		["a short hex", "#fff"],
		["not a text", 42],
		["nothing", undefined],
	])("gives null for %s", (_label, value) => {
		expect(parsePassColor(value)).toBeNull();
	});
});

describe("contrastRatio", () => {
	it("gives 21 for black on white", () => {
		expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
	});

	it("gives 1 for a colour on itself", () => {
		expect(contrastRatio("#1f5f74", "#1f5f74")).toBeCloseTo(1, 5);
	});
});

describe("usableAccent", () => {
	const paper = "#fbf7ee";

	it("keeps a dark colour of an airline", () => {
		expect(usableAccent("#00205b", paper)).toBe("#00205b");
	});

	it("refuses a white or a pale colour: it disappears on the paper", () => {
		expect(usableAccent("#ffffff", paper)).toBeNull();
		expect(usableAccent("#f2c94c", paper)).toBeNull();
	});

	it("gives null for no colour", () => {
		expect(usableAccent(null, paper)).toBeNull();
	});
});
