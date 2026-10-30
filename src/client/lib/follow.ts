/**
 * Whether the map keeps the aircraft at the centre during the replay.
 * It is on when the replay starts. A tap of the aircraft stops and starts it.
 * A drag of the person stops it. A zoom does not change it.
 */
export type FollowEvent = "tap" | "drag" | "reset";

export const INITIAL_FOLLOW = true;

export function follow(following: boolean, event: FollowEvent): boolean {
	switch (event) {
		case "tap":
			return !following;
		case "drag":
			return false;
		case "reset":
			return INITIAL_FOLLOW;
	}
}
