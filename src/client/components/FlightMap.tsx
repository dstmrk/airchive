import { useQuery } from "@tanstack/react-query";
import { type StyleSpecification, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
// The bundle serves the worker of MapLibre, not a CDN.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import { Layer, Map as MapView, Marker, Source } from "react-map-gl/maplibre";
import type { Airport } from "../../shared/airport.ts";
import { useText } from "../i18n/I18nProvider.tsx";
import { greatCircle, type LonLat, routeBounds } from "../lib/great-circle.ts";
import { type MapPalette, paperStyle } from "../lib/paper-map-style.ts";

setWorkerUrl(workerUrl);

/** OpenFreeMap: no key, commercial use allowed. One URL, thus a change of provider is one line. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

function readPalette(): MapPalette {
	const css = getComputedStyle(document.documentElement);
	const token = (name: string) =>
		css.getPropertyValue(`--color-map-${name}`).trim();
	return {
		land: token("land"),
		landDetail: token("land-detail"),
		water: token("water"),
		boundary: token("boundary"),
		road: token("road"),
		label: token("label"),
	};
}

function usePaperStyle() {
	return useQuery({
		queryKey: ["map-style", STYLE_URL],
		queryFn: async () => {
			const response = await fetch(STYLE_URL);
			if (!response.ok) {
				throw new Error(
					`The style of the map gave the status ${response.status}.`,
				);
			}
			return paperStyle(
				(await response.json()) as StyleSpecification,
				readPalette(),
			);
		},
		staleTime: Number.POSITIVE_INFINITY,
	});
}

function AirportPin({ code }: Readonly<{ code: string }>) {
	return (
		<div className="flex flex-col items-center gap-1" aria-hidden="true">
			<span className="rounded-sm bg-paper px-1 font-bold font-mono text-[13px] shadow-sm">
				{code}
			</span>
			<span className="size-2.5 rounded-full border-2 border-paper bg-pass-accent" />
		</div>
	);
}

/**
 * The route of a flight on a map: the great circle between the two airports.
 * Paragraph 5.5 of `docs/architecture.md` gives the decisions. The page loads
 * this component lazily, thus the archive does not load MapLibre.
 */
export default function FlightMap({
	origin,
	destination,
}: Readonly<{ origin: Airport; destination: Airport }>) {
	const text = useText();
	const { data: mapStyle, isError } = usePaperStyle();
	const from: LonLat = [origin.lon, origin.lat];
	const to: LonLat = [destination.lon, destination.lat];
	const route = greatCircle(from, to);
	const end = route.at(-1) ?? to;
	const accent = getComputedStyle(document.documentElement)
		.getPropertyValue("--color-pass-accent")
		.trim();

	if (isError) {
		return (
			<p className="text-muted-foreground text-sm">{text.mapUnavailable}</p>
		);
	}
	return (
		<section aria-label={text.mapLabel} className="flex flex-col gap-1.5">
			<div className="h-72 overflow-hidden rounded-[14px] bg-map-land shadow-[0_1px_0_#d8cfbd] md:h-96">
				{mapStyle && (
					<MapView
						initialViewState={{
							bounds: routeBounds(route),
							fitBoundsOptions: { padding: 56 },
						}}
						mapStyle={mapStyle}
						cooperativeGestures
						dragRotate={false}
						// The credit is below the map: on a telephone the control of MapLibre covers a third of it.
						attributionControl={false}
						style={{ width: "100%", height: "100%" }}
					>
						<Source
							id="route"
							type="geojson"
							data={{
								type: "Feature",
								properties: {},
								geometry: { type: "LineString", coordinates: route },
							}}
						>
							<Layer
								id="route-line"
								type="line"
								layout={{ "line-cap": "round" }}
								paint={{
									"line-color": accent,
									"line-width": 2.5,
									"line-dasharray": [2, 1.5],
								}}
							/>
						</Source>
						<Marker longitude={from[0]} latitude={from[1]} anchor="bottom">
							<AirportPin code={origin.iata} />
						</Marker>
						{/* The unwrapped longitude keeps the marker at the end of the drawn line. */}
						<Marker longitude={end[0]} latitude={end[1]} anchor="bottom">
							<AirportPin code={destination.iata} />
						</Marker>
					</MapView>
				)}
			</div>
			<p className="text-[11px] text-muted-foreground">
				©{" "}
				<a
					href="https://openfreemap.org"
					className="underline underline-offset-2"
				>
					OpenFreeMap
				</a>{" "}
				©{" "}
				<a
					href="https://www.openmaptiles.org/"
					className="underline underline-offset-2"
				>
					OpenMapTiles
				</a>{" "}
				©{" "}
				<a
					href="https://www.openstreetmap.org/copyright"
					className="underline underline-offset-2"
				>
					OpenStreetMap
				</a>{" "}
				{text.mapContributors}
			</p>
		</section>
	);
}
