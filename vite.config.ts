import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * One configuration for the client and for the Worker. The plugin of
 * Cloudflare runs the Worker in workerd during `vite dev`, thus the client and
 * the API use one origin in development also. `vite build` writes the client
 * to `dist/client` and the Worker to `dist/airchive`.
 */
export default defineConfig({
	plugins: [react(), tailwindcss(), cloudflare()],
	environments: {
		client: {
			build: {
				/**
				 * `maplibre-gl.mjs` is one minified file of approximately 1,100 kB.
				 * No split can make it smaller. The page of a flight loads it lazily.
				 * Each other chunk stays below 250 kB. Paragraph 5.5 of
				 * docs/architecture.md gives the reasons.
				 */
				chunkSizeWarningLimit: 1200,
				rolldownOptions: {
					output: {
						/**
						 * Each large package gets its own chunk. A change of the
						 * application then does not change the hash of these chunks, and
						 * the browser keeps them in its cache. A group captures only
						 * packages that the first page loads, or packages that only one
						 * lazy chunk loads. A group that mixes the two loads the lazy
						 * package at the start.
						 */
						codeSplitting: {
							groups: [
								{ name: "maplibre", test: /node_modules[\\/]maplibre-gl[\\/]/ },
								{
									name: "react",
									test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
								},
								{ name: "tanstack", test: /node_modules[\\/]@tanstack[\\/]/ },
								{ name: "zod", test: /node_modules[\\/]zod[\\/]/ },
							],
						},
					},
				},
			},
		},
	},
});
