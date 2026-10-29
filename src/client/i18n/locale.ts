/**
 * The locales of the user interface. English is the only locale now. To add a
 * locale, add its tag here and its catalogue in `messages.ts`. Refer to
 * paragraph 5.2 of `docs/architecture.md`.
 */
export const LOCALES = ["en"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

function isLocale(tag: string): tag is Locale {
	return (LOCALES as readonly string[]).includes(tag);
}

/**
 * It gives the first supported locale in the list of the browser
 * (`navigator.languages`), or the default locale.
 *
 * The comparison uses the primary subtag only: `en-GB` gives `en`. A catalogue
 * for a region is not necessary for this application.
 */
export function pickLocale(languages: readonly string[]): Locale {
	for (const tag of languages) {
		const primary = tag.split("-")[0]?.toLowerCase() ?? "";
		if (isLocale(primary)) {
			return primary;
		}
	}
	return DEFAULT_LOCALE;
}
