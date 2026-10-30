import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useText } from "../i18n/I18nProvider.tsx";
import type { Messages } from "../i18n/messages.ts";
import { clockAt, durationText } from "../lib/flight-time.ts";
import { formatUnit } from "../lib/format.ts";
import {
	finalArrival,
	hasKnownStop,
	type JourneyMoment,
	journeyStretches,
	landingMarks,
	type StopMode,
	type Timeline,
} from "../lib/journey-replay.ts";
import {
	DEFAULT_SPEED,
	initialReplay,
	isLongSpeed,
	type ReplayState,
	replay,
	SPEEDS,
	type SpeedId,
} from "../lib/replay.ts";
import { reducedMotion, TEAR_MS } from "../lib/tear.ts";
import { withViewTransition } from "../lib/view-transition.ts";

const SPEED_TEXT: Record<SpeedId, keyof Messages> = {
	"15s": "speed15s",
	"30s": "speed30s",
	"1min": "speed1min",
	"5min": "speed5min",
	"4x": "speed4x",
	"1x": "speed1x",
};

/**
 * Animates the opening and the closing of the cabin. The element with the
 * `view-transition-name` moves from its place on the page to the full screen.
 */
export function cabinTransition(update: () => void) {
	const start = document.startViewTransition?.bind(document);
	// The browser takes the new image after the callback, thus React must render in it.
	// Without a transition, `flushSync` is not necessary, and an effect cannot call it.
	withViewTransition(update, {
		reduce: reducedMotion(),
		start: start && ((callback) => start(() => flushSync(callback))),
	});
}

/** The state of the replay and its clock. The cabin opens at the end of the tear. */
export function useReplay(timeline: Timeline) {
	const [state, dispatch] = useReducer(replay, initialReplay);
	const [speed, setSpeed] = useState<SpeedId>(DEFAULT_SPEED);
	// Real time holds the stops, as the journey did.
	const [stops, setStops] = useState<StopMode>("real");
	const stretches = useMemo(
		() => journeyStretches(timeline, speed, stops),
		[timeline, speed, stops],
	);

	useEffect(() => {
		if (state.phase !== "boarding") {
			return;
		}
		const timer = setTimeout(
			() => cabinTransition(() => dispatch({ type: "boarded" })),
			reducedMotion() ? 0 : TEAR_MS,
		);
		return () => clearTimeout(timer);
	}, [state.phase]);

	useEffect(() => {
		if (state.phase !== "playing") {
			return;
		}
		let frame = 0;
		let last = performance.now();
		const step = (now: number) => {
			dispatch({ type: "tick", ms: now - last, stretches });
			last = now;
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	}, [state.phase, stretches]);

	// In real time a flight lasts hours: the screen of a telephone must stay on.
	useEffect(() => {
		if (state.phase !== "playing" || speed !== "1x" || !navigator.wakeLock) {
			return;
		}
		let lock: WakeLockSentinel | null = null;
		let active = true;
		const request = () => {
			navigator.wakeLock
				.request("screen")
				.then((sentinel) => {
					if (active) {
						lock = sentinel;
					} else {
						void sentinel.release();
					}
				})
				// The browser can refuse, for example with a low battery: the replay continues.
				.catch(() => undefined);
		};
		// The browser releases the lock when the page is hidden.
		const onVisible = () => {
			if (document.visibilityState === "visible") {
				request();
			}
		};
		request();
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			active = false;
			document.removeEventListener("visibilitychange", onVisible);
			void lock?.release();
		};
	}, [state.phase, speed]);

	return { state, dispatch, speed, setSpeed, stops, setStops };
}

function PlayIcon({ playing }: Readonly<{ playing: boolean }>) {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
			{playing ? (
				<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" fill="currentColor" />
			) : (
				<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
			)}
		</svg>
	);
}

