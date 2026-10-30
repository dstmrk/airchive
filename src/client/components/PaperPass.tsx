import type { ReactNode } from "react";
import type { CabinClass, FlightView } from "../../shared/flight.ts";
import { useText } from "../i18n/I18nProvider.tsx";
import type { Messages } from "../i18n/messages.ts";
import { passView } from "../lib/pass.ts";

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
}: Readonly<{ flight: FlightView; locale: string }>) {
	const text = useText();
	const pass = passView(flight, locale);
	const none = text.passNoValue;
	const arrives = pass.arrivalTime
		? `${pass.arrivalTime}${pass.arrivalOffset ? ` ${pass.arrivalOffset}` : ""}`
		: none;

	return (
		<div className="@container">
			<article
				aria-label={text.passTitle}
				className="flex flex-col overflow-hidden rounded-[14px] bg-paper text-foreground shadow-[0_1px_0_#d8cfbd,0_10px_24px_rgba(60,45,20,0.12)] @min-[640px]:flex-row"
			>
				<div className="flex min-w-0 flex-1 flex-col">
					<div className="h-2.5 bg-pass-accent" />
					<div className="flex flex-1 flex-col gap-4 px-5 pt-4 pb-5 @min-[640px]:px-6">
						<div className="flex items-baseline justify-between gap-2">
							<span className="font-semibold text-paper-label text-xs uppercase tracking-[0.18em]">
								{text.passTitle}
							</span>
							<span className="font-bold font-mono text-[15px] text-pass-accent">
								{pass.designator}
							</span>
						</div>
						<div className="flex items-end gap-3 @min-[640px]:gap-5">
							<div className="flex min-w-0 flex-col">
								<span className="font-bold font-mono text-[40px] leading-none @min-[640px]:text-5xl">
									{pass.origin.code}
								</span>
								<span className="mt-1 truncate text-paper-label text-sm">
									{pass.origin.city}
								</span>
							</div>
							<Arrow className="mb-6 h-6 w-12 shrink-0 @min-[640px]:w-14" />
							<span className="sr-only">{text.passTo}</span>
							<div className="flex min-w-0 flex-col">
								<span className="font-bold font-mono text-[40px] leading-none @min-[640px]:text-5xl">
									{pass.destination.code}
								</span>
								<span className="mt-1 truncate text-paper-label text-sm">
									{pass.destination.city}
								</span>
							</div>
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
				<div className="relative flex flex-col border-perforation border-t-2 border-dashed @min-[640px]:w-[196px] @min-[640px]:shrink-0 @min-[640px]:border-t-0 @min-[640px]:border-l-2">
					{/* The two notches of the perforation: on the sides when the stub is below, at the top and the bottom when it is on the right. */}
					<div className="absolute -top-[13px] -left-3 size-6 rounded-full bg-background @min-[640px]:-left-[13px] @min-[640px]:-top-3" />
					<div className="absolute -top-[13px] -right-3 size-6 rounded-full bg-background @min-[640px]:top-auto @min-[640px]:right-auto @min-[640px]:-bottom-3 @min-[640px]:-left-[13px]" />
					<div className="hidden h-2.5 bg-pass-accent @min-[640px]:block" />
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
					</div>
				</div>
			</article>
		</div>
	);
}
