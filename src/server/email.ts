import { emailText } from "./email-text.ts";

type EmailEnv = Pick<Env, "RESEND_API_KEY" | "EMAIL_FROM" | "BETTER_AUTH_URL">;

type MagicLink = {
	to: string;
	url: string;
};

const RESEND_URL = "https://api.resend.com/emails";

/**
 * A development origin is `http://localhost` with an optional port. The
 * comparison uses the parsed host, thus `http://localhost.evil.test` is not a
 * development origin.
 */
function isDevelopment(baseUrl: string): boolean {
	try {
		const url = new URL(baseUrl);
		return url.protocol === "http:" && url.hostname === "localhost";
	} catch {
		return false;
	}
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

/**
 * It sends the magic link with the HTTP API of Resend. The project uses no
 * SDK of Resend: one `fetch` is sufficient.
 *
 * With no `RESEND_API_KEY`, development writes the link to the log, and
 * production fails. Production never writes a link to the log, because a link
 * in the log opens the account of a person.
 */
export async function sendMagicLinkEmail(
	env: EmailEnv,
	link: MagicLink,
	fetchFn: typeof fetch = fetch,
): Promise<void> {
	if (!env.RESEND_API_KEY) {
		if (isDevelopment(env.BETTER_AUTH_URL)) {
			console.info(`Magic link for ${link.to}: ${link.url}`);
			return;
		}
		throw new Error("RESEND_API_KEY is missing: the Worker cannot send email.");
	}

	const href = escapeHtml(link.url);
	const response = await fetchFn(RESEND_URL, {
		method: "POST",
		headers: {
			authorization: `Bearer ${env.RESEND_API_KEY}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			from: env.EMAIL_FROM,
			to: [link.to],
			subject: emailText.magicLinkSubject,
			text: `${emailText.magicLinkIntro}\n\n${link.url}\n\n${emailText.magicLinkExpiry}`,
			html: `<p>${emailText.magicLinkIntro}</p><p><a href="${href}">${emailText.magicLinkButton}</a></p><p>${emailText.magicLinkExpiry}</p>`,
		}),
	});

	if (!response.ok) {
		throw new Error(`Resend refused the email: status ${response.status}.`);
	}
}
