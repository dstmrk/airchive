import { describe, expect, it } from "vitest";
import { describeError } from "./errors.ts";

describe("describeError", () => {
	it("gives the message and each cause, the deepest last", () => {
		const root = new Error("D1_ERROR: no such table: rate_limit: SQLITE_ERROR");
		const query = new Error(
			'Failed query: select "id" from "rate_limit" where "key" = ?\nparams: 203.0.113.9|/sign-in/magic-link',
			{ cause: root },
		);

		expect(describeError(query)).toBe(
			'Failed query: select "id" from "rate_limit" where "key" = ? ← D1_ERROR: no such table: rate_limit: SQLITE_ERROR',
		);
	});

	it("keeps only the first line of each message, thus no parameter of the query goes to the log", () => {
		const error = new Error("Failed query: insert\nparams: person@example.com");

		expect(describeError(error)).not.toContain("person@example.com");
	});

	it("reads a value that is not an Error", () => {
		expect(describeError("plain text")).toBe("plain text");
		expect(describeError(undefined)).toBe("undefined");
	});

	it("stops after five causes, thus a cycle cannot loop", () => {
		const a = new Error("a");
		const b = new Error("b", { cause: a });
		(a as { cause?: unknown }).cause = b;

		expect(describeError(b).split(" ← ")).toHaveLength(5);
	});
});
