/** A point as MapLibre reads it: longitude first, then latitude, in degrees. */
export type LonLat = [lon: number, lat: number];

type Vector = [number, number, number];

const RAD = Math.PI / 180;

function toVector([lon, lat]: LonLat): Vector {
	const phi = lat * RAD;
	const lambda = lon * RAD;
	return [
		Math.cos(phi) * Math.cos(lambda),
		Math.cos(phi) * Math.sin(lambda),
		Math.sin(phi),
	];
}

function toLonLat([x, y, z]: Vector): LonLat {
	return [
		Math.atan2(y, x) / RAD,
		Math.asin(Math.max(-1, Math.min(1, z))) / RAD,
	];
}

const dot = (a: Vector, b: Vector) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function normalize(v: Vector): Vector {
	const length = Math.hypot(...v);
	return [v[0] / length, v[1] / length, v[2] / length];
}

/** A unit vector at a right angle to `a`, for two antipodes, which have no single great circle. */
function anyPerpendicular(a: Vector): Vector {
	const axis: Vector = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
	return normalize([
		a[1] * axis[2] - a[2] * axis[1],
		a[2] * axis[0] - a[0] * axis[2],
		a[0] * axis[1] - a[1] * axis[0],
	]);
}

/**
 * The great circle between two points, the route of paragraph 5.6 of
 * `docs/architecture.md`. It gives `segments + 1` points.
 *
 * The longitudes are continuous: a route that crosses the antimeridian goes
 * past 180 (Tokyo to Los Angeles ends near 241.6, not -118.4). MapLibre then
 * draws one line, not two lines at the two edges of the map.
 */
export function greatCircle(
	from: LonLat,
	to: LonLat,
	segments = 128,
): LonLat[] {
	const a = toVector(from);
	const b = toVector(to);
	const cos = Math.max(-1, Math.min(1, dot(a, b)));
	const angle = Math.acos(cos);
	if (angle < 1e-9) {
		return [from, to];
	}

	// `u` is the direction of the route at `a`, at a right angle to `a`.
	const along: Vector = [
		b[0] - a[0] * cos,
		b[1] - a[1] * cos,
		b[2] - a[2] * cos,
	];
	const u =
		Math.hypot(...along) < 1e-9 ? anyPerpendicular(a) : normalize(along);

	const points: LonLat[] = [];
	let previousLon = from[0];
	for (let i = 0; i <= segments; i += 1) {
		const theta = (angle * i) / segments;
		const c = Math.cos(theta);
		const s = Math.sin(theta);
		const [lon, lat] = toLonLat([
			a[0] * c + u[0] * s,
			a[1] * c + u[1] * s,
			a[2] * c + u[2] * s,
		]);
		// Move the longitude by whole turns to stay within 180 of the previous point.
		const unwrapped = lon + 360 * Math.round((previousLon - lon) / 360);
		points.push([unwrapped, lat]);
		previousLon = unwrapped;
	}
	return points;
}

/** The south-west and the north-east corners of a line, for `fitBounds` of MapLibre. */
export function routeBounds(points: readonly LonLat[]): [LonLat, LonLat] {
	const lons = points.map((p) => p[0]);
	const lats = points.map((p) => p[1]);
	return [
		[Math.min(...lons), Math.min(...lats)],
		[Math.max(...lons), Math.max(...lats)],
	];
}

/** The mean radius of the Earth, in km (IUGG). */
const EARTH_RADIUS_KM = 6371.0088;

/** The distance between two points on the great circle, in km. */
export function distanceKm(from: LonLat, to: LonLat): number {
	const cos = Math.max(-1, Math.min(1, dot(toVector(from), toVector(to))));
	return Math.acos(cos) * EARTH_RADIUS_KM;
}
