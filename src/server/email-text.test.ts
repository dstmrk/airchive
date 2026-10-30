import { describe, expect, it } from "vitest";
import { MAGIC_LINK_TTL_MINUTES } from "../shared/auth.ts";
import { emailText } from "./email-text.ts";

describe("the text of the magic link email", () => {
	it("gives the same life of the link as the auth", () => {
		expect(emailText.magicLinkExpiry).toContain(
			`${MAGIC_LINK_TTL_MINUTES} minutes`,
		);
	});
});
