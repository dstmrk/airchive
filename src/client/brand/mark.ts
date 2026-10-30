/**
 * The mark of airchive: the icon `tickets-plane` of Lucide (ISC licence, in
 * `LUCIDE-LICENSE.txt`) on a tile in the accent of the theme. The line is 2.6,
 * not the 2 of Lucide: at 16 pixels, in the tab of a browser, a thin line is
 * not clear. Issue #19 gives the choice of the owner.
 *
 * This file is the one source of the drawing: `Mark.tsx` draws it in the
 * interface, and `scripts/icons/` writes `public/favicon.svg` and the PNG files.
 */

/** The lines of the glyph, in a box of 24. The last one is the rectangle of Lucide as a path. */
export const GLYPH_PATHS = [
	"M10.5 17h1.227a2 2 0 0 0 1.345-.52L18 12",
	"m12 13.5 3.794.506",
	"m3.173 8.18 11-5a2 2 0 0 1 2.647.993L18.56 8",
	"M6 10V8",
	"M6 14v1",
	"M6 19v2",
	"M4 8h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z",
] as const;

/** The tile adds 4 units on each side of the box of 24 of the glyph. */
export const MARK_VIEW_BOX = "-4 -4 32 32";
export const MARK_STROKE = 2.6;
export const MARK_RADIUS = 7;

/**
 * The mark as a file.
 *
 * - `rounded`: the tile with its corners, for a tab and an icon of a page.
 * - `square`: for iOS, which gives the corners.
 * - `maskable`: for Android, which cuts a circle with a radius of 40%. A
 *   margin of 9 keeps the corners of the ticket in that circle.
 */
export function markSvg({
	tile,
	glyph,
	shape,
}: {
	tile: string;
	glyph: string;
	shape: "rounded" | "square" | "maskable";
}): string {
	const margin = shape === "maskable" ? 9 : 4;
	const side = 24 + 2 * margin;
	const radius = shape === "rounded" ? MARK_RADIUS : 0;
	const lines = GLYPH_PATHS.map((d) => `<path d="${d}"/>`).join("");
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-${margin} -${margin} ${side} ${side}">`,
		"<title>airchive</title>",
		`<rect x="-${margin}" y="-${margin}" width="${side}" height="${side}" rx="${radius}" fill="${tile}"/>`,
		`<g fill="none" stroke="${glyph}" stroke-width="${MARK_STROKE}" stroke-linecap="round" stroke-linejoin="round">${lines}</g>`,
		"</svg>",
	].join("");
}
