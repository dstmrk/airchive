import { createContext, type ReactNode, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "../../shared/locale.ts";
import { type Messages, messages } from "./messages.ts";

const TextContext = createContext<Messages>(messages[DEFAULT_LOCALE]);

type I18nProviderProps = Readonly<{
	locale: Locale;
	children: ReactNode;
}>;

/** It gives the catalogue of `locale` to each component below it. */
export function I18nProvider({ locale, children }: I18nProviderProps) {
	return (
		<TextContext.Provider value={messages[locale]}>
			{children}
		</TextContext.Provider>
	);
}

/** It gives the catalogue of the current locale. */
export function useText(): Messages {
	return useContext(TextContext);
}
