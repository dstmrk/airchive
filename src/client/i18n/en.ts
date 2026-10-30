/**
 * The text of the user interface, in English. This catalogue gives the type
 * `Messages`, thus each other catalogue must hold the same keys.
 *
 * Each catalogue in `src/client/i18n/` is the only place for the text of its
 * language. The code of the components holds no text for the user.
 */
export const en = {
	appName: "airchive",
	tagline: "Every flight has a story",
	notFoundTitle: "Page not found",
	notFoundBack: "Go to the home page",

	signInLink: "Sign in",
	signInTitle: "Sign in to airchive",
	signInLead: "We send you a link. No password.",
	signInEmailLabel: "Email",
	signInSubmit: "Send me a link",
	signInSending: "Sending…",
	signInSentTitle: "Check your email",
	signInSentBody:
		"Open the link in the email to sign in. It expires in 15 minutes.",
	signInTooMany: "Too many requests. Try again in a minute.",
	signInInvalidEmail: "This email address is not valid.",
	signInFailed: "We could not send the link. Try again later.",
	linkInvalid: "This link is not valid or it expired. Ask for a new one.",

	signedInAs: "Signed in as",
	signOut: "Sign out",
};