const STOP_MODES: { mode: StopMode; label: keyof Messages }[] = [
	{ mode: "real", label: "replayStopsReal" },
	{ mode: "skip", label: "replayStopsSkip" },
];

const CHIP =
	"h-9 rounded-full px-2.5 font-medium font-mono text-[13px] aria-pressed:bg-foreground aria-pressed:text-background";

type ReplayControlsProps = Readonly<{
	state: ReplayState;
	dispatch: (event: Parameters<typeof replay>[1]) => void;
	speed: SpeedId;
	onSpeed: (id: SpeedId) => void;
	stops: StopMode;
	onStops: (mode: StopMode) => void;
	timeline: Timeline;
	view: JourneyMoment;
}>;

/** The data of the flight, as on the screen of a cabin. */
function InflightPanel({
	view,
	remainingMs,
	arrival,
	zone,
}: Readonly<{
	view: JourneyMoment;
	remainingMs: number;
	arrival: number | null;
	/** The time zone of the final destination. */
	zone: string;
}>) {
	const { moment } = view;
	const text = useText();
	const locale = document.documentElement.lang;
	const item = (label: string, value: string, detail?: string) => (
		<div className="flex flex-col">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="font-medium font-mono text-[15px]">
				{value}
				{detail && (
					<span className="ml-1.5 font-normal text-muted-foreground text-xs">
						{detail}
					</span>
				)}
			</dd>
		</div>
	);
	return (
		<dl
			aria-label={text.inflightLabel}
			className="grid @min-[640px]:grid-cols-4 grid-cols-2 gap-x-4 gap-y-2"
		>
			{item(
				text.inflightDistance,
				formatUnit(view.remainingKm, "kilometer", locale),
			)}
			{item(
				text.inflightTime,
				durationText(remainingMs),
				arrival === null
					? undefined
					: `${text.inflightEta} ${clockAt(arrival, zone)}`,
			)}
			{item(
				text.inflightSpeed,
				formatUnit(moment.speedKmh, "kilometer-per-hour", locale),
			)}
			{item(
				text.inflightAltitude,
				formatUnit(moment.altitudeM, "meter", locale),
			)}
		</dl>
	);
}

/** The local times of the airports of the leg, or of the airport of the stop. */
function Clocks({
	timeline,
	view,
}: Readonly<{ timeline: Timeline; view: JourneyMoment }>) {
	const leg = timeline.legs[view.leg];
	const now = view.instant;
	if (leg === undefined || now === null) {
		return null;
	}
	const clock = (iata: string, zone: string) => (
		<>
			{iata} <b>{clockAt(now, zone)}</b>
		</>
	);
	return (
		<span>
			{view.stop ? (
				clock(leg.destination.iata, leg.destination.tz)
			) : (
				<>
					{clock(leg.origin.iata, leg.origin.tz)}
					{" · "}
					{clock(leg.destination.iata, leg.destination.tz)}
				</>
			)}
		</span>
	);
}

