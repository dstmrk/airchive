/**
 * It adds one logo to `src/client/logos/airlines.json`. `catalogue.ts` holds
 * the rules; this file only reads and writes. Examples:
 *
 *   npm run logos:add -- --codes FR --title Ryanair --simple-icons ryanair
 *   npm run logos:add -- --codes XX --title "Example Air" \
 *     --svg logo.svg --source "Wikimedia Commons, File:Example.svg, public domain"
 *
 * Simple Icons (CC0 1.0) is the first source. A file of another source must
 * have one colour and only paths. Then run `npm test` and commit the file.
 */
import { readFile, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { addLogo, type LogoEntry, parseSingleColourSvg } from "./catalogue.ts";

const FILE = new URL("../../src/client/logos/airlines.json", import.meta.url);
const SIMPLE_ICONS = "https://cdn.jsdelivr.net/npm/simple-icons";

const { values } = parseArgs({
	options: {
		codes: { type: "string" },
		title: { type: "string" },
		since: { type: "string" },
		until: { type: "string" },
		"simple-icons": { type: "string" },
		svg: { type: "string" },
		source: { type: "string" },
	},
});

async function text(url: string): Promise<string> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`${url} gave the status ${response.status}.`);
	}
	return response.text();
}

async function readSource(): Promise<{ svg: string; source: string }> {
	const slug = values["simple-icons"];
	if (slug) {
		// The exact version goes into the source, thus the logo can be found again.
		const { version } = JSON.parse(
			await text(`${SIMPLE_ICONS}@latest/package.json`),
		) as { version: string };
		return {
			svg: await text(`${SIMPLE_ICONS}@${version}/icons/${slug}.svg`),
			source: `Simple Icons ${version}, icon \`${slug}\`, CC0 1.0.`,
		};
	}
	if (values.svg && values.source) {
		return { svg: await readFile(values.svg, "utf8"), source: values.source };
	}
	throw new Error("Give --simple-icons <slug>, or --svg <file> with --source.");
}

if (!values.codes || !values.title) {
	throw new Error("Give --codes (for example FR or HV,TO) and --title.");
}
const { svg, source } = await readSource();
const entry: LogoEntry = {
	codes: values.codes.split(",").map((code) => code.trim().toUpperCase()),
	title: values.title,
	...(values.since ? { since: values.since } : {}),
	...(values.until ? { until: values.until } : {}),
	source,
	...parseSingleColourSvg(svg),
};
const catalogue = JSON.parse(await readFile(FILE, "utf8")) as LogoEntry[];
await writeFile(
	FILE,
	`${JSON.stringify(addLogo(catalogue, entry), null, "\t")}\n`,
);
console.log(`Added ${entry.title} (${entry.codes.join(", ")}).`);
