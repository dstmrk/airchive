/**
 * Whether the map keeps the aircraft at the centre during the replay.
 * A tap of the aircraft starts and stops it. A drag of the person stops it.
 * A zoom does not change it.
 */
export type FollowEvent = "tap" | "drag" | "reset";

export function follow(following: boolean, event: FollowEvent): boolean {
	switch (event) {
		case "tap":
			return !following;
		case "drag":
		case "reset":
			return false;
	}
}
