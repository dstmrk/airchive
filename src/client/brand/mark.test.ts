import { describe, expect, it } from "vitest";
import { GLYPH_PATHS, markSvg } from "./mark.ts";

describe("markSvg", () => {
	const svg = markSvg({
		tile: "#1f5f74",
		glyph: "#fbf7ee",
		shape: "rounded",
	});

	it("draws the tile and each line of the glyph", () => {
		expect(svg).toContain('fill="#1f5f74"');
		expect(svg).toContain('stroke="#fbf7ee"');
		for (const path of GLYPH_PATHS) {
			expect(svg).toContain(`d="${path}"`);
		}
	});

	it("uses the thick line of the small sizes", () => {
		expect(svg).toContain('stroke-width="2.6"');
	});

	it("gives a square tile for a mask of the system", () => {
		expect(markSvg({ tile: "#000", glyph: "#fff", shape: "square" })).toContain(
			'rx="0"',
		);
		expect(svg).not.toContain('rx="0"');
	});

	it("keeps the glyph in the safe circle of a maskable icon", () => {
		const maskable = markSvg({
			tile: "#000",
			glyph: "#fff",
			shape: "maskable",
		});
		const side = Number(/viewBox="\S+ \S+ (\d+)/.exec(maskable)?.[1]);
		// The farthest point of the glyph from the centre (12, 12) is a corner of the ticket, at (2, 21).
		const farthest = Math.hypot(12 - 2, 21 - 12);

		expect(farthest / side).toBeLessThan(0.4);
		expect(svg).toContain('viewBox="-4 -4 32 32"');
	});

	it("starts with the declaration of SVG, for a file", () => {
		expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(
			true,
		);
	});
});
