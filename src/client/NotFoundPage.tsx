import { Link } from "@tanstack/react-router";
import { useText } from "./i18n/I18nProvider.tsx";

export function NotFoundPage() {
	const text = useText();

	return (
		<main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-4">
			<h1 className="font-semibold text-2xl">{text.notFoundTitle}</h1>
			<Link to="/" className="underline underline-offset-4">
				{text.notFoundBack}
			</Link>
		</main>
	);
}
