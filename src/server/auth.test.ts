import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { app } from "./app.ts";
import { createTestD1 } from "./test/d1.ts";
import {
	loggedLink,
	nextIp,
	TEST_ORIGIN as ORIGIN,
	requestLink as requestLinkFor,
	cookiesOf as sessionCookie,
	testEnv,
} from "./test/session.ts";

let db: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
	({ db, dispose } = await createTestD1());
});

afterAll(async () => {
	await dispose();
});

function env(overrides: Partial<Env> = {}): Env {
	return testEnv(db, overrides);
}

function requestLink(email: string, clientIp: string): Promise<Response> {
	return requestLinkFor(env(), email, clientIp);
}

let info: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
	info = vi.spyOn(console, "info").mockImplementation(() => {});
	return () => info.mockRestore();
});

describe("the magic link", () => {
	it("signs in a new person, and GET /api/me gives that person", async () => {
		const clientIp = nextIp();
		const asked = await requestLink("New.Person@Example.com", clientIp);
		expect(asked.status).toBe(200);

		const link = new URL(loggedLink(info));
		expect(link.pathname).toBe("/api/auth/magic-link/verify");

		const verified = await app.request(
			`${link.pathname}${link.search}`,
			{ headers: { "cf-connecting-ip": clientIp } },
			env(),
		);
		expect(verified.status).toBe(302);
		expect(verified.headers.get("location")).toBe(`${ORIGIN}/`);

		const me = await app.request(
			"/api/me",
			{ headers: { cookie: sessionCookie(verified) } },
			env(),
		);
		expect(me.status).toBe(200);
		const body = (await me.json()) as { email: string };
		expect(body.email).toBe("new.person@example.com");
	});

	it("opens the account one time only", async () => {
		const clientIp = nextIp();
		await requestLink("once@example.com", clientIp);
		const link = new URL(loggedLink(info));
		const path = `${link.pathname}${link.search}`;

		await app.request(path, {}, env());
		const second = await app.request(path, {}, env());

		expect(sessionCookie(second)).not.toContain("session_token=");
	});

	it("keeps no usable token in the database", async () => {
		await requestLink("hash@example.com", nextIp());
		const token = new URL(loggedLink(info)).searchParams.get("token");

		const rows = await db
			.prepare("SELECT identifier, value FROM verification")
			.all<{ identifier: string; value: string }>();
		const stored = JSON.stringify(rows.results);

		expect(token).toBeTruthy();
		expect(stored).not.toContain(String(token));
	});

	it("refuses a callback to another origin and sends no email", async () => {
		// A link that sends the person to another site after the sign-in is
		// an open redirect. Better Auth compares the callback with
		// `trustedOrigins` before it sends the email.
		const response = await app.request(
			"/api/auth/sign-in/magic-link",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: ORIGIN,
					"cf-connecting-ip": nextIp(),
				},
				body: JSON.stringify({
					email: "redirect@example.com",
					callbackURL: "https://evil.test/",
				}),
			},
			env(),
		);

		expect(response.status).toBe(403);
		expect(info).not.toHaveBeenCalled();
	});

	it("refuses a request from another origin", async () => {
		const response = await app.request(
			"/api/auth/sign-in/magic-link",
			{
				method: "POST",
				headers: {
					"content-type": "application/json",
					origin: "https://evil.test",
					"cf-connecting-ip": nextIp(),
				},
				body: JSON.stringify({ email: "x@example.com", callbackURL: "/" }),
			},
			env(),
		);

		expect(response.status).toBe(403);
		expect(info).not.toHaveBeenCalled();
	});

	it("refuses an address that is not an email", async () => {
		const response = await requestLink("not-an-email", nextIp());

		expect(response.status).toBe(400);
	});

	it("limits the requests of one address to 3 in a minute", async () => {
		const clientIp = nextIp();
		const statuses: number[] = [];
		for (let i = 0; i < 4; i += 1) {
			statuses.push(
				(await requestLink(`limit${i}@example.com`, clientIp)).status,
			);
		}

		expect(statuses).toEqual([200, 200, 200, 429]);
	});
});

describe("GET /api/me", () => {
	it("gives the status 401 with no session", async () => {
		const response = await app.request("/api/me", {}, env());

		expect(response.status).toBe(401);
		expect(await response.json()).toEqual({ error: "unauthorized" });
	});

	it("gives the status 401 for a false cookie", async () => {
		const response = await app.request(
			"/api/me",
			{ headers: { cookie: "better-auth.session_token=false.value" } },
			env(),
		);

		expect(response.status).toBe(401);
	});
});

describe("the auth with no secret", () => {
	it("gives the status 503 and sends no email", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		const response = await app.request(
			"/api/auth/sign-in/magic-link",
			{
				method: "POST",
				headers: { "content-type": "application/json", origin: ORIGIN },
				body: JSON.stringify({ email: "x@example.com", callbackURL: "/" }),
			},
			env({ BETTER_AUTH_SECRET: "" }),
		);

		expect(response.status).toBe(503);
		expect(info).not.toHaveBeenCalled();
		error.mockRestore();
	});
});
