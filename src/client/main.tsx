import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { pickLocale } from "../shared/locale.ts";
import { I18nProvider } from "./i18n/I18nProvider.tsx";
import { router } from "./router.tsx";
import "./styles/app.css";

const root = document.getElementById("root");
if (root === null) {
	throw new Error("The element #root is not in the page.");
}

const locale = pickLocale(navigator.languages);
const queryClient = new QueryClient();
document.documentElement.lang = locale;

createRoot(root).render(
	<StrictMode>
		<I18nProvider locale={locale}>
			<QueryClientProvider client={queryClient}>
				<RouterProvider router={router} />
			</QueryClientProvider>
		</I18nProvider>
	</StrictMode>,
);
