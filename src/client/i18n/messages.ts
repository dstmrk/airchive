import type { Locale } from "../../shared/locale.ts";
import { en } from "./en.ts";
import { it } from "./it.ts";

/** The keys of the English catalogue. Each catalogue must hold all of them. */
export type Messages = Record<keyof typeof en, string>;

/**
 * One catalogue for each locale. The type `Record<Locale, Messages>` makes a
 * missing catalogue or a missing key a compile error.
 */
export const messages: Record<Locale, Messages> = { en, it };
