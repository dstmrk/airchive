import { Link, useParams } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useRef } from "react";
import type { Airport } from "../shared/airport.ts";
import type { FlightView } from "../shared/flight.ts";
import { PaperPass } from "./components/PaperPass.tsx";
import { ReplayControls, useReplay } from "./components/Replay.tsx";
import { RequireSession } from "./components/RequireSession.tsx";
import { useText } from "./i18n/I18nProvider.tsx";
import { flightProfile, momentAt } from "./lib/flight-profile.ts";
import { flightTiming } from "./lib/flight-time.ts";
import { distanceKm } from "./lib/great-circle.ts";
import { useFlight } from "./lib/queries.ts";
import { isTorn } from "./lib/replay.ts";

/** MapLibre is large: only the page of a flight loads it. */
const FlightMap = lazy(() => import("./components/FlightMap.tsx"));

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
			{flight &&
				(flight.originAirport && flight.destinationAirport ? (
					<FlightReplay
						flight={flight}
						origin={flight.originAirport}
						destination={flight.destinationAirport}
					/>
				) : (
					<PaperPass flight={flight} locale={document.documentElement.lang} />
				))}
		</main>
	);
}

/** The pass, the map and the replay. The stub of the pass starts the replay. */
function FlightReplay({
	flight,
	origin,
	destination,
}: Readonly<{ flight: FlightView; origin: Airport; destination: Airport }>) {
	const mapRef = useRef<HTMLDivElement>(null);
	const timing = useMemo(
		() =>
			flightTiming({
				...flight,
				originAirport: origin,
				destinationAirport: destination,
			}),
		[flight, origin, destination],
	);
	const profile = useMemo(
		() =>
			flightProfile(
				distanceKm(
					[origin.lon, origin.lat],
					[destination.lon, destination.lat],
				),
				timing.durationMs,
			),
		[origin, destination, timing],
	);
	const { state, dispatch, speed, setSpeed } = useReplay(timing, () =>
		mapRef.current?.scrollIntoView({
			behavior: globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")
				.matches
				? "auto"
				: "smooth",
			block: "center",
		}),
	);
	const started = state.phase !== "idle";
	const moment = momentAt(profile, state.t);

	return (
		<>
			<PaperPass
				flight={flight}
				locale={document.documentElement.lang}
				torn={isTorn(state)}
				onRelive={() => dispatch({ type: "play" })}
			/>
			<div ref={mapRef} className="flex scroll-mt-4 flex-col gap-3">
				<Suspense
					fallback={<div className="h-72 rounded-[14px] bg-map-land md:h-96" />}
				>
					<FlightMap
						origin={origin}
						destination={destination}
						progress={started ? moment.fraction : null}
					/>
				</Suspense>
				{started && (
					<ReplayControls
						state={state}
						dispatch={dispatch}
						speed={speed}
						onSpeed={setSpeed}
						timing={timing}
						moment={moment}
						origin={origin}
						destination={destination}
					/>
				)}
			</div>
		</>
	);
}
