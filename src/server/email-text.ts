import type { Locale } from "../shared/locale.ts";

/**
 * The text of the emails, in each locale. The Worker sends an email, thus this
 * text is on the server and not in the catalogues of `src/client/i18n/`. The
 * type `Record<Locale, …>` makes a missing locale a compile error. Refer to
 * paragraph 5.2 of `docs/architecture.md`.
 */
export const emailText: Record<
	Locale,
	{
		magicLinkSubject: string;
		magicLinkIntro: string;
		magicLinkButton: string;
		magicLinkExpiry: string;
	}
> = {
	en: {
		magicLinkSubject: "Your sign-in link for airchive",
		magicLinkIntro: "Open this link to sign in to airchive:",
		magicLinkButton: "Sign in",
		magicLinkExpiry:
			"The link works one time and expires in 15 minutes. If you did not ask for it, ignore this email.",
	},
	it: {
		magicLinkSubject: "Il tuo link di accesso ad airchive",
		magicLinkIntro: "Apri questo link per accedere ad airchive:",
		magicLinkButton: "Accedi",
		magicLinkExpiry:
			"Il link funziona una volta sola e scade tra 15 minuti. Se non l'hai chiesto tu, ignora questa email.",
	},
};
