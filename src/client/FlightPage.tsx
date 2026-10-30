import { Link, useParams } from "@tanstack/react-router";
import { PaperPass } from "./components/PaperPass.tsx";
import { RequireSession } from "./components/RequireSession.tsx";
import { useText } from "./i18n/I18nProvider.tsx";
import { useFlight } from "./lib/queries.ts";

export function FlightPage() {
	return (
		<RequireSession>
			<FlightDetail />
		</RequireSession>
	);
}

/** The paper boarding pass of one flight, with the link to the form. */
function FlightDetail() {
	const text = useText();
	const { flightId } = useParams({ from: "/flights/$flightId" });
	const { data: flight, isPending, isError } = useFlight(flightId);

	return (
		<main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
			<div className="flex items-baseline justify-between gap-2">
				<Link
					to="/"
					className="text-muted-foreground text-sm underline underline-offset-4"
				>
					{text.backToArchive}
				</Link>
				{flight && (
					<Link
						to="/flights/$flightId/edit"
						params={{ flightId }}
						className="font-medium text-sm underline underline-offset-4"
					>
						{text.editFlight}
					</Link>
				)}
			</div>
			{isPending && <p className="text-muted-foreground">{text.loading}</p>}
			{isError && <p role="alert">{text.flightNotFound}</p>}
			{flight && (
				<PaperPass flight={flight} locale={document.documentElement.lang} />
			)}
		</main>
	);
}
