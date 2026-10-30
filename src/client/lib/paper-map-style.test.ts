import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import { type MapPalette, paperStyle } from "./paper-map-style.ts";

const palette: MapPalette = {
	land: "#f1ebde",
	landDetail: "#e9e1d0",
	water: "#d3d9d4",
	boundary: "#b9ab90",
	road: "#e6dccb",
	label: "#6b6153",
};

/** A small copy of the layers of the positron style of OpenFreeMap. */
const style: StyleSpecification = {
	version: 8,
	sources: {},
	layers: [
		{
			id: "background",
			type: "background",
			paint: { "background-color": "rgb(242,243,240)" },
		},
		{
			id: "water",
			type: "fill",
			source: "s",
			paint: { "fill-color": "rgb(194,200,202)" },
		},
		{
			id: "park",
			type: "fill",
			source: "s",
			paint: { "fill-color": "rgb(230,233,229)", "fill-opacity": 0.5 },
		},
		{
			id: "waterway",
			type: "line",
			source: "s",
			paint: { "line-color": "hsl(195,17%,78%)", "line-width": 1 },
		},
		{
			id: "boundary_2",
			type: "line",
			source: "s",
			paint: { "line-color": "hsl(0,0%,70%)" },
		},
		{
			id: "highway_motorway_inner",
			type: "line",
			source: "s",
			paint: {
				"line-color": [
					"interpolate",
					["linear"],
					["zoom"],
					5.8,
					"#ddd",
					6,
					"#fff",
				],
			},
		},
		{
			id: "label_city",
			type: "symbol",
			source: "s",
			layout: { "text-field": "{name}" },
			paint: { "text-color": "#000", "text-halo-color": "#fff" },
		},
	],
};

function paintOf(
	result: StyleSpecification,
	id: string,
): Record<string, unknown> {
	const layer = result.layers.find((l) => l.id === id);
	return (layer && "paint" in layer ? layer.paint : {}) as Record<
		string,
		unknown
	>;
}

describe("paperStyle", () => {
	const result = paperStyle(style, palette);

	it("gives the paper colour to the background", () => {
		expect(paintOf(result, "background")["background-color"]).toBe(
			palette.land,
		);
	});

	it("gives the water colour to the water and to the waterways", () => {
		expect(paintOf(result, "water")["fill-color"]).toBe(palette.water);
		expect(paintOf(result, "waterway")["line-color"]).toBe(palette.water);
	});

	it("gives the detail colour to the other areas and keeps their opacity", () => {
		expect(paintOf(result, "park")).toEqual({
			"fill-color": palette.landDetail,
			"fill-opacity": 0.5,
		});
	});

	it("gives the boundary colour to the boundaries", () => {
		expect(paintOf(result, "boundary_2")["line-color"]).toBe(palette.boundary);
	});

	it("replaces an expression of colour on a road with the road colour", () => {
		expect(paintOf(result, "highway_motorway_inner")["line-color"]).toBe(
			palette.road,
		);
	});

	it("gives the label colour and a paper halo to the text", () => {
		expect(paintOf(result, "label_city")).toEqual({
			"text-color": palette.label,
			"text-halo-color": palette.land,
		});
	});

	it("keeps the other properties of a layer", () => {
		expect(paintOf(result, "waterway")["line-width"]).toBe(1);
	});

	it("does not change the style that it receives", () => {
		expect(paintOf(style, "background")["background-color"]).toBe(
			"rgb(242,243,240)",
		);
	});
});
