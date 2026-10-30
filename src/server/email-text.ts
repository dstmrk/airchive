/**
 * The text of the emails, in English. The Worker sends an email, thus this
 * text is on the server and not in the catalogues of `src/client/i18n/`.
 * Refer to paragraph 5.2 of `docs/architecture.md`.
 */
export const emailText = {
	magicLinkSubject: "Your sign-in link for airchive",
	magicLinkIntro: "Open this link to sign in to airchive:",
	magicLinkButton: "Sign in",
	magicLinkExpiry:
		"The link works one time and expires in 15 minutes. If you did not ask for it, ignore this email.",
};
