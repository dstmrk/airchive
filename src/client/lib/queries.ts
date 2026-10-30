import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Airport } from "../../shared/airport.ts";
import type { FlightInput, FlightView } from "../../shared/flight.ts";
import { apiRequest } from "./api.ts";

/**
 * The queries and the mutations of the flights. Each mutation invalidates
 * the list, thus the archive shows the change after the save.
 */

const flightsKey = ["flights"] as const;

export function useFlights(enabled: boolean) {
	return useQuery({
		queryKey: flightsKey,
		queryFn: () => apiRequest<FlightView[]>("/api/flights"),
		enabled,
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
	const client = useQueryClient();
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
		onSuccess: () => client.invalidateQueries({ queryKey: flightsKey }),
	});
}

export function useDeleteFlight(id: string) {
	const client = useQueryClient();
	return useMutation({
		mutationFn: () =>
			apiRequest<void>(`/api/flights/${encodeURIComponent(id)}`, {
				method: "DELETE",
			}),
		onSuccess: () => client.invalidateQueries({ queryKey: flightsKey }),
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
