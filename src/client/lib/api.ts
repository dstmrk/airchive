/** An answer of the API that is not a success. `body` is null for a body that is not JSON. */
export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly body: unknown,
	) {
		super(`The API gave the status ${status}.`);
		this.name = "ApiError";
	}
}

type RequestOptions = {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	body?: unknown;
};

/**
 * A request to the API of the Worker. The origin is the same, thus the
 * cookie of the session goes with each request. It gives the JSON of the
 * response, or `undefined` for 204. It throws an `ApiError` for each other
 * status.
 */
export async function apiRequest<T>(
	path: string,
	{ method = "GET", body }: RequestOptions = {},
	fetchFn: typeof fetch = fetch,
): Promise<T> {
	const response = await fetchFn(path, {
		method,
		headers:
			body === undefined ? undefined : { "content-type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	if (response.status === 204) {
		return undefined as T;
	}
	const json: unknown = await response.json().catch(() => null);
	if (!response.ok) {
		throw new ApiError(response.status, json);
	}
	return json as T;
}
