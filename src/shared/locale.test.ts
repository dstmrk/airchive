import { describe, expect, it } from "vitest";
import {
	acceptLanguageTags,
	DEFAULT_LOCALE,
	LOCALES,
	pickLocale,
} from "./locale.ts";

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

describe("the Italian locale", () => {
	it("is a supported locale", () => {
		expect(LOCALES).toContain("it");
	});

	it.each([["it-IT"], ["it"], ["IT-ch"]])("gives it for %s", (tag) => {
		expect(pickLocale([tag])).toBe("it");
	});

	it("keeps the order of the browser between two supported locales", () => {
		expect(pickLocale(["en-GB", "it-IT"])).toBe("en");
		expect(pickLocale(["it-IT", "en-US"])).toBe("it");
	});
});

describe("acceptLanguageTags", () => {
	it("gives the tags in the order of their weight", () => {
		expect(acceptLanguageTags("en;q=0.5, it-IT, it;q=0.9, fr;q=0.8")).toEqual([
			"it-IT",
			"it",
			"fr",
			"en",
		]);
	});

	it("keeps the order of the header for an equal weight", () => {
		expect(acceptLanguageTags("de, it")).toEqual(["de", "it"]);
	});

	it("drops a weight of 0, the wildcard and empty items", () => {
		expect(acceptLanguageTags("it;q=0, *, , en")).toEqual(["en"]);
	});

	it("reads a weight that is not a number as 0", () => {
		expect(acceptLanguageTags("it;q=x, en")).toEqual(["en"]);
	});

	it.each([[null], [""]])("gives no tag for %j", (header) => {
		expect(acceptLanguageTags(header)).toEqual([]);
	});

	it("gives Italian for the header of an Italian browser", () => {
		expect(
			pickLocale(acceptLanguageTags("it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7")),
		).toBe("it");
	});
});
