import { defineConfig } from "vitest/config";

/**
 * Vitest needs its own file. Without it, Vitest reads `vite.config.ts` and
 * starts the plugin of Cloudflare, which a unit test does not need.
 */
export default defineConfig({
	// The test of the barcode reader loads the WebAssembly of ZXing with `?inline`.
	assetsInclude: ["**/*.wasm"],
	test: {
		include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
	},
});
