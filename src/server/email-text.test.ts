import { describe, expect, it } from "vitest";
import { MAGIC_LINK_TTL_MINUTES } from "../shared/auth.ts";
import { LOCALES } from "../shared/locale.ts";
import { emailText } from "./email-text.ts";

describe("the text of the magic link email", () => {
	it.each(LOCALES)(
		"gives the same life of the link as the auth in %s",
		(locale) => {
			expect(emailText[locale].magicLinkExpiry).toContain(
				String(MAGIC_LINK_TTL_MINUTES),
			);
		},
	);

	it("is in Italian for it", () => {
		expect(emailText.it.magicLinkSubject).toContain("accesso");
	});
});
