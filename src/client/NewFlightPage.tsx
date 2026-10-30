import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { FlightForm } from "./components/FlightForm.tsx";
import { type ImportedPass, PassImport } from "./components/PassImport.tsx";
import { RequireSession } from "./components/RequireSession.tsx";
import { useText } from "./i18n/I18nProvider.tsx";
import { nextLegValues } from "./lib/journey.ts";
import { useJourney } from "./lib/queries.ts";

export function NewFlightPage() {
	const text = useText();
	const navigate = useNavigate();
	const { journey: journeyId } = useSearch({ from: "/flights/new" });
	const journey = useJourney(journeyId);
	// The next leg of a journey departs from its last destination.
	const next = journey.data && nextLegValues(journey.data);
	const waiting = journeyId !== undefined && journey.isPending;
	const [imported, setImported] = useState<{
		pass: ImportedPass;
		count: number;
	} | null>(null);

	return (
		<RequireSession>
			<main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
				<Link
					to="/"
					className="text-muted-foreground text-sm underline underline-offset-4"
				>
					{text.backToArchive}
				</Link>
				<h1 className="font-semibold text-2xl">{text.newFlightTitle}</h1>
				<PassImport
					onImported={(pass) =>
						setImported((current) => ({
							pass,
							count: (current?.count ?? 0) + 1,
						}))
					}
				/>
				{waiting ? (
					<p className="text-muted-foreground">{text.loading}</p>
				) : (
					<FlightForm
						// A new import starts a new form with the new values.
						key={imported?.count ?? 0}
						initialValues={{ ...next?.values, ...imported?.pass.values }}
						initialAirports={imported?.pass.airports ?? next?.airports}
						onSaved={(flight) =>
							navigate({
								to: "/journeys/$journeyId",
								params: { journeyId: flight.journeyId },
							})
						}
					/>
				)}
			</main>
		</RequireSession>
	);
}
