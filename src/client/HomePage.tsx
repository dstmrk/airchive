import { Link } from "@tanstack/react-router";
import { Wordmark } from "./brand/Mark.tsx";
import { useText } from "./i18n/I18nProvider.tsx";
import { authClient } from "./lib/auth-client.ts";
import { formatDate } from "./lib/format.ts";
import { journeyChains, journeyTitle } from "./lib/journey.ts";
import { useJourneys } from "./lib/queries.ts";

export function HomePage() {
	const text = useText();
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return null;
	}
	if (!session) {
		return (
			<main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-2 px-4">
				<h1 aria-label={text.appName}>
					<Wordmark size="large" />
				</h1>
				<p className="text-muted-foreground">{text.tagline}</p>
				<Link to="/sign-in" className="mt-6 underline underline-offset-4">
					{text.signInLink}
				</Link>
			</main>
		);
	}

	return (
		<main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 py-8">
			<header className="flex items-center justify-between gap-2">
				<Wordmark size="small" />
				<button
					type="button"
					onClick={() => authClient.signOut()}
					className="text-muted-foreground text-sm underline underline-offset-4"
				>
					{text.signOut}
				</button>
			</header>
			<h1 className="font-semibold text-2xl tracking-tight">
				{text.archiveTitle}
			</h1>
			<Link
				to="/flights/new"
				className="flex h-11 items-center justify-center rounded-md bg-foreground px-4 font-medium text-background"
			>
				{text.addFlight}
			</Link>
			<Archive />
			<p className="text-muted-foreground text-xs">
				{text.signedInAs} {session.user.email}
			</p>
		</main>
	);
}

/** The journeys of the person, the most recent first. */
function Archive() {
	const text = useText();
	const { data: journeys, isPending, isError } = useJourneys();
	const locale = document.documentElement.lang;

	if (isPending) {
		return <p className="text-muted-foreground">{text.loading}</p>;
	}
	if (isError) {
		return <p role="alert">{text.archiveLoadFailed}</p>;
	}
	if (journeys.length === 0) {
		return <p className="text-muted-foreground">{text.archiveEmpty}</p>;
	}
	return (
		<ul className="flex flex-col divide-y divide-foreground/10">
			{journeys.map((journey) => {
				const first = journey.flights[0];
				return (
					<li key={journey.id}>
						<Link
							to="/journeys/$journeyId"
							params={{ journeyId: journey.id }}
							className="flex items-center justify-between gap-3 py-3"
						>
							<span className="flex min-w-0 flex-col">
								<span className="truncate font-medium">
									{journeyTitle(journey, text.journeyDefaultTitle)}
								</span>
								<span className="font-mono font-semibold text-lg">
									{journeyChains(journey.flights)
										.map((chain) => chain.join(" → "))
										.join(" · ")}
								</span>
							</span>
							<span className="flex shrink-0 flex-col items-end text-sm">
								{/* The chain of the codes already shows a journey of more legs. */}
								{journey.flights.length === 1 && first && (
									<span className="font-mono">
										{first.airlineCode} {first.flightNumber}
									</span>
								)}
								{first && (
									<span className="text-muted-foreground">
										{formatDate(first.departureDate, locale)}
									</span>
								)}
							</span>
						</Link>
					</li>
				);
			})}
		</ul>
	);
}
