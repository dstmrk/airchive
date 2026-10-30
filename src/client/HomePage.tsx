import { Link } from "@tanstack/react-router";
import { useText } from "./i18n/I18nProvider.tsx";
import { authClient } from "./lib/auth-client.ts";

export function HomePage() {
	const text = useText();
	const { data: session, isPending } = authClient.useSession();

	return (
		<main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-4">
			<h1 className="font-semibold text-3xl tracking-tight">{text.appName}</h1>
			<p className="text-muted-foreground">{text.tagline}</p>
			{!isPending &&
				(session ? (
					<div className="mt-6 flex flex-col items-start gap-2">
						<p className="text-sm">
							{text.signedInAs} <strong>{session.user.email}</strong>
						</p>
						<button
							type="button"
							onClick={() => authClient.signOut()}
							className="text-sm underline underline-offset-4"
						>
							{text.signOut}
						</button>
					</div>
				) : (
					<Link to="/sign-in" className="mt-6 underline underline-offset-4">
						{text.signInLink}
					</Link>
				))}
		</main>
	);
}
