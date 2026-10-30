import { vi } from "vitest";
import { app } from "../app.ts";

export const TEST_ORIGIN = "http://localhost:5173";

/** The environment of the Worker for a test, with a real D1 database. */
export function testEnv(db: D1Database, overrides: Partial<Env> = {}): Env {
	return {
		DB: db,
		BETTER_AUTH_URL: TEST_ORIGIN,
		BETTER_AUTH_SECRET: "a-secret-for-the-tests-and-for-no-server-0123456789",
		RESEND_API_KEY: "",
		EMAIL_FROM: "airchive <login@airchive.9874848.xyz>",
		...overrides,
	} as Env;
}

let ip = 0;
/** Each call gives a new address, thus the rate limit of a test stays alone. */
export function nextIp(): string {
	ip += 1;
	return `198.51.100.${ip % 250}`;
}

/** It asks for a magic link, as the client does. */
export async function requestLink(
	env: Env,
	email: string,
	clientIp: string,
	callbackURL = "/",
): Promise<Response> {
	return await app.request(
		"/api/auth/sign-in/magic-link",
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: TEST_ORIGIN,
				"cf-connecting-ip": clientIp,
			},
			body: JSON.stringify({ email, callbackURL }),
		},
		env,
	);
}

/** The last magic link that the Worker wrote to the log in development. */
export function loggedLink(info: { mock: { calls: unknown[][] } }): string {
	const line = String(info.mock.calls.at(-1)?.[0] ?? "");
	const match = /(http\S+)$/.exec(line);
	if (match?.[1] === undefined) {
		throw new Error(`No link in the log: ${line}`);
	}
	return match[1];
}

/** The cookies of a response, as the header `cookie` of the next request. */
export function cookiesOf(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0])
		.join("; ");
}

/**
 * It signs in a person with the real magic link flow and gives the cookie of
 * the session.
 */
export async function signIn(env: Env, email: string): Promise<string> {
	const info = vi.spyOn(console, "info").mockImplementation(() => {});
	try {
		const clientIp = nextIp();
		const asked = await requestLink(env, email, clientIp);
		if (asked.status !== 200) {
			throw new Error(`The magic link gave the status ${asked.status}.`);
		}
		const link = new URL(loggedLink(info));
		const verified = await app.request(
			`${link.pathname}${link.search}`,
			{ headers: { "cf-connecting-ip": clientIp } },
			env,
		);
		return cookiesOf(verified);
	} finally {
		info.mockRestore();
	}
}
