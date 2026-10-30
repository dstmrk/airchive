import { describe, expect, it } from "vitest";
import { MAGIC_LINK_TTL_MINUTES } from "../../shared/auth.ts";
import { LOCALES } from "../../shared/locale.ts";
import { type Messages, messages } from "./messages.ts";

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

describe("the text of the sign-in", () => {
	it.each(LOCALES)(
		"gives the same life of the link as the auth in %s",
		(locale) => {
			expect(messages[locale].signInSentBody).toContain(
				String(MAGIC_LINK_TTL_MINUTES),
			);
		},
	);
});

describe("the Italian catalogue", () => {
	/** The texts that are the same in the two languages: names, codes and units. */
	const SAME_IN_ITALIAN = new Set([
		"appName",
		"signInEmailLabel",
		"cabinEconomy",
		"cabinPremiumEconomy",
		"cabinBusiness",
		"passNoValue",
		"speed15s",
		"speed30s",
		"speed1min",
		"speed5min",
		"speed4x",
	]);

	it("translates each text that is not a name, a code or a unit", () => {
		const untranslated = Object.entries(messages.it)
			.filter(([key, value]) => value === messages.en[key as keyof Messages])
			.map(([key]) => key)
			.filter((key) => !SAME_IN_ITALIAN.has(key));

		expect(untranslated).toEqual([]);
	});
});
