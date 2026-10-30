/**
 * The locales of the user interface and of the emails. To add a locale, add
 * its tag here, its catalogue in `src/client/i18n/messages.ts` and its text
 * in `src/server/email-text.ts`: the types make a missing one a compile
 * error. Refer to paragraph 5.2 of `docs/architecture.md`.
 *
 * The client and the server share this file: the page reads
 * `navigator.languages`, and the Worker reads the header `Accept-Language`
 * of the same browser.
 */
export const LOCALES = ["en", "it"] as const;

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

/**
 * The language tags of an `Accept-Language` header, the highest weight first.
 * An equal weight keeps the order of the header. A weight of 0, a weight that
 * is not a number and the wildcard `*` give no tag.
 */
export function acceptLanguageTags(header: string | null): string[] {
	return (header ?? "")
		.split(",")
		.map((item, index) => {
			const [tag = "", ...params] = item.trim().split(";");
			const q = params.find((param) => param.trim().startsWith("q="));
			const weight = q ? Number(q.trim().slice(2)) : 1;
			return {
				tag: tag.trim(),
				weight: Number.isNaN(weight) ? 0 : weight,
				index,
			};
		})
		.filter(({ tag, weight }) => tag !== "" && tag !== "*" && weight > 0)
		.sort((a, b) => b.weight - a.weight || a.index - b.index)
		.map(({ tag }) => tag);
}
