import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "./i18n/I18nProvider.tsx";
import { pickLocale } from "./i18n/locale.ts";
import { router } from "./router.tsx";
import "./styles/app.css";

const root = document.getElementById("root");
if (root === null) {
	throw new Error("The element #root is not in the page.");
}

const locale = pickLocale(navigator.languages);
document.documentElement.lang = locale;

createRoot(root).render(
	<StrictMode>
		<I18nProvider locale={locale}>
			<RouterProvider router={router} />
		</I18nProvider>
	</StrictMode>,
);
