import { useQuery } from "@tanstack/react-query";
import { type StyleSpecification, setWorkerUrl } from "maplibre-gl";
import { useEffect, useMemo, useReducer, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
// The bundle serves the worker of MapLibre, not a CDN.
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import {
	Layer,
	type MapRef,
	Map as MapView,
	Marker,
	Source,
} from "react-map-gl/maplibre";
import { useText } from "../i18n/I18nProvider.tsx";
import { follow, INITIAL_FOLLOW } from "../lib/follow.ts";
import { routeBounds } from "../lib/great-circle.ts";
import {
	type JourneyMoment,
	journeyMap,
	type Timeline,
} from "../lib/journey-replay.ts";
import { type MapPalette, paperStyle } from "../lib/paper-map-style.ts";
import { CIVIL_DUSK, darkArea, SUNSET } from "../lib/terminator.ts";

setWorkerUrl(workerUrl);

/** OpenFreeMap: no key, commercial use allowed. One URL, thus a change of provider is one line. */
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/** The two dark areas, from the sunset and from the end of the civil dusk. */
const DARK = [
	{ id: "after-sunset", altitude: SUNSET },
	{ id: "after-dusk", altitude: CIVIL_DUSK },
] as const;

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

/** An aircraft seen from above, with the nose to the north. */
function Aircraft() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden="true" className="size-7 drop-shadow">
			<path
				d="M12 2c.8 0 1.4.9 1.4 2v5.2l7.6 4.4v2l-7.6-2.2v4.4l2.2 1.7V21L12 20l-3.6 1v-1.5l2.2-1.7v-4.4L3 15.6v-2l7.6-4.4V4c0-1.1.6-2 1.4-2z"
				className="fill-pass-accent stroke-paper"
				strokeWidth="1"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

/**
 * The route of a journey on a map: the great circle of each leg. A dotted
 * line on the ground joins two airports of one city. Paragraph 5.5 of
 * `docs/architecture.md` gives the decisions. The page loads this component
 * lazily, thus the archive does not load MapLibre.
 *
 * During the replay, `view` puts the aircraft on the route, and a solid line
 * shows the part that it flew. The map keeps the aircraft at the centre, also
 * during a zoom. A drag of the map stops it, and a tap of the aircraft starts
 * and stops it.
 *
 * With `instant` (the time of the replay, to the minute), a dark layer covers
 * the night. A lighter band before it is the civil twilight.
 *
 * With `cabin`, the map fills the height of its parent, and one finger moves
 * it: the page under the cabin does not scroll.
 */
export default function FlightMap({
	timeline,
	view = null,
	instant = null,
	cabin = false,
}: Readonly<{
	timeline: Timeline;
	view?: JourneyMoment | null;
	instant?: number | null;
	cabin?: boolean;
}>) {
	const text = useText();
	const mapRef = useRef<MapRef>(null);
	const [following, dispatchFollow] = useReducer(follow, INITIAL_FOLLOW);
	const { data: mapStyle, isError } = usePaperStyle();
	const { routes } = timeline;
	const { pins, transfers } = useMemo(() => journeyMap(timeline), [timeline]);
	const bounds = useMemo(() => routeBounds(routes.flat()), [routes]);
	const aircraft = view?.aircraft ?? null;
	const flown = view?.flown ?? [];
	const tracking = aircraft !== null && following;
	const centre = tracking ? [aircraft.lon, aircraft.lat] : null;
	const css = getComputedStyle(document.documentElement);
	const accent = css.getPropertyValue("--color-pass-accent").trim();
	const night = css.getPropertyValue("--color-map-night").trim();
	// Two areas with the same colour: where they overlap, after the civil dusk, the night is darker.
	const dark = useMemo(
		() =>
			instant === null
				? null
				: DARK.map(({ id, altitude }) => ({
						id,
						area: {
							type: "Feature" as const,
							properties: {},
							geometry: {
								type: "Polygon" as const,
								coordinates: [darkArea(instant, altitude)],
							},
						},
					})),
		[instant],
	);

	const lon = centre?.[0];
	const lat = centre?.[1];
	// `jumpTo` and not `easeTo`: an ease at each frame of the replay would stack.
	// `jumpTo` stops the gestures, thus it waits while the person zooms the map.
	useEffect(() => {
		const map = mapRef.current;
		if (lon !== undefined && lat !== undefined && !map?.isMoving()) {
			map?.jumpTo({ center: [lon, lat] });
		}
	}, [lon, lat]);

	// The replay without an aircraft (it did not start) starts again with the follow on.
	const started = view !== null;
	useEffect(() => {
		if (!started) {
			dispatchFollow("reset");
		}
	}, [started]);

	// A zoom around the centre keeps the aircraft where it is.
	useEffect(() => {
		const map = mapRef.current?.getMap();
		const options = tracking ? { around: "center" as const } : true;
		map?.scrollZoom.enable(options);
		map?.touchZoomRotate.enable(options);
	}, [tracking]);

	// `react-map-gl` reads `cooperativeGestures` only at the start of the map.
	// The size changes with the cabin, thus the route goes in the map again.
	// With the follow, the next frame of the replay puts the aircraft at the centre.
	useEffect(() => {
		const map = mapRef.current?.getMap();
		if (!map) {
			return;
		}
		if (cabin) {
			map.cooperativeGestures.disable();
		} else {
			map.cooperativeGestures.enable();
		}
		map.resize();
		map.fitBounds(bounds, { padding: 56, animate: false });
	}, [cabin, bounds]);

	if (isError) {
		return (
			<p className="text-muted-foreground text-sm">{text.mapUnavailable}</p>
		);
	}
	return (
		<section
			aria-label={text.mapLabel}
			className={`flex flex-col gap-1.5 ${cabin ? "min-h-0 flex-1" : ""}`}
		>
			<div
				className={`overflow-hidden bg-map-land ${
					cabin
						? "min-h-0 flex-1"
						: "h-72 rounded-[14px] shadow-[0_1px_0_#d8cfbd] md:h-96"
				}`}
			>
				{mapStyle && (
					<MapView
						ref={mapRef}
						initialViewState={{
							bounds,
							fitBoundsOptions: { padding: 56 },
						}}
						mapStyle={mapStyle}
						cooperativeGestures={!cabin}
						dragRotate={false}
						// The credit is below the map: on a telephone the control of MapLibre covers a third of it.
						attributionControl={false}
						style={{ width: "100%", height: "100%" }}
						// A move of the code has no `originalEvent`: only a drag of the person stops the follow.
						onDragStart={(event) => {
							if (event.originalEvent) {
								dispatchFollow("drag");
							}
						}}
						// A double tap zooms around the tap, not around the centre.
						onZoomEnd={() => {
							if (tracking) {
								mapRef.current?.jumpTo({
									center: [aircraft.lon, aircraft.lat],
								});
							}
						}}
					>
						{dark?.map(({ id, area }) => (
							<Source key={id} id={id} type="geojson" data={area}>
								<Layer
									id={`${id}-fill`}
									type="fill"
									// The outline of the antialias draws a line along the edge of the ring at -180 and 180.
									paint={{
										"fill-color": night,
										"fill-opacity": 0.16,
										"fill-antialias": false,
									}}
								/>
							</Source>
						))}
						<Source
							id="route"
							type="geojson"
							data={{
								type: "Feature",
								properties: {},
								geometry: { type: "MultiLineString", coordinates: routes },
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
						<Source
							id="flown"
							type="geojson"
							data={{
								type: "Feature",
								properties: {},
								geometry: { type: "MultiLineString", coordinates: flown },
							}}
						>
							<Layer
								id="flown-line"
								type="line"
								layout={{ "line-cap": "round" }}
								paint={{ "line-color": accent, "line-width": 3 }}
							/>
						</Source>
						<Source
							id="transfers"
							type="geojson"
							data={{
								type: "Feature",
								properties: {},
								geometry: { type: "MultiLineString", coordinates: transfers },
							}}
						>
							<Layer
								id="transfers-line"
								type="line"
								layout={{ "line-cap": "round" }}
								paint={{
									"line-color": accent,
									"line-width": 1.5,
									"line-dasharray": [0.5, 2],
								}}
							/>
						</Source>
						{/* The unwrapped longitudes keep each marker at the end of its drawn line. */}
						{pins.map(({ code, at }) => (
							<Marker
								key={code}
								longitude={at[0]}
								latitude={at[1]}
								anchor="bottom"
							>
								<AirportPin code={code} />
							</Marker>
						))}
						{aircraft && (
							<Marker
								longitude={aircraft.lon}
								latitude={aircraft.lat}
								rotation={aircraft.bearing}
								rotationAlignment="map"
							>
								<button
									type="button"
									aria-label={text.followAircraft}
									aria-pressed={following}
									onClick={() => dispatchFollow("tap")}
									className={`grid size-11 place-items-center rounded-full ${following ? "ring-2 ring-pass-accent" : ""}`}
								>
									<Aircraft />
								</button>
							</Marker>
						)}
					</MapView>
				)}
			</div>
			<p className={`text-[11px] text-muted-foreground ${cabin ? "px-4" : ""}`}>
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
