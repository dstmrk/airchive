/**
 * The cabin of the replay: the map and the controls fill the screen. The URL
 * holds `?replay`, thus the button "back" of the browser closes the cabin.
 * Paragraph 5.6 of `docs/architecture.md` gives the decisions.
 */

export type FlightSearch = { replay?: true };

/** The search of the page of a flight. Only `replay=true` opens the cabin. */
export function flightSearch(search: Record<string, unknown>): FlightSearch {
	return search.replay === true ? { replay: true } : {};
}

/**
 * The operation that makes the URL and the cabin agree:
 * - `push`: the cabin opened, thus the history gets an entry for "back".
 * - `stop`: the URL lost `?replay` (the person went back), thus the replay stops.
 * - `strip`: the URL has `?replay` with no replay (a reload or a forward).
 *   The replay never starts alone, thus the URL loses `?replay`.
 */
export function syncCabin({
	open,
	inUrl,
	wasInUrl,
}: Readonly<{
	open: boolean;
	inUrl: boolean;
	wasInUrl: boolean;
}>): "push" | "stop" | "strip" | null {
	if (open && !inUrl) {
		return wasInUrl ? "stop" : "push";
	}
	return !open && inUrl ? "strip" : null;
}
