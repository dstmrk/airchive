import {
	Link,
	useNavigate,
	useParams,
	useRouter,
	useSearch,
} from "@tanstack/react-router";
import {
	lazy,
	Suspense,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type { FlightView } from "../shared/flight.ts";
import type { JourneyView } from "../shared/journey.ts";
import { PaperPass } from "./components/PaperPass.tsx";
import {
	cabinTransition,
	ReplayControls,
	useReplay,
} from "./components/Replay.tsx";
import { RequireSession } from "./components/RequireSession.tsx";
import { useText } from "./i18n/I18nProvider.tsx";
import { syncCabin } from "./lib/cabin.ts";
import { journeyChains, journeyTitle } from "./lib/journey.ts";
import {
	type JourneyLeg,
	journeyLegs,
	journeyMomentAt,
	journeyTimeline,
} from "./lib/journey-replay.ts";
import { useJourney, useRenameJourney } from "./lib/queries.ts";
import { inCabin, isTorn } from "./lib/replay.ts";
import { replayMinute } from "./lib/terminator.ts";

/** MapLibre is large: only the page of a journey loads it. */
const FlightMap = lazy(() => import("./components/FlightMap.tsx"));

export function JourneyPage() {
	return (
		<RequireSession>
			<JourneyDetail />
		</RequireSession>
	);
}

/**
 * The paper boarding passes of one journey, in the order of the legs, with
 * the title and a link to the form of each flight.
 */
function JourneyDetail() {
	const text = useText();
	const { journeyId } = useParams({ from: "/journeys/$journeyId" });
	const { data: journey, isPending, isError } = useJourney(journeyId);
	// A new array at each render would restart the clock of the replay.
	const legs = useMemo(
		() => journey && journeyLegs(journey.flights),
		[journey],
	);

	return (
		<main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 has-[>[data-cabin]]:*:not-data-cabin:invisible">
			<Link
				to="/"
				className="text-muted-foreground text-sm underline underline-offset-4"
			>
				{text.backToArchive}
			</Link>
			{isPending && <p className="text-muted-foreground">{text.loading}</p>}
			{isError && <p role="alert">{text.journeyNotFound}</p>}
			{journey && <JourneyTitle journey={journey} />}
			{journey &&
				(legs ? (
					<JourneyReplay flights={journey.flights} legs={legs} />
				) : (
					journey.flights.map((flight) => (
						<Pass key={flight.id} flight={flight} />
					))
				))}
		</main>
	);
}

/** The pass of one leg, with the link to its form. */
function Pass({
	flight,
	torn,
	onRelive,
}: Readonly<{ flight: FlightView; torn?: boolean; onRelive?: () => void }>) {
	const text = useText();
	return (
		<section className="flex flex-col gap-2">
			<Link
				to="/flights/$flightId/edit"
				params={{ flightId: flight.id }}
				className="self-end font-medium text-sm underline underline-offset-4"
			>
				{text.editFlight}
			</Link>
			<PaperPass
				flight={flight}
				locale={document.documentElement.lang}
				torn={torn}
				onRelive={onRelive}
			/>
		</section>
	);
}

/** The title of the journey, and a form that changes it. */
function JourneyTitle({ journey }: Readonly<{ journey: JourneyView }>) {
	const text = useText();
	const rename = useRenameJourney(journey.id);
	const [draft, setDraft] = useState<string | null>(null);

	if (draft === null) {
		return (
			<div className="flex items-baseline justify-between gap-3">
				<h1 className="font-semibold text-2xl tracking-tight">
					{journeyTitle(journey, text.journeyDefaultTitle)}
				</h1>
				<button
					type="button"
					onClick={() => setDraft(journey.title ?? "")}
					className="shrink-0 font-medium text-sm underline underline-offset-4"
				>
					{text.journeyRename}
				</button>
			</div>
		);
	}
	return (
		<form
			className="flex flex-col gap-2"
			onSubmit={(event) => {
				event.preventDefault();
				rename.mutate(draft, { onSuccess: () => setDraft(null) });
			}}
		>
			<label htmlFor="journey-title" className="font-medium text-sm">
				{text.journeyTitleLabel}
			</label>
			<input
				id="journey-title"
				value={draft}
				maxLength={80}
				placeholder={journeyTitle(
					{ ...journey, title: null },
					text.journeyDefaultTitle,
				)}
				aria-describedby="journey-title-hint"
				onChange={(event) => setDraft(event.target.value)}
				// biome-ignore lint/a11y/noAutofocus: the person asked for the field with the button "rename".
				autoFocus
				className="h-11 w-full rounded-md border border-foreground/20 bg-white px-3 text-base"
			/>
			<p id="journey-title-hint" className="text-muted-foreground text-sm">
				{text.journeyTitleHint}
			</p>
			<div className="flex gap-2">
				<button
					type="submit"
					disabled={rename.isPending}
					className="h-11 rounded-md bg-foreground px-4 font-medium text-background disabled:opacity-50"
				>
					{text.journeySaveTitle}
				</button>
				<button
					type="button"
					onClick={() => setDraft(null)}
					className="h-11 rounded-md border border-foreground/20 px-4 font-medium"
				>
					{text.journeyCancel}
				</button>
			</div>
			{rename.isError && (
				<p className="text-red-700 text-sm" role="alert">
					{text.journeyRenameFailed}
				</p>
			)}
		</form>
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
 * The passes, the map and the replay of each leg. The stub of the first pass
 * starts the replay. At the end of the tear, the map and the controls fill the
 * screen: the cabin. The button "close", the key Escape and the button "back"
 * of the browser close the cabin and give the passes again.
 */
function JourneyReplay({
	flights,
	legs,
}: Readonly<{ flights: FlightView[]; legs: JourneyLeg[] }>) {
	const text = useText();
	const router = useRouter();
	const navigate = useNavigate({ from: "/journeys/$journeyId" });
	const { replay: inUrl = false } = useSearch({ from: "/journeys/$journeyId" });
	const timeline = useMemo(() => journeyTimeline(legs), [legs]);
	const { state, dispatch, speed, setSpeed, stops, setStops } =
		useReplay(timeline);
	const started = state.phase !== "idle";
	const cabin = inCabin(state);
	const view = journeyMomentAt(timeline, state.t);
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
			{flights.map((flight, index) => (
				<Pass
					key={flight.id}
					flight={flight}
					torn={index === 0 && isTorn(state)}
					onRelive={index === 0 ? () => dispatch({ type: "play" }) : undefined}
				/>
			))}
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
							{journeyChains(flights)
								.map((chain) => chain.join(" → "))
								.join(" · ")}
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
						timeline={timeline}
						view={started ? view : null}
						instant={started ? replayMinute(view.instant) : null}
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
							stops={stops}
							onStops={setStops}
							timeline={timeline}
							view={view}
						/>
					</div>
				)}
			</div>
		</>
	);
}
