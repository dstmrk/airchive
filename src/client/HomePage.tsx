import { Link } from "@tanstack/react-router";
import { Wordmark } from "./brand/Mark.tsx";
import { useText } from "./i18n/I18nProvider.tsx";
import { authClient } from "./lib/auth-client.ts";
import { formatDate } from "./lib/format.ts";
import { useFlights } from "./lib/queries.ts";

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

function Archive() {
	const text = useText();
	const { data: flights, isPending, isError } = useFlights(true);

	if (isPending) {
		return <p className="text-muted-foreground">{text.loading}</p>;
	}
	if (isError) {
		return <p role="alert">{text.archiveLoadFailed}</p>;
	}
	if (flights.length === 0) {
		return <p className="text-muted-foreground">{text.archiveEmpty}</p>;
	}
	return (
		<ul className="flex flex-col divide-y divide-foreground/10">
			{flights.map((flight) => (
				<li key={flight.id}>
					<Link
						to="/flights/$flightId"
						params={{ flightId: flight.id }}
						className="flex items-center justify-between gap-3 py-3"
					>
						<span className="flex flex-col">
							<span className="font-mono font-semibold text-lg">
								{flight.origin} → {flight.destination}
							</span>
							<span className="text-muted-foreground text-sm">
								{flight.originAirport?.city} – {flight.destinationAirport?.city}
							</span>
						</span>
						<span className="flex flex-col items-end text-sm">
							<span className="font-mono">
								{flight.airlineCode} {flight.flightNumber}
							</span>
							<span className="text-muted-foreground">
								{formatDate(
									flight.departureDate,
									document.documentElement.lang,
								)}
							</span>
						</span>
					</Link>
				</li>
			))}
		</ul>
	);
}
