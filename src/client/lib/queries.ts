import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Airport } from "../../shared/airport.ts";
import type { FlightInput, FlightView } from "../../shared/flight.ts";
import type { JourneyView } from "../../shared/journey.ts";
import { apiRequest } from "./api.ts";

/**
 * The queries and the mutations of the flights and of the journeys. A change
 * of a flight can create, change or delete a journey, thus each mutation
 * invalidates the two lists.
 */

const flightsKey = ["flights"] as const;
const journeysKey = ["journeys"] as const;

function useInvalidate() {
	const client = useQueryClient();
	return () =>
		Promise.all([
			client.invalidateQueries({ queryKey: flightsKey }),
			client.invalidateQueries({ queryKey: journeysKey }),
		]);
}

export function useJourneys(enabled = true) {
	return useQuery({
		queryKey: journeysKey,
		queryFn: () => apiRequest<JourneyView[]>("/api/journeys"),
		enabled,
	});
}

export function useJourney(id: string) {
	return useQuery({
		queryKey: [...journeysKey, id],
		queryFn: () =>
			apiRequest<JourneyView>(`/api/journeys/${encodeURIComponent(id)}`),
		retry: false,
	});
}

/** An empty title gives the default title again. */
export function useRenameJourney(id: string) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: (title: string) =>
			apiRequest<{ id: string; title: string | null }>(
				`/api/journeys/${encodeURIComponent(id)}`,
				{ method: "PATCH", body: { title } },
			),
		onSuccess: invalidate,
	});
}

export function useFlight(id: string) {
	return useQuery({
		queryKey: [...flightsKey, id],
		queryFn: () =>
			apiRequest<FlightView>(`/api/flights/${encodeURIComponent(id)}`),
		retry: false,
	});
}

export function useSaveFlight(id?: string) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: (flight: FlightInput) =>
			id === undefined
				? apiRequest<FlightView>("/api/flights", {
						method: "POST",
						body: flight,
					})
				: apiRequest<FlightView>(`/api/flights/${encodeURIComponent(id)}`, {
						method: "PUT",
						body: flight,
					}),
		onSuccess: invalidate,
	});
}

export function useDeleteFlight(id: string) {
	const invalidate = useInvalidate();
	return useMutation({
		mutationFn: () =>
			apiRequest<void>(`/api/flights/${encodeURIComponent(id)}`, {
				method: "DELETE",
			}),
		onSuccess: invalidate,
	});
}

/** The airports for a text of the form. A text of fewer than 2 characters sends no request. */
export function useAirportSearch(text: string) {
	const query = text.trim();
	return useQuery({
		queryKey: ["airports", query.toLowerCase()],
		queryFn: () =>
			apiRequest<Airport[]>(`/api/airports?q=${encodeURIComponent(query)}`),
		enabled: query.length >= 2,
		staleTime: Number.POSITIVE_INFINITY,
	});
}
