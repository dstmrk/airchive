import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { FlightForm } from "./components/FlightForm.tsx";
import { RequireSession } from "./components/RequireSession.tsx";
import { useText } from "./i18n/I18nProvider.tsx";
import { useDeleteFlight, useFlight } from "./lib/queries.ts";

export function FlightEditPage() {
	return (
		<RequireSession>
			<FlightEditor />
		</RequireSession>
	);
}

function FlightEditor() {
	const text = useText();
	const navigate = useNavigate();
	const { flightId } = useParams({ from: "/flights/$flightId/edit" });
	const { data: flight, isPending, isError } = useFlight(flightId);
	const remove = useDeleteFlight(flightId);

	function onDelete() {
		if (window.confirm(text.deleteConfirm)) {
			remove.mutate(undefined, { onSuccess: () => navigate({ to: "/" }) });
		}
	}

	return (
		<main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-8">
			<Link
				to="/"
				className="text-muted-foreground text-sm underline underline-offset-4"
			>
				{text.backToArchive}
			</Link>
			{isPending && <p className="text-muted-foreground">{text.loading}</p>}
			{isError && <p role="alert">{text.flightNotFound}</p>}
			{flight && (
				<>
					<h1 className="font-semibold text-2xl">{text.editFlightTitle}</h1>
					<FlightForm
						flight={flight}
						onSaved={() =>
							navigate({ to: "/flights/$flightId", params: { flightId } })
						}
					/>
					<button
						type="button"
						onClick={onDelete}
						disabled={remove.isPending}
						className="h-11 rounded-md border border-red-700 px-4 font-medium text-red-700 disabled:opacity-50"
					>
						{text.deleteFlight}
					</button>
					{remove.isError && (
						<p className="text-red-700 text-sm" role="alert">
							{text.deleteFailed}
						</p>
					)}
				</>
			)}
		</main>
	);
}
