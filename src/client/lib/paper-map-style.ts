import type { LayerSpecification, StyleSpecification } from "maplibre-gl";

/** The colours of the map. `app.css` holds them as tokens `--color-map-*`. */
export type MapPalette = {
	land: string;
	landDetail: string;
	water: string;
	boundary: string;
	road: string;
	label: string;
};

function recolor(
	layer: LayerSpecification,
	palette: MapPalette,
): LayerSpecification {
	const id = layer.id;
	switch (layer.type) {
		case "background":
			return {
				...layer,
				paint: { ...layer.paint, "background-color": palette.land },
			};
		case "fill":
			return {
				...layer,
				paint: {
					...layer.paint,
					"fill-color": id === "water" ? palette.water : palette.landDetail,
				},
			};
		case "line": {
			const color = id.includes("waterway")
				? palette.water
				: id.startsWith("boundary")
					? palette.boundary
					: palette.road;
			return { ...layer, paint: { ...layer.paint, "line-color": color } };
		}
		case "symbol":
			return {
				...layer,
				paint: {
					...layer.paint,
					"text-color": palette.label,
					"text-halo-color": palette.land,
				},
			};
		default:
			return layer;
	}
}

/**
 * The positron style of OpenFreeMap in the colours of the paper boarding
 * pass. The function gives a new style; it does not change the style that it
 * receives. Refer to paragraph 5.5 of `docs/architecture.md`.
 *
 * The rules use the type and the name of each layer, not a list of names:
 * a new layer of OpenFreeMap gets the colour of its kind.
 */
export function paperStyle(
	style: StyleSpecification,
	palette: MapPalette,
): StyleSpecification {
	return {
		...style,
		layers: style.layers.map((layer) => recolor(layer, palette)),
	};
}
