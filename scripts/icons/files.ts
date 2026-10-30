/**
 * The text files of the icons in `public/`: `favicon.svg` and
 * `manifest.webmanifest`. Pure: `build.mjs` writes them with the PNG files,
 * and the test compares them with the files in the repository.
 */
import { markSvg } from "../../src/client/brand/mark.ts";

export type BrandTokens = { accent: string; paper: string; background: string };

/** The PNG files that `build.mjs` draws: the name, the size and the shape of `markSvg`. */
export const PNG_ICONS = [
	{ name: "apple-touch-icon.png", size: 180, shape: "square" },
	{ name: "icon-192.png", size: 192, shape: "rounded" },
	{ name: "icon-512.png", size: 512, shape: "rounded" },
	{ name: "icon-maskable-512.png", size: 512, shape: "maskable" },
] as const;

/** The sizes in `favicon.ico`, for the browsers that do not read SVG. */
export const ICO_SIZES = [16, 32, 48] as const;

export function readBrandTokens(css: string): BrandTokens {
	const token = (name: string) => {
		const value = new RegExp(`--color-${name}:\\s*(#[0-9a-f]{6});`, "i").exec(
			css,
		)?.[1];
		if (!value) {
			throw new Error(`app.css has no --color-${name}.`);
		}
		return value.toLowerCase();
	};
	return {
		accent: token("pass-accent"),
		paper: token("paper"),
		background: token("background"),
	};
}

export function iconTextFiles(tokens: BrandTokens): Record<string, string> {
	const manifest = {
		name: "airchive",
		short_name: "airchive",
		description:
			"Turn your boarding passes into a paper keepsake of each flight.",
		start_url: "/",
		// Not "standalone": on iOS an installed application has its own cookies,
		// and the link of the email opens in Safari, thus the sign-in would fail.
		display: "browser",
		background_color: tokens.background,
		theme_color: tokens.background,
		icons: [
			{ src: "/icon-192.png", sizes: "192x192", type: "image/png" },
			{ src: "/icon-512.png", sizes: "512x512", type: "image/png" },
			{
				src: "/icon-maskable-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
	};
	return {
		"favicon.svg": `${markSvg({ tile: tokens.accent, glyph: tokens.paper, shape: "rounded" })}\n`,
		"manifest.webmanifest": `${JSON.stringify(manifest, null, "\t")}\n`,
	};
}
