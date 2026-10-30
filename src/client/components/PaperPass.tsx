import {
	type CSSProperties,
	type PointerEvent,
	type ReactNode,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { CabinClass, FlightView } from "../../shared/flight.ts";
import { useText } from "../i18n/I18nProvider.tsx";
import type { Messages } from "../i18n/messages.ts";
import { airlineLogo } from "../lib/airline-logo.ts";
import { passView } from "../lib/pass.ts";
import {
	DRAG_SLOP,
	fallDuration,
	type Pose,
	PULL_LIMIT,
	poseTransform,
	pullDistance,
	pullPose,
	reducedMotion,
	returnKeyframes,
	stubKeyframes,
	type TearAxis,
	tearOrigin,
	tornEdge,
} from "../lib/tear.ts";

const CABIN_TEXT: Record<CabinClass, keyof Messages> = {
	economy: "cabinEconomy",
	premium_economy: "cabinPremiumEconomy",
	business: "cabinBusiness",
	first: "cabinFirst",
};

function Field({
	label,
	children,
	mono = false,
}: Readonly<{ label: string; children: ReactNode; mono?: boolean }>) {
	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			<span className="font-semibold text-[10px] text-paper-label uppercase tracking-[0.14em]">
				{label}
			</span>
			<span
				className={
					mono
						? "truncate font-mono text-[15px]"
						: "truncate font-medium text-sm"
				}
			>
				{children}
			</span>
		</div>
	);
}

