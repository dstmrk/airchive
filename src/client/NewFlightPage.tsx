import { Link, useNavigate } from "@tanstack/react-router";
import { FlightForm } from "./components/FlightForm.tsx";
import { RequireSession } from "./components/RequireSession.tsx";
import { useText } from "./i18n/I18nProvider.tsx";

export function NewFlightPage() {
	const text = useText();
	const navigate = useNavigate();

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
				<FlightForm onSaved={() => navigate({ to: "/" })} />
			</main>
		</RequireSession>
	);
}
