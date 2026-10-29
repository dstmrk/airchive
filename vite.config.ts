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
});
