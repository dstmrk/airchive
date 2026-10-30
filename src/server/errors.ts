const MAX_CAUSES = 5;

function firstLine(value: unknown): string {
	const text = value instanceof Error ? value.message : String(value);
	return text.split("\n")[0] ?? "";
}

/**
 * One line for the log: the message of the error and of each cause, the
 * deepest last. The message of a D1 error is often in a cause: "Failed query"
 * is outside, "no such table" is inside.
 *
 * Only the first line of each message goes to the log. Drizzle writes the
 * parameters of the query on the next lines, and a parameter can hold an
 * email address or the address of a client.
 */
export function describeError(error: unknown): string {
	const parts: string[] = [];
	let current: unknown = error;
	while (parts.length < MAX_CAUSES) {
		parts.push(firstLine(current));
		if (!(current instanceof Error) || current.cause === undefined) {
			break;
		}
		current = current.cause;
	}
	return parts.join(" ← ");
}
