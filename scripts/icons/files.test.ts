import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { iconTextFiles, readBrandTokens } from "./files.ts";

const read = (path: string) =>
	readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("readBrandTokens", () => {
	it("reads the colours of the mark in app.css", () => {
		expect(
			readBrandTokens(
				"--color-background: #ece6da;\n--color-paper: #fbf7ee;\n--color-pass-accent: #1f5f74;",
			),
		).toEqual({ accent: "#1f5f74", paper: "#fbf7ee", background: "#ece6da" });
	});

	it("throws when a token is not there", () => {
		expect(() => readBrandTokens("--color-paper: #fbf7ee;")).toThrow(
			/pass-accent/,
		);
	});
});

describe("the files of the icons in public/", () => {
	const files = iconTextFiles(
		readBrandTokens(read("src/client/styles/app.css")),
	);

	it.each(Object.keys(files))(
		"%s is the output of mark.ts and of the tokens",
		(name) => {
			// A change of the mark or of a colour needs `node scripts/icons/build.mjs`.
			expect(read(`public/${name}`)).toBe(files[name]);
		},
	);

	it("gives index.html the theme colour of the manifest", () => {
		const manifest = JSON.parse(files["manifest.webmanifest"] ?? "{}");

		expect(read("index.html")).toContain(
			`<meta name="theme-color" content="${manifest.theme_color}" />`,
		);
	});

	it("gives the manifest each PNG icon", () => {
		const manifest = JSON.parse(files["manifest.webmanifest"] ?? "{}");

		expect(manifest.icons.map((icon: { src: string }) => icon.src)).toEqual([
			"/icon-192.png",
			"/icon-512.png",
			"/icon-maskable-512.png",
		]);
	});
});
