import { afterEach, describe, expect, it, vi } from "vitest";
import { localeOfRequest, sendMagicLinkEmail } from "./email.ts";

const production = {
	RESEND_API_KEY: "re_test_key",
	EMAIL_FROM: "airchive <login@airchive.9874848.xyz>",
	BETTER_AUTH_URL: "https://airchive.9874848.xyz",
} as const;

const link = {
	to: "person@example.com",
	url: "https://airchive.9874848.xyz/api/auth/magic-link/verify?token=abc",
	locale: "en",
} as const;

afterEach(() => {
	vi.restoreAllMocks();
});

describe("sendMagicLinkEmail", () => {
	it("sends one email to Resend with the link", async () => {
		const fetchFn = vi.fn<typeof fetch>(
			async () => new Response("{}", { status: 200 }),
		);

		await sendMagicLinkEmail(production, link, fetchFn);

		expect(fetchFn).toHaveBeenCalledTimes(1);
		const [url, init = {}] = fetchFn.mock.calls[0] ?? [];
		expect(url).toBe("https://api.resend.com/emails");
		expect(init.method).toBe("POST");
		expect(new Headers(init.headers).get("authorization")).toBe(
			"Bearer re_test_key",
		);
		const body = JSON.parse(String(init.body));
		expect(body.from).toBe(production.EMAIL_FROM);
		expect(body.to).toEqual(["person@example.com"]);
		expect(body.text).toContain(link.url);
		expect(body.html).toContain(link.url.replace("&", "&amp;"));
	});

	it("escapes the link in the HTML body", async () => {
		const fetchFn = vi.fn<typeof fetch>(
			async () => new Response("{}", { status: 200 }),
		);
		const hostile = { ...link, url: 'https://x.test/?a=1&b="><script>' };

		await sendMagicLinkEmail(production, hostile, fetchFn);

		const init = fetchFn.mock.calls[0]?.[1] ?? {};
		const body = JSON.parse(String(init.body));
		expect(body.html).not.toContain("<script>");
		expect(body.html).toContain("&amp;b=&quot;&gt;&lt;script&gt;");
	});

	it("fails when Resend refuses the email", async () => {
		const fetchFn = vi.fn<typeof fetch>(
			async () => new Response("domain not verified", { status: 403 }),
		);

		await expect(sendMagicLinkEmail(production, link, fetchFn)).rejects.toThrow(
			"403",
		);
	});

	it("writes the link to the log in development with no key", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const fetchFn = vi.fn<typeof fetch>();
		const development = {
			...production,
			RESEND_API_KEY: "",
			BETTER_AUTH_URL: "http://localhost:5173",
		};

		await sendMagicLinkEmail(development, link, fetchFn);

		expect(fetchFn).not.toHaveBeenCalled();
		expect(info).toHaveBeenCalledWith(expect.stringContaining(link.url));
	});

	it("fails in production with no key, and writes no link to the log", async () => {
		const info = vi.spyOn(console, "info").mockImplementation(() => {});
		const fetchFn = vi.fn<typeof fetch>();

		await expect(
			sendMagicLinkEmail({ ...production, RESEND_API_KEY: "" }, link, fetchFn),
		).rejects.toThrow("RESEND_API_KEY");
		expect(fetchFn).not.toHaveBeenCalled();
		expect(info).not.toHaveBeenCalled();
	});

	it("does not treat a host that starts with localhost as development", async () => {
		const fetchFn = vi.fn<typeof fetch>();

		await expect(
			sendMagicLinkEmail(
				{
					...production,
					RESEND_API_KEY: "",
					BETTER_AUTH_URL: "http://localhost.evil.test",
				},
				link,
				fetchFn,
			),
		).rejects.toThrow("RESEND_API_KEY");
	});
});

describe("the language of the email", () => {
	it("sends the Italian text for the locale it", async () => {
		const fetchFn = vi.fn<typeof fetch>(
			async () => new Response("{}", { status: 200 }),
		);

		await sendMagicLinkEmail(production, { ...link, locale: "it" }, fetchFn);

		const body = JSON.parse(String(fetchFn.mock.calls[0]?.[1]?.body));
		expect(body.subject).toContain("accesso");
		expect(body.html).toContain(">Accedi</a>");
	});

	it.each([
		["it-IT,it;q=0.9,en;q=0.8", "it"],
		["en-GB,en;q=0.9", "en"],
		["de-DE", "en"],
		[null, "en"],
	])("reads %j as %s", (header, locale) => {
		const headers = new Headers(header ? { "accept-language": header } : {});

		expect(localeOfRequest(headers)).toBe(locale);
	});

	it("gives English with no headers", () => {
		expect(localeOfRequest(undefined)).toBe("en");
	});
});
