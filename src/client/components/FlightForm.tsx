import { type FormEvent, type ReactNode, useState } from "react";
import type { Airport } from "../../shared/airport.ts";
import {
	CABIN_CLASSES,
	type FlightIssue,
	type FlightView,
} from "../../shared/flight.ts";
import { useText } from "../i18n/I18nProvider.tsx";
import type { Messages } from "../i18n/messages.ts";
import { ApiError } from "../lib/api.ts";
import {
	emptyForm,
	type FieldIssues,
	type FlightFormValues,
	type FormField,
	formFromFlight,
	type IssueCode,
	issuesByField,
	toPayload,
} from "../lib/flight-form.ts";
import { formatDate } from "../lib/format.ts";
import { journeyTitle } from "../lib/journey.ts";
import { useJourneys, useSaveFlight } from "../lib/queries.ts";
import { AirportInput } from "./AirportInput.tsx";

const ISSUE_TEXT: Record<IssueCode, keyof Messages> = {
	invalid: "issueInvalid",
	same_airport: "issueSameAirport",
	arrival_before_departure: "issueArrivalBeforeDeparture",
	unknown_airport: "issueUnknownAirport",
	unknown_journey: "issueUnknownJourney",
};

const CABIN_TEXT: Record<(typeof CABIN_CLASSES)[number], keyof Messages> = {
	economy: "cabinEconomy",
	premium_economy: "cabinPremiumEconomy",
	business: "cabinBusiness",
	first: "cabinFirst",
};

const INPUT =
	"h-11 w-full appearance-none rounded-md border border-foreground/20 bg-white px-3 text-base";

type FlightFormProps = Readonly<{
	flight?: FlightView;
	/** The values of an import, over the empty form. A new import gives a new `key` to the form. */
	initialValues?: Partial<FlightFormValues>;
	initialAirports?: { origin: Airport | null; destination: Airport | null };
	onSaved: (flight: FlightView) => void;
}>;

