import { type KeyboardEvent, useEffect, useId, useState } from "react";
import type { Airport } from "../../shared/airport.ts";
import { useText } from "../i18n/I18nProvider.tsx";
import { useAirportSearch } from "../lib/queries.ts";

type AirportInputProps = Readonly<{
	id: string;
	label: string;
	value: string;
	initialAirport: Airport | null;
	error: string | null;
	onChange: (code: string) => void;
}>;

function describe(airport: Airport): string {
	return `${airport.iata} · ${airport.city}`;
}

/**
 * A combobox for one airport. The person writes a city, a name or a code; the
 * list gives the airports of `GET /api/airports`. The value of the form is
 * the IATA code. A text of three letters with no choice is also a code: the
 * API examines it.
 */
export function AirportInput({
	id,
	label,
	value,
	initialAirport,
	error,
	onChange,
}: AirportInputProps) {
	const text = useText();
	const listId = useId();
	const [input, setInput] = useState(
		initialAirport ? describe(initialAirport) : value,
	);
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);

	// A short pause after the last key, thus a word sends one request, not one for each letter.
	useEffect(() => {
		const timer = setTimeout(() => setQuery(input), 200);
		return () => clearTimeout(timer);
	}, [input]);

	const { data: options = [] } = useAirportSearch(open ? query : "");
	const expanded = open && options.length > 0;

	function choose(airport: Airport) {
		setInput(describe(airport));
		setOpen(false);
		onChange(airport.iata);
	}

	function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (!expanded) {
			return;
		}
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActive((index) => Math.min(index + 1, options.length - 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActive((index) => Math.max(index - 1, 0));
		} else if (event.key === "Enter") {
			const airport = options[active];
			if (airport) {
				event.preventDefault();
				choose(airport);
			}
		} else if (event.key === "Escape") {
			setOpen(false);
		}
	}

	return (
		<div className="relative flex flex-col gap-1">
			<label htmlFor={id} className="font-medium text-sm">
				{label}
			</label>
			<input
				id={id}
				role="combobox"
				aria-expanded={expanded}
				aria-controls={listId}
				aria-autocomplete="list"
				aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
				aria-invalid={error !== null}
				autoComplete="off"
				placeholder={text.fieldAirportHint}
				value={input}
				onChange={(event) => {
					const next = event.target.value;
					setInput(next);
					setActive(0);
					setOpen(true);
					onChange(
						/^[A-Za-z]{3}$/.test(next.trim()) ? next.trim().toUpperCase() : "",
					);
				}}
				onKeyDown={onKeyDown}
				onBlur={() => setOpen(false)}
				className="h-11 rounded-md border border-foreground/20 bg-white px-3 text-base"
			/>
			{expanded && (
				<div
					id={listId}
					role="listbox"
					className="absolute top-full z-10 mt-1 max-h-72 w-full overflow-auto rounded-md border border-foreground/20 bg-white shadow-lg"
				>
					{options.map((airport, index) => (
						<div
							key={airport.iata}
							id={`${listId}-${index}`}
							role="option"
							// The focus stays on the input; aria-activedescendant names the option.
							tabIndex={-1}
							aria-selected={index === active}
							// mousedown, not click: the blur of the input closes the list before a click.
							onMouseDown={(event) => {
								event.preventDefault();
								choose(airport);
							}}
							className={`cursor-pointer px-3 py-2 text-sm ${index === active ? "bg-foreground/10" : ""}`}
						>
							<span className="font-semibold">{airport.iata}</span>{" "}
							{airport.city}
							<span className="block truncate text-muted-foreground text-xs">
								{airport.name}
							</span>
						</div>
					))}
				</div>
			)}
			{error && (
				<p className="text-red-700 text-sm" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
