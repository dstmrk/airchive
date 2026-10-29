import { useText } from "./i18n/I18nProvider.tsx";

export function HomePage() {
	const text = useText();

	return (
		<main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-4">
			<h1 className="font-semibold text-3xl tracking-tight">{text.appName}</h1>
			<p className="text-muted-foreground">{text.tagline}</p>
		</main>
	);
}
