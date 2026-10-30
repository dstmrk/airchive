/**
 * The catalogue of the airline logos: `src/client/logos/airlines.json`.
 * Paragraph 5.4.1 of `docs/architecture.md` gives the decisions.
 *
 * Each logo has one colour, thus the pass draws it in its accent. Each entry
 * keeps the view box of its source file, thus a new logo needs no redraw.
 * An entry can have a period (`since`, `until`): a code goes to a new
 * airline over time, and a flight of 2019 with `AZ` was Alitalia, not ITA.
 *
 * This file is pure. `add.ts` and `missing.ts` read and write the files.
 */

export type LogoEntry = {
	codes: string[];
	title: string;
	/** The first day of the period, "YYYY-MM-DD". */
	since?: string;
	/** The last day of the period, "YYYY-MM-DD". */
	until?: string;
	/** The file, the part of the file and the licence. */
	source: string;
	viewBox: string;
	path: string;
};

const IATA_CODE = /^[A-Z0-9]{2}$/;
const VIEW_BOX = /^-?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+$/;
/** The commands and the numbers of SVG path data, and nothing else. */
const PATH_DATA = /^[MmLlHhVvCcSsQqTtAaZz\d\s.,eE+-]+$/;

function isDate(value: string): boolean {
	const date = new Date(`${value}T00:00:00Z`);
	return (
		/^\d{4}-\d{2}-\d{2}$/.test(value) &&
		!Number.isNaN(date.getTime()) &&
		date.toISOString().startsWith(value)
	);
}

const compareTitles = (a: string, b: string) =>
	a.localeCompare(b, "en", { sensitivity: "base" });

/** The errors of the catalogue. An empty list is a valid catalogue. */
export function validateCatalogue(entries: readonly LogoEntry[]): string[] {
	const errors: string[] = [];
	const periods = new Map<
		string,
		{ title: string; from: string; to: string }[]
	>();
	entries.forEach((entry, index) => {
		const name = entry.title || `entry ${index}`;
		if (entry.codes.length === 0) {
			errors.push(`${name}: no code`);
		}
		for (const code of entry.codes) {
			if (!IATA_CODE.test(code)) {
				errors.push(`${name}: ${code} is not an IATA code`);
			}
		}
		if (!entry.source.trim()) {
			errors.push(`${name}: no source`);
		}
		if (!VIEW_BOX.test(entry.viewBox)) {
			errors.push(`${name}: bad viewBox`);
		}
		if (!PATH_DATA.test(entry.path)) {
			errors.push(`${name}: the path holds other characters`);
		}
		for (const key of ["since", "until"] as const) {
			const value = entry[key];
			if (value !== undefined && !isDate(value)) {
				errors.push(`${name}: ${key} is not a date`);
			}
		}
		if (entry.since && entry.until && entry.until < entry.since) {
			errors.push(`${name}: until is before since`);
		}
		const from = entry.since ?? "0000-00-00";
		const to = entry.until ?? "9999-99-99";
		for (const code of entry.codes) {
			for (const other of periods.get(code) ?? []) {
				if (from <= other.to && other.from <= to) {
					errors.push(`${name}: ${code} overlaps with ${other.title}`);
				}
			}
			periods.set(code, [
				...(periods.get(code) ?? []),
				{ title: name, from, to },
			]);
		}
		const previous = entries[index - 1];
		if (previous && compareTitles(previous.title, entry.title) > 0) {
			errors.push(
				`${name}: wrong order, the catalogue is in the order of the titles`,
			);
		}
	});
	return errors;
}

/** The catalogue with one more logo, in the order of the titles. It throws for an invalid result. */
export function addLogo(
	entries: readonly LogoEntry[],
	entry: LogoEntry,
): LogoEntry[] {
	const result = [...entries, entry].sort((a, b) =>
		compareTitles(a.title, b.title),
	);
	const errors = validateCatalogue(result);
	if (errors.length > 0) {
		throw new Error(errors.join("\n"));
	}
	return result;
}

const attribute = (tag: string, name: string) =>
	new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];

/**
 * The view box and the path of an SVG file with one colour. The file must hold
 * only paths, with no transform: the pass draws the path in its accent.
 * A file with shapes, transforms or more colours needs a trace first.
 */
export function parseSingleColourSvg(svg: string): {
	viewBox: string;
	path: string;
} {
	const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? "";
	const viewBox = attribute(root, "viewBox");
	if (!viewBox) {
		throw new Error("The file has no viewBox.");
	}
	if (/\stransform=/.test(svg)) {
		throw new Error("The file has a transform. Trace it first.");
	}
	const shape =
		/<(rect|circle|ellipse|line|polyline|polygon|image|text|use)\b/.exec(svg);
	if (shape) {
		throw new Error(
			`The file has a ${shape[1]}, not only paths. Trace it first.`,
		);
	}
	const paths = [...svg.matchAll(/<path\b[^>]*>/g)].map((m) => m[0]);
	if (paths.length === 0) {
		throw new Error("The file has no path.");
	}
	const fills = new Set(
		paths
			.map((tag) => attribute(tag, "fill"))
			.filter((fill) => fill !== undefined),
	);
	if (fills.size > 1) {
		throw new Error("The file has more than one colour.");
	}
	return {
		viewBox: viewBox.trim().replace(/\s+/g, " "),
		path: paths
			.map((tag) => attribute(tag, "d") ?? "")
			.join(" ")
			.trim(),
	};
}

/**
 * The query for the console of D1: the airline codes of the archive with no
 * logo, the most frequent first. It reads only the code and the date of each
 * flight, no personal data.
 */
export function missingLogosSql(entries: readonly LogoEntry[]): string {
	const covered = entries.flatMap((entry) =>
		entry.codes.map((code) => {
			const conditions = [`airline_code = '${code}'`];
			if (entry.since) {
				conditions.push(`departure_date >= '${entry.since}'`);
			}
			if (entry.until) {
				conditions.push(`departure_date <= '${entry.until}'`);
			}
			return `(${conditions.join(" AND ")})`;
		}),
	);
	return [
		"SELECT airline_code, COUNT(*) AS flights, COUNT(DISTINCT owner_id) AS people",
		"FROM flight",
		`WHERE NOT (${covered.join("\n  OR ") || "0"})`,
		"GROUP BY airline_code",
		"ORDER BY people DESC, flights DESC;",
	].join("\n");
}