function Arrow({ className }: Readonly<{ className: string }>) {
	return (
		<svg viewBox="0 0 56 24" aria-hidden="true" className={className}>
			<path
				d="M2 12h48M42 5l8 7-8 7"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

function PullIcon() {
	return (
		<svg
			viewBox="0 0 16 16"
			aria-hidden="true"
			className="size-4 motion-safe:animate-nudge"
		>
			<path
				d="M4 4l4 4 4-4M4 9l4 4 4-4"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.8"
				strokeLinecap="round"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/** The edges of the tear, as CSS variables: the classes select the edge of the layout. */
const TORN_EDGES = {
	"--torn-body-y": tornEdge("body", "below"),
	"--torn-body-x": tornEdge("body", "right"),
	"--torn-stub-y": tornEdge("stub", "below"),
	"--torn-stub-x": tornEdge("stub", "right"),
} as CSSProperties;

/** The container query puts the stub on the right from 640 px: the direction of the flex row tells it. */
const axisOf = (article: HTMLElement | null): TearAxis =>
	article && getComputedStyle(article).flexDirection === "row"
		? "right"
		: "below";

type Pull = {
	id: number;
	x: number;
	y: number;
	axis: TearAxis;
	pose: Pose;
	moved: boolean;
};

/**
 * The paper boarding pass of one flight. Paragraph 5.4 of
 * `docs/architecture.md` gives the design: Barlow for the labels and the
 * text, JetBrains Mono for the codes.
 *
 * The layout follows the width of the container, not of the screen: under
 * 640 px the stub goes below the body, with a horizontal perforation; from
 * 640 px the stub is on the right, as on a printed pass.
 */
export function PaperPass({
	flight,
	locale,
	torn = false,
	onRelive,
}: Readonly<{
	flight: FlightView;
	locale: string;
	/** The stub is off the pass during the replay. */
	torn?: boolean;
	/** The button on the stub starts the replay. With no function, the stub has no button. */
	onRelive?: () => void;
}>) {
	const text = useText();
	const pass = passView(flight, locale);
	const logo = airlineLogo(flight.airlineCode, flight.departureDate);
	const none = text.passNoValue;
	const arrives = pass.arrivalTime
		? `${pass.arrivalTime}${pass.arrivalOffset ? ` ${pass.arrivalOffset}` : ""}`
		: none;
	const article = useRef<HTMLElement>(null);
	const stub = useRef<HTMLDivElement>(null);
	const pull = useRef<Pull | null>(null);
	// A pull gives the tear: the stub only falls. The button gives the full tear.
	const tornBy = useRef<"pass" | "tear">("pass");
	// The browser sends a click after a pull. That click does not start the replay.
	const afterPull = useRef(false);
	const [pulling, setPulling] = useState(false);
	const open = torn || pulling;

	// A layout effect: the animation starts before the browser paints the stub hidden.
	useLayoutEffect(() => {
		const element = stub.current;
		const start = tornBy.current;
		tornBy.current = "pass";
		afterPull.current = false;
		if (!torn || !element || reducedMotion()) {
			return;
		}
		element.style.transform = "";
		element.style.transformOrigin = "";
		const animation = element.animate(
			stubKeyframes(axisOf(article.current), start),
			{ duration: fallDuration(start) },
		);
		return () => animation.cancel();
	}, [torn]);

	const onPullStart = (event: PointerEvent<HTMLButtonElement>) => {
		afterPull.current = false;
		if (torn || !onRelive || event.button !== 0 || reducedMotion()) {
			return;
		}
		event.currentTarget.setPointerCapture(event.pointerId);
		pull.current = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			axis: axisOf(article.current),
			pose: pullPose("below", 0),
			moved: false,
		};
	};

	const onPullMove = (event: PointerEvent<HTMLButtonElement>) => {
		const current = pull.current;
		const element = stub.current;
		if (!current || current.id !== event.pointerId || !element) {
			return;
		}
		const distance = pullDistance(
			current.axis,
			event.clientX - current.x,
			event.clientY - current.y,
		);
		if (!current.moved) {
			if (distance < DRAG_SLOP) {
				return;
			}
			current.moved = true;
			setPulling(true);
		}
		current.pose = pullPose(current.axis, distance);
		element.style.transformOrigin = tearOrigin(current.axis);
		element.style.transform = poseTransform(current.pose);
		if (distance >= PULL_LIMIT) {
			pull.current = null;
			tornBy.current = "tear";
			setPulling(false);
			onRelive?.();
		}
	};

	const onPullEnd = (event: PointerEvent<HTMLButtonElement>) => {
		const current = pull.current;
		const element = stub.current;
		if (!current || current.id !== event.pointerId) {
			return;
		}
		pull.current = null;
		if (!current.moved || !element) {
			return;
		}
		// The pull stopped before the limit: the stub goes back to the pass.
		afterPull.current = true;
		element.style.transform = "";
		element.style.transformOrigin = "";
		element.animate(returnKeyframes(current.axis, current.pose), {
			duration: 260,
			easing: "cubic-bezier(0.3, 1.5, 0.6, 1)",
		});
		setPulling(false);
	};

	return (
		// Over the map: the stub falls on it.
		<div className="@container relative z-10">
			<article
				ref={article}
				aria-label={text.passTitle}
				// The colour of the airline replaces the default accent of the theme.
				style={
					pass.accent
						? ({
								...TORN_EDGES,
								"--color-pass-accent": pass.accent,
							} as CSSProperties)
						: TORN_EDGES
				}
				className="pass-shadow flex flex-col text-foreground @min-[640px]:flex-row"
			>
				{/* The body and the stub each have their paper: when the stub tears, the background shows. */}
				{/* The notches of the perforation stay on the body after the tear: at the bottom on a telephone, on the right from 640 px. */}
				{/* The stub covers 3 px of the body (TEAR_DEPTH). The line of the tear is in that strip, thus the two edges fit. */}
				<div
					className={`notched flex min-w-0 flex-1 flex-col rounded-t-[14px] bg-paper [--notch-a:0_100%] [--notch-b:100%_100%] @min-[640px]:rounded-l-[14px] @min-[640px]:rounded-tr-none @min-[640px]:[--notch-a:100%_0] ${
						open
							? "[clip-path:var(--torn-body-y)] @min-[640px]:[clip-path:var(--torn-body-x)]"
							: ""
					}`}
				>
					<div className="h-2.5 rounded-t-[14px] bg-pass-accent @min-[640px]:rounded-tr-none" />
					<div className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-5 @min-[640px]:px-6">
						<div className="flex min-h-7 items-center justify-between gap-2">
							<span className="flex items-center gap-2.5">
								{/* One colour: the logo takes the accent of the pass, as the codes. */}
								{logo && (
									<svg
										viewBox={logo.viewBox}
										role="img"
										aria-label={logo.title}
										className="h-7 w-auto max-w-24 shrink-0 fill-pass-accent"
									>
										<path d={logo.path} />
									</svg>
								)}
								<span className="font-semibold text-paper-label text-xs uppercase tracking-[0.18em]">
									{text.passTitle}
								</span>
							</span>
							<span className="font-bold font-mono text-[15px] text-pass-accent">
								{pass.designator}
							</span>
						</div>
						{/* The codes share a row, thus the arrow is at the centre of the codes and not of the cities. */}
						<div className="grid grid-cols-[minmax(0,auto)_auto_minmax(0,auto)] items-center justify-start gap-x-3 gap-y-1 @min-[640px]:gap-x-5">
							<span className="col-start-1 row-start-1 font-bold font-mono text-[40px] leading-none @min-[640px]:text-5xl">
								{pass.origin.code}
							</span>
							<span className="col-start-1 row-start-2 truncate text-paper-label text-sm">
								{pass.origin.city}
							</span>
							<Arrow className="col-start-2 row-start-1 h-6 w-12 @min-[640px]:w-14" />
							<span className="sr-only">{text.passTo}</span>
							<span className="col-start-3 row-start-1 font-bold font-mono text-[40px] leading-none @min-[640px]:text-5xl">
								{pass.destination.code}
							</span>
							<span className="col-start-3 row-start-2 truncate text-paper-label text-sm">
								{pass.destination.city}
							</span>
						</div>
						<div className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2.5 @min-[640px]:grid-cols-4">
							<Field label={text.passPassenger}>
								<span className="font-semibold">
									{pass.passengerName ?? none}
								</span>
							</Field>
							<Field label={text.passDate} mono>
								{pass.date}
							</Field>
							<Field label={text.passDeparts} mono>
								{pass.departureTime ?? none}
							</Field>
							<Field label={text.passArrives} mono>
								{arrives}
							</Field>
							<Field label={text.passAirline}>{pass.airlineName ?? none}</Field>
							<Field label={text.passClass}>
								{pass.cabinClass ? text[CABIN_TEXT[pass.cabinClass]] : none}
							</Field>
							<Field label={text.passSeat} mono>
								<span className="font-bold">{pass.seat ?? none}</span>
							</Field>
							<Field label={text.passBooking} mono>
								{pass.bookingReference ?? none}
							</Field>
						</div>
					</div>
				</div>
				{/* The stub turns about one end of the perforation, then it falls. `lib/tear.ts` gives the motion. */}
				<div
					ref={stub}
					inert={torn}
					className={`notched relative -mt-[3px] flex flex-col rounded-b-[14px] border-perforation border-t-2 border-dashed bg-paper will-change-transform [--notch-a:0_3px] [--notch-b:100%_3px] @min-[640px]:mt-0 @min-[640px]:-ml-[3px] @min-[640px]:w-[196px] @min-[640px]:shrink-0 @min-[640px]:rounded-r-[14px] @min-[640px]:rounded-bl-none @min-[640px]:border-t-0 @min-[640px]:border-l-2 @min-[640px]:[--notch-a:3px_0] @min-[640px]:[--notch-b:3px_100%] ${
						open
							? "[clip-path:var(--torn-stub-y)] @min-[640px]:[clip-path:var(--torn-stub-x)]"
							: ""
					} ${torn ? "opacity-0" : ""}`}
				>
					<div className="hidden h-2.5 rounded-tr-[14px] bg-pass-accent @min-[640px]:block" />
					<div className="flex flex-1 flex-col gap-3 px-5 pt-4 pb-5">
						<span className="font-semibold text-paper-label text-xs uppercase tracking-[0.18em]">
							{text.passStub}
						</span>
						<span className="flex items-center gap-2 font-bold font-mono text-[22px]">
							{pass.origin.code}
							<Arrow className="h-4 w-7" />
							<span className="sr-only">{text.passTo}</span>
							{pass.destination.code}
						</span>
						<div className="grid grid-cols-4 gap-x-3 gap-y-2.5 @min-[640px]:grid-cols-2">
							<Field label={text.passFlight} mono>
								{pass.designator}
							</Field>
							<Field label={text.passSeat} mono>
								<span className="font-bold">{pass.seat ?? none}</span>
							</Field>
							<Field label={text.passDate} mono>
								{pass.shortDate}
							</Field>
							<Field label={text.passDeparts} mono>
								{pass.departureTime ?? none}
							</Field>
						</div>
						{pass.passengerName && (
							<span className="mt-auto font-semibold text-[13px] uppercase">
								{pass.passengerName}
							</span>
						)}
						{onRelive && (
							// The button is the handle of the tear. A tap, the keyboard and a screen reader give the same tear.
							// Only the handle stops the scroll, thus the page scrolls from the rest of the stub.
							<button
								type="button"
								onClick={() => {
									if (!afterPull.current) {
										onRelive();
									}
									afterPull.current = false;
								}}
								onPointerDown={onPullStart}
								onPointerMove={onPullMove}
								onPointerUp={onPullEnd}
								onPointerCancel={onPullEnd}
								onLostPointerCapture={onPullEnd}
								className="flex min-h-11 cursor-grab touch-none select-none items-center justify-center gap-2 rounded-md border-2 border-pass-accent border-dashed px-3 py-1.5 font-semibold text-pass-accent text-sm active:cursor-grabbing motion-reduce:cursor-pointer motion-reduce:touch-auto"
							>
								{/* The arrow points away from the body: down on a telephone, right from 640 px. */}
								<span className="shrink-0 @min-[640px]:-rotate-90">
									<PullIcon />
								</span>
								{text.tearToRelive}
							</button>
						)}
					</div>
				</div>
			</article>
			{logo && (
				<p className="mt-1.5 text-[11px] text-muted-foreground">
					{text.passLogoTrademark}
				</p>
			)}
		</div>
	);
}
