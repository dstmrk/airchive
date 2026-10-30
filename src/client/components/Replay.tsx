import { useEffect, useReducer, useRef, useState } from "react";
import type { Airport } from "../../shared/airport.ts";
import { useText } from "../i18n/I18nProvider.tsx";
import type { Messages } from "../i18n/messages.ts";
import type { FlightMoment } from "../lib/flight-profile.ts";
import {
	clockAt,
	durationText,
	type FlightTiming,
} from "../lib/flight-time.ts";
import { formatUnit } from "../lib/format.ts";
import {
	DEFAULT_SPEED,
	initialReplay,
	type ReplayState,
	replay,
	replayMs,
	SPEEDS,
	type SpeedId,
} from "../lib/replay.ts";

/** The time of the tear of the stub. It is also the duration of its CSS transition. */
export const TEAR_MS = 700;

const SPEED_TEXT: Record<SpeedId, keyof Messages> = {
	"15s": "speed15s",
	"30s": "speed30s",
	"1min": "speed1min",
	"5min": "speed5min",
	"4x": "speed4x",
	"1x": "speed1x",
};

/** A long replay is a multiple of the real time. On a telephone it is in the menu "⋯". */
const isLong = (id: SpeedId) =>
	SPEEDS.some((speed) => speed.id === id && "factor" in speed);

const reducedMotion = () =>
	globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/**
 * The state of the replay and its clock. `onBoarding` runs when the stub
 * tears, for example to show the map.
 */
export function useReplay(timing: FlightTiming, onBoarding: () => void) {
	const [state, dispatch] = useReducer(replay, initialReplay);
	const [speed, setSpeed] = useState<SpeedId>(DEFAULT_SPEED);
	const length = replayMs(speed, timing.durationMs);
	const boardingRef = useRef(onBoarding);
	boardingRef.current = onBoarding;

	useEffect(() => {
		if (state.phase !== "boarding") {
			return;
		}
		boardingRef.current();
		const timer = setTimeout(
			() => dispatch({ type: "boarded" }),
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
			dispatch({ type: "tick", ms: now - last, replayMs: length });
			last = now;
			frame = requestAnimationFrame(step);
		};
		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	}, [state.phase, length]);

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

	return { state, dispatch, speed, setSpeed };
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

const CHIP =
	"h-9 rounded-full px-2.5 font-medium font-mono text-[13px] aria-pressed:bg-foreground aria-pressed:text-background";

type ReplayControlsProps = Readonly<{
	state: ReplayState;
	dispatch: (event: Parameters<typeof replay>[1]) => void;
	speed: SpeedId;
	onSpeed: (id: SpeedId) => void;
	timing: FlightTiming;
	moment: FlightMoment;
	origin: Airport;
	destination: Airport;
}>;

/** The data of the flight, as on the screen of a cabin. */
function InflightPanel({
	moment,
	remainingMs,
	arrival,
	destination,
}: Readonly<{
	moment: FlightMoment;
	remainingMs: number;
	arrival: number | null;
	destination: Airport;
}>) {
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
				formatUnit(moment.remainingKm, "kilometer", locale),
			)}
			{item(
				text.inflightTime,
				durationText(remainingMs),
				arrival === null
					? undefined
					: `${text.inflightEta} ${clockAt(arrival, destination.tz)}`,
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

/** The controls under the map: play, the timeline, the clocks and the speeds. */
export function ReplayControls({
	state,
	dispatch,
	speed,
	onSpeed,
	timing,
	moment,
	origin,
	destination,
}: ReplayControlsProps) {
	const text = useText();
	const more = useRef<HTMLDetailsElement>(null);
	const playing = state.phase === "playing" || state.phase === "boarding";
	const elapsed = state.t * timing.durationMs;
	const now = timing.departure === null ? null : timing.departure + elapsed;
	const progress = `${durationText(elapsed)} / ${durationText(timing.durationMs)}`;

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
					className="h-11 min-w-0 flex-1 accent-pass-accent"
				/>
			</div>
			<InflightPanel
				moment={moment}
				remainingMs={timing.durationMs - elapsed}
				arrival={
					timing.departure === null
						? null
						: timing.departure + timing.durationMs
				}
				destination={destination}
			/>
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-mono text-[13px]">
				{now === null ? (
					<span>{progress}</span>
				) : (
					<span>
						{origin.iata} <b>{clockAt(now, origin.tz)}</b>
						{" · "}
						{destination.iata} <b>{clockAt(now, destination.tz)}</b>
					</span>
				)}
				<span className="font-sans text-muted-foreground text-xs">
					{timing.estimated &&
						`${text.replayEstimated} ${durationText(timing.durationMs)} · `}
					{text.inflightSimulated}
				</span>
			</div>
			<fieldset className="flex flex-wrap items-center gap-1">
				<legend className="sr-only">{text.replaySpeed}</legend>
				{SPEEDS.filter((s) => !isLong(s.id)).map((s) => chip(s.id))}
				{SPEEDS.filter((s) => isLong(s.id)).map((s) =>
					chip(
						s.id,
						"hidden @min-[640px]:inline-flex @min-[640px]:items-center",
					),
				)}
				<details ref={more} className="relative @min-[640px]:hidden">
					<summary
						aria-label={text.replayMoreSpeeds}
						className={`${CHIP} flex cursor-pointer list-none items-center ${
							isLong(speed) ? "bg-foreground text-background" : ""
						}`}
					>
						{isLong(speed) ? text[SPEED_TEXT[speed]] : "⋯"}
					</summary>
					<div className="absolute right-0 bottom-11 z-10 flex flex-col gap-1 rounded-lg bg-paper p-1.5 shadow-lg">
						{SPEEDS.filter((s) => isLong(s.id)).map((s) =>
							chip(s.id, "whitespace-nowrap"),
						)}
					</div>
				</details>
			</fieldset>
		</section>
	);
}
