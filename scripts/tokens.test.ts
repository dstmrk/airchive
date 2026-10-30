import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PAPER } from "../src/client/lib/pass.ts";

/**
 * A few colours of `app.css` are also in TypeScript, because a computation
 * needs them (the contrast of the accent on the paper). This test keeps the
 * two copies equal. It is here and not beside `pass.ts`, because Vitest gives
 * an empty text for a CSS file that a test of the client imports.
 */
describe("the tokens that TypeScript copies", () => {
	it("give the same paper in pass.ts and in app.css", () => {
		const css = readFileSync(
			new URL("../src/client/styles/app.css", import.meta.url),
			"utf8",
		);

		expect(css).toContain(`--color-paper: ${PAPER};`);
	});
});
