/**
 * The local "wall clock" times of a flight and the instants that they give.
 * The client and the Worker both use them: the replay gives the durations,
 * and the API refuses two legs of one journey at the same time.
 */

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** The offset of a time zone at an instant, in milliseconds east of UTC. */
function offsetMs(instant: number, zone: string): number {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: zone,
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		hourCycle: "h23",
	}).formatToParts(instant);
	const part = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((p) => p.type === type)?.value);
	const wall = Date.UTC(
		part("year"),
		part("month") - 1,
		part("day"),
		part("hour"),
		part("minute"),
	);
	return wall - Math.floor(instant / MINUTE) * MINUTE;
}

/** The instant of a wall-clock date and time ("YYYY-MM-DD", "HH:MM") in a time zone. */
export function zonedInstant(date: string, time: string, zone: string): number {
	const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
	const [hour = 0, minute = 0] = time.split(":").map(Number);
	const wall = Date.UTC(year, month - 1, day, hour, minute);
	// A second pass corrects the offset when the first guess is on the other side of a change of the clocks.
	const guess = wall - offsetMs(wall, zone);
	return wall - offsetMs(guess, zone);
}

export type LegTimes = {
	departureDate: string;
	departureTime: string | null;
	arrivalDate: string | null;
	arrivalTime: string | null;
};

/**
 * The instants of the departure and of the arrival of a leg, from its local
 * times and the time zone of each airport. An arrival with no date is on the
 * day of the departure, or on the next day when its time is earlier. The
 * arrival is null with no departure time, with no arrival time, or when the
 * flight does not last more than 0 and less than one day.
 */
export function legInstants(
	leg: LegTimes,
	originZone: string,
	destinationZone: string,
): { departure: number | null; arrival: number | null } {
	const departure = leg.departureTime
		? zonedInstant(leg.departureDate, leg.departureTime, originZone)
		: null;
	if (departure === null || !leg.arrivalTime) {
		return { departure, arrival: null };
	}
	let arrival = zonedInstant(
		leg.arrivalDate ?? leg.departureDate,
		leg.arrivalTime,
		destinationZone,
	);
	if (!leg.arrivalDate && arrival <= departure) {
		arrival += DAY;
	}
	const duration = arrival - departure;
	return {
		departure,
		arrival: duration > 0 && duration < DAY ? arrival : null,
	};
}