/** The controls under the map: play, the timeline, the clocks and the speeds. */
export function ReplayControls({
	state,
	dispatch,
	speed,
	onSpeed,
	stops,
	onStops,
	timeline,
	view,
}: ReplayControlsProps) {
	const text = useText();
	const more = useRef<HTMLDetailsElement>(null);
	const playing = state.phase === "playing" || state.phase === "boarding";
	const total = timeline.totalMs;
	const progress = `${durationText(view.elapsedMs)} / ${durationText(total)}`;
	const estimated = timeline.legs.some((leg) => leg.timing.estimated);
	const destination = timeline.legs.at(-1)?.destination;

	const chip = (id: SpeedId, className = "") => (
		<button
			key={id}
			type="button"
			aria-pressed={speed === id}
			onClick={() => {
				onSpeed(id);
				if (more.current) {
					more.current.open = false;
				}
			}}
			className={`${CHIP} ${className}`}
		>
			{text[SPEED_TEXT[id]]}
		</button>
	);

	return (
		<section
			aria-label={text.replayLabel}
			className="@container flex flex-col gap-3 rounded-[14px] bg-paper px-4 py-3 shadow-[0_1px_0_#d8cfbd]"
		>
			<div className="flex items-center gap-3">
				<button
					type="button"
					aria-label={
						playing
							? text.replayPause
							: state.phase === "landed"
								? text.replayAgain
								: text.replayPlay
					}
					onClick={() => dispatch({ type: playing ? "pause" : "play" })}
					className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pass-accent text-paper"
				>
					<PlayIcon playing={playing} />
				</button>
				<div className="relative min-w-0 flex-1">
					<input
						type="range"
						min={0}
						max={1000}
						value={Math.round(state.t * 1000)}
						aria-label={text.replayTimeline}
						aria-valuetext={progress}
						onChange={(event) =>
							dispatch({ type: "seek", t: Number(event.target.value) / 1000 })
						}
						className="h-11 w-full accent-pass-accent"
					/>
					{/* A mark for each landing before the final destination. The thumb is approximately 16 px wide. */}
					{landingMarks(timeline).map((mark) => (
						<span
							key={mark}
							aria-hidden="true"
							style={{ left: `calc(8px + (100% - 16px) * ${mark})` }}
							className="-translate-x-1/2 pointer-events-none absolute bottom-1 h-1.5 w-0.5 rounded-full bg-pass-accent"
						/>
					))}
				</div>
			</div>
			<InflightPanel
				view={view}
				remainingMs={total - view.elapsedMs}
				arrival={finalArrival(timeline)}
				zone={destination?.tz ?? "UTC"}
			/>
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[13px]">
				{view.instant === null ? (
					<span>{progress}</span>
				) : (
					<Clocks timeline={timeline} view={view} />
				)}
				<span className="font-sans text-muted-foreground text-xs">
					{estimated && `${text.replayEstimated} ${durationText(total)} · `}
					{text.inflightSimulated}
				</span>
			</div>
			<fieldset className="flex flex-wrap items-center gap-1">
				<legend className="sr-only">{text.replaySpeed}</legend>
				{/* A long replay is a multiple of the real time. On a telephone it is in the menu "⋯". */}
				{SPEEDS.filter((s) => !isLongSpeed(s.id)).map((s) => chip(s.id))}
				{SPEEDS.filter((s) => isLongSpeed(s.id)).map((s) =>
					chip(
						s.id,
						"hidden @min-[640px]:inline-flex @min-[640px]:items-center",
					),
				)}
				<details ref={more} className="relative @min-[640px]:hidden">
					<summary
						aria-label={text.replayMoreSpeeds}
						className={`${CHIP} flex cursor-pointer list-none items-center ${
							isLongSpeed(speed) ? "bg-foreground text-background" : ""
						}`}
					>
						{isLongSpeed(speed) ? text[SPEED_TEXT[speed]] : "⋯"}
					</summary>
					<div className="absolute right-0 bottom-11 z-10 flex flex-col gap-1 rounded-lg bg-paper p-1.5 shadow-lg">
						{SPEEDS.filter((s) => isLongSpeed(s.id)).map((s) =>
							chip(s.id, "whitespace-nowrap"),
						)}
					</div>
				</details>
			</fieldset>
			{/* A short replay always waits a moment at a stop: the choice is only for a long replay. */}
			{isLongSpeed(speed) && hasKnownStop(timeline) && (
				<fieldset className="flex flex-wrap items-center gap-1">
					<legend className="float-left mr-2 text-muted-foreground text-xs">
						{text.replayStops}
					</legend>
					{STOP_MODES.map(({ mode, label }) => (
						<button
							key={mode}
							type="button"
							aria-pressed={stops === mode}
							onClick={() => onStops(mode)}
							className={`${CHIP} font-sans`}
						>
							{text[label]}
						</button>
					))}
				</fieldset>
			)}
		</section>
	);
}
