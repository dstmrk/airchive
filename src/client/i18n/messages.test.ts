import { describe, expect, it } from "vitest";
import { LOCALES } from "./locale.ts";
import { messages } from "./messages.ts";

/**
 * The type `Messages` makes a missing key a compile error. These tests examine
 * the values, which the type cannot examine.
 */
describe("the catalogues of text", () => {
	it("holds one catalogue for each supported locale", () => {
		expect(Object.keys(messages).sort()).toEqual([...LOCALES].sort());
	});

	it.each(LOCALES)("holds no empty text in the catalogue %s", (locale) => {
		const empty = Object.entries(messages[locale])
			.filter(([, value]) => value.trim() === "")
			.map(([key]) => key);

		expect(empty).toEqual([]);
	});
});
