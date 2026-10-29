import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, pickLocale } from "./locale.ts";

describe("pickLocale", () => {
	it("gives the default locale for an empty list", () => {
		expect(pickLocale([])).toBe(DEFAULT_LOCALE);
	});

	it("gives a supported locale for an exact tag", () => {
		expect(pickLocale(["en"])).toBe("en");
	});

	it("compares the primary subtag only", () => {
		expect(pickLocale(["en-GB"])).toBe("en");
	});

	it("ignores the case of the tag", () => {
		expect(pickLocale(["EN-us"])).toBe("en");
	});

	it("gives the first supported locale in the order of the browser", () => {
		expect(pickLocale(["xx", "en-US"])).toBe("en");
	});

	it("gives the default locale when no tag is supported", () => {
		expect(pickLocale(["xx-YY", "zz"])).toBe(DEFAULT_LOCALE);
	});

	it("ignores an empty tag", () => {
		expect(pickLocale(["", "en"])).toBe("en");
	});
});
