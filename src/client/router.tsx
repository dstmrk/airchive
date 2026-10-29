import {
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
} from "@tanstack/react-router";
import { HomePage } from "./HomePage.tsx";
import { NotFoundPage } from "./NotFoundPage.tsx";

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

export const router = createRouter({
	routeTree: rootRoute.addChildren([homeRoute]),
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
