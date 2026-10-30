import {
	Link,
	useNavigate,
	useParams,
	useRouter,
	useSearch,
} from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef } from "react";
import type { Airport } from "../shared/airport.ts";
import type { FlightView } from "../shared/flight.ts";
import { PaperPass } from "./components/PaperPass.tsx";
import {
	cabinTransition,
	ReplayControls,
	useReplay,
} from "./components/Replay.tsx";
import { RequireSession } from "./components/RequireSession.tsx";
import { useText } from "./i18n/I18nProvider.tsx";
import { syncCabin } from "./lib/cabin.ts";
import { flightProfile, momentAt } from "./lib/flight-profile.ts";
import { flightTiming } from "./lib/flight-time.ts";
import { distanceKm } from "./lib/great-circle.ts";
import { useFlight } from "./lib/queries.ts";
import { inCabin, isTorn } from "./lib/replay.ts";

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
		<main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 has-[>[data-cabin]]:*:not-data-cabin:invisible">
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

function CloseIcon() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
			<path
				d="M6 6l12 12M18 6L6 18"
				fill="none"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
			/>
		</svg>
	);
}

/**
 * The pass, the map and the replay. The stub of the pass starts the replay.
 * At the end of the tear, the map and the controls fill the screen: the cabin.
 * The button "close", the key Escape and the button "back" of the browser
 * close the cabin and give the pass again.
 */
function FlightReplay({
	flight,
	origin,
	destination,
}: Readonly<{ flight: FlightView; origin: Airport; destination: Airport }>) {
	const text = useText();
	const router = useRouter();
	const navigate = useNavigate({ from: "/flights/$flightId" });
	const { replay: inUrl = false } = useSearch({ from: "/flights/$flightId" });
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
	const { state, dispatch, speed, setSpeed } = useReplay(timing);
	const started = state.phase !== "idle";
	const cabin = inCabin(state);
	const moment = momentAt(profile, state.t);
	const wasInUrl = useRef(inUrl);

	useEffect(() => {
		const action = syncCabin({
			open: cabin,
			inUrl,
			wasInUrl: wasInUrl.current,
		});
		wasInUrl.current = inUrl;
		if (action === "push") {
			void navigate({ search: { replay: true }, resetScroll: false });
		} else if (action === "strip") {
			void navigate({ search: {}, replace: true, resetScroll: false });
		} else if (action === "stop") {
			cabinTransition(() => dispatch({ type: "stop" }));
		}
	}, [cabin, inUrl, navigate, dispatch]);

	// The entry of the history closes the cabin, thus "back" and the button agree.
	const close = useCallback(() => {
		if (inUrl) {
			router.history.back();
		} else {
			cabinTransition(() => dispatch({ type: "stop" }));
		}
	}, [inUrl, router, dispatch]);

	useEffect(() => {
		if (!cabin) {
			return;
		}
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				close();
			}
		};
		// The page under the cabin does not scroll.
		const root = document.documentElement;
		root.style.overflow = "hidden";
		document.addEventListener("keydown", onKey);
		return () => {
			root.style.overflow = "";
			document.removeEventListener("keydown", onKey);
		};
	}, [cabin, close]);

	return (
		<>
			<PaperPass
				flight={flight}
				locale={document.documentElement.lang}
				torn={isTorn(state)}
				onRelive={() => dispatch({ type: "play" })}
			/>
			{/* One element in the two places: React keeps the map, and the view transition moves it.
			    Under the cabin, the rest of the page is invisible, thus the focus cannot go there. */}
			<div
				data-cabin={cabin || undefined}
				style={{ viewTransitionName: "replay-cabin" }}
				className={
					cabin
						? "fixed inset-0 z-50 flex flex-col gap-2 bg-background pt-[env(safe-area-inset-top)] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
						: "flex flex-col"
				}
			>
				{cabin && (
					<div className="flex items-center justify-between gap-2 pl-4">
						<span className="font-bold font-mono text-[15px]">
							{origin.iata} → {destination.iata}
						</span>
						<button
							type="button"
							aria-label={text.replayClose}
							onClick={close}
							// biome-ignore lint/a11y/noAutofocus: the cabin covers the page, thus the focus goes into it.
							autoFocus
							className="grid size-11 place-items-center rounded-full"
						>
							<CloseIcon />
						</button>
					</div>
				)}
				<Suspense
					fallback={
						<div
							className={
								cabin
									? "flex-1 bg-map-land"
									: "h-72 rounded-[14px] bg-map-land md:h-96"
							}
						/>
					}
				>
					<FlightMap
						origin={origin}
						destination={destination}
						progress={started ? moment.fraction : null}
						cabin={cabin}
					/>
				</Suspense>
				{cabin && (
					<div className="px-2">
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
					</div>
				)}
			</div>
		</>
	);
}
