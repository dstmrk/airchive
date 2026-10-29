import { describe, expect, it } from "vitest";
import { linkErrorKey, requestErrorKey } from "./sign-in.ts";

describe("requestErrorKey", () => {
	it("gives the message of the rate limit for the status 429", () => {
		expect(requestErrorKey(429)).toBe("signInTooMany");
	});

	it("gives the message of a wrong address for the status 400", () => {
		expect(requestErrorKey(400)).toBe("signInInvalidEmail");
	});

	it.each([403, 500, 503, undefined])(
		"gives the general message for the status %s",
		(status) => {
			expect(requestErrorKey(status)).toBe("signInFailed");
		},
	);
});

describe("linkErrorKey", () => {
	it("gives no message when the page has no error", () => {
		expect(linkErrorKey(null)).toBeNull();
		expect(linkErrorKey("")).toBeNull();
	});

	// Better Auth gives INVALID_TOKEN also for an expired link, thus one
	// message covers the two cases.
	it.each(["INVALID_TOKEN", "failed_to_create_session", "something-else"])(
		"gives the message of an invalid or expired link for %s",
		(code) => {
			expect(linkErrorKey(code)).toBe("linkInvalid");
		},
	);
});
