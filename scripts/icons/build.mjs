/**
 * It writes the icons of airchive in `public/`. Run it with
 * `node scripts/icons/build.mjs` after a change of `src/client/brand/mark.ts`
 * or of a colour of `app.css`, then commit the files.
 *
 * Chromium draws the PNG files, thus the script needs Playwright. The project
 * does not install it: a cloud session of Claude Code has it. Elsewhere, run
 * `npx playwright install chromium` in a separate directory first.
 */
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { markSvg } from "../../src/client/brand/mark.ts";
import {
	ICO_SIZES,
	iconTextFiles,
	PNG_ICONS,
	readBrandTokens,
} from "./files.ts";
import { icoFromPngs } from "./ico.ts";

// `require`, not `import`: the global Playwright of the session is on NODE_PATH, and ESM does not read it.
const { chromium } = createRequire(import.meta.url)("playwright");
const root = new URL("../../", import.meta.url);
const tokens = readBrandTokens(
	await readFile(new URL("src/client/styles/app.css", root), "utf8"),
);

for (const [name, text] of Object.entries(iconTextFiles(tokens))) {
	await writeFile(new URL(`public/${name}`, root), text);
}

const browser = await chromium.launch();
const page = await browser.newPage();
async function png(size, shape) {
	const svg = markSvg({ tile: tokens.accent, glyph: tokens.paper, shape });
	await page.setViewportSize({ width: size, height: size });
	await page.setContent(
		`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`,
	);
	return new Uint8Array(await page.screenshot({ omitBackground: true }));
}
for (const icon of PNG_ICONS) {
	await writeFile(
		new URL(`public/${icon.name}`, root),
		await png(icon.size, icon.shape),
	);
}
const ico = [];
for (const size of ICO_SIZES) {
	ico.push({ size, png: await png(size, "rounded") });
}
await writeFile(new URL("public/favicon.ico", root), icoFromPngs(ico));
await browser.close();
console.log("Wrote the icons in public/.");