/** The form for a new flight and for a change of a flight. */
export function FlightForm({
	flight,
	initialValues,
	initialAirports,
	onSaved,
}: FlightFormProps) {
	const text = useText();
	const [values, setValues] = useState<FlightFormValues>(
		flight ? formFromFlight(flight) : { ...emptyForm(), ...initialValues },
	);
	const [issues, setIssues] = useState<FieldIssues>({});
	const [failed, setFailed] = useState(false);
	const save = useSaveFlight(flight?.id);
	const { data: journeys = [] } = useJourneys();
	const locale = document.documentElement.lang;

	// A change of a field removes its issue: the old message no longer describes the value.
	const set = (field: FormField) => (value: string) => {
		setValues((current) => ({ ...current, [field]: value }));
		setIssues(({ [field]: _removed, ...rest }) => rest);
	};
	const issue = (field: FormField) => {
		const code = issues[field];
		return code ? text[ISSUE_TEXT[code]] : null;
	};

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setFailed(false);
		const result = toPayload(values);
		if ("issues" in result) {
			setIssues(result.issues);
			return;
		}
		setIssues({});
		save.mutate(result.flight, {
			onSuccess: onSaved,
			onError: (error) => {
				const body =
					error instanceof ApiError
						? (error.body as { issues?: FlightIssue[] })
						: null;
				if (error instanceof ApiError && error.status === 400 && body?.issues) {
					setIssues(issuesByField(body.issues));
				} else {
					setFailed(true);
				}
			},
		});
	}

	const field = (
		name: FormField,
		label: string,
		input: (props: { id: string; invalid: boolean }) => ReactNode,
	) => (
		<div className="flex flex-col gap-1">
			<label htmlFor={name} className="font-medium text-sm">
				{label}
			</label>
			{input({ id: name, invalid: issues[name] !== undefined })}
			{issue(name) && (
				<p className="text-red-700 text-sm" role="alert">
					{issue(name)}
				</p>
			)}
		</div>
	);

	const textInput = (
		name: FormField,
		label: string,
		extra: {
			placeholder?: string;
			type?: string;
			autoCapitalize?: string;
		} = {},
	) =>
		field(name, label, ({ id, invalid }) => (
			<input
				id={id}
				type={extra.type ?? "text"}
				placeholder={extra.placeholder}
				autoCapitalize={extra.autoCapitalize}
				aria-invalid={invalid}
				value={values[name]}
				onChange={(event) => set(name)(event.target.value)}
				className={INPUT}
			/>
		));

	return (
		<form onSubmit={submit} noValidate className="flex flex-col gap-4">
			{textInput("designator", text.fieldDesignator, {
				placeholder: text.fieldDesignatorHint,
				autoCapitalize: "characters",
			})}
			{textInput("airlineName", text.fieldAirlineName)}
			<AirportInput
				id="origin"
				label={text.fieldOrigin}
				value={values.origin}
				initialAirport={
					flight?.originAirport ?? initialAirports?.origin ?? null
				}
				error={issue("origin")}
				onChange={set("origin")}
			/>
			<AirportInput
				id="destination"
				label={text.fieldDestination}
				value={values.destination}
				initialAirport={
					flight?.destinationAirport ?? initialAirports?.destination ?? null
				}
				error={issue("destination")}
				onChange={set("destination")}
			/>
			<div className="grid grid-cols-2 gap-3">
				{textInput("departureDate", text.fieldDepartureDate, { type: "date" })}
				{textInput("departureTime", text.fieldDepartureTime, { type: "time" })}
				{textInput("arrivalDate", text.fieldArrivalDate, { type: "date" })}
				{textInput("arrivalTime", text.fieldArrivalTime, { type: "time" })}
			</div>
			<div className="grid grid-cols-2 gap-3">
				{textInput("seat", text.fieldSeat, { autoCapitalize: "characters" })}
				{field("cabinClass", text.fieldCabinClass, ({ id, invalid }) => (
					<select
						id={id}
						aria-invalid={invalid}
						value={values.cabinClass}
						onChange={(event) => set("cabinClass")(event.target.value)}
						className={INPUT}
					>
						<option value="">{text.cabinNone}</option>
						{CABIN_CLASSES.map((cabin) => (
							<option key={cabin} value={cabin}>
								{text[CABIN_TEXT[cabin]]}
							</option>
						))}
					</select>
				))}
			</div>
			{textInput("passengerName", text.fieldPassengerName)}
			{textInput("bookingReference", text.fieldBookingReference, {
				autoCapitalize: "characters",
			})}
			{/* With no journey yet, the only choice is a new journey: the field is not necessary. */}
			{journeys.length > 0 &&
				field("journeyId", text.fieldJourney, ({ id, invalid }) => (
					<>
						<select
							id={id}
							aria-invalid={invalid}
							aria-describedby={`${id}-hint`}
							value={values.journeyId}
							onChange={(event) => set("journeyId")(event.target.value)}
							className={INPUT}
						>
							<option value="">{text.journeyNew}</option>
							{journeys.map((journey) => (
								<option key={journey.id} value={journey.id}>
									{journeyTitle(journey, text.journeyDefaultTitle)}
									{journey.flights[0] &&
										` · ${formatDate(journey.flights[0].departureDate, locale)}`}
								</option>
							))}
						</select>
						<p id={`${id}-hint`} className="text-muted-foreground text-sm">
							{text.fieldJourneyHint}
						</p>
					</>
				))}
			<button
				type="submit"
				disabled={save.isPending}
				className="h-11 rounded-md bg-foreground px-4 font-medium text-background disabled:opacity-50"
			>
				{save.isPending ? text.saving : text.saveFlight}
			</button>
			{failed && (
				<p className="text-red-700 text-sm" role="alert">
					{text.saveFailed}
				</p>
			)}
		</form>
	);
}
