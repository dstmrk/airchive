import type { Messages } from "../i18n/messages.ts";

/**
 * The message for a failed request of a magic link, from the HTTP status.
 * The client of Better Auth gives the status in `error.status`.
 */
export function requestErrorKey(
	status: number | undefined,
): keyof Messages & `signIn${string}` {
	if (status === 429) {
		return "signInTooMany";
	}
	if (status === 400) {
		return "signInInvalidEmail";
	}
	return "signInFailed";
}

/**
 * The message for a link that did not open a session. Better Auth sends the
 * person back to the page of the sign-in with `?error=<code>`. An expired link
 * also gives `INVALID_TOKEN`, thus each code gives the same message.
 */
export function linkErrorKey(code: string | null): "linkInvalid" | null {
	return code ? "linkInvalid" : null;
}
