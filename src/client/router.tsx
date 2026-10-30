import {
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
} from "@tanstack/react-router";
import { FlightEditPage } from "./FlightEditPage.tsx";
import { HomePage } from "./HomePage.tsx";
import { JourneyPage } from "./JourneyPage.tsx";
import { journeySearch } from "./lib/cabin.ts";
import { NewFlightPage } from "./NewFlightPage.tsx";
import { NotFoundPage } from "./NotFoundPage.tsx";
import { SignInPage } from "./SignInPage.tsx";

/**
 * The routes of the client, with code and no generator of files. The asset
 * handler gives `index.html` for each path that is not a file, thus this router
 * shows each page, also the page "not found".
 */
const rootRoute = createRootRoute({
	component: Outlet,
	notFoundComponent: NotFoundPage,
});

const homeRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: HomePage,
});

/**
 * The page of the sign-in. Better Auth sends the person back here with
 * `?error=<code>` when a magic link does not open a session.
 */
const signInRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/sign-in",
	validateSearch: (search: Record<string, unknown>): { error?: string } =>
		typeof search.error === "string" ? { error: search.error } : {},
	component: SignInPage,
});

const newFlightRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/flights/new",
	component: NewFlightPage,
});

/** `?replay=true` opens the cabin of the replay. Paragraph 5.6 of `docs/architecture.md`. */
const journeyRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/journeys/$journeyId",
	validateSearch: journeySearch,
	component: JourneyPage,
});

const flightEditRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/flights/$flightId/edit",
	component: FlightEditPage,
});

export const router = createRouter({
	routeTree: rootRoute.addChildren([
		homeRoute,
		signInRoute,
		newFlightRoute,
		journeyRoute,
		flightEditRoute,
	]),
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
