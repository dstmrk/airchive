/**
 * It writes the query of the airline codes with no logo. Run it with
 * `npm run logos:missing`, then paste the query in the console of D1 in the
 * dashboard of Cloudflare. The result gives the next logos to add.
 */
import { readFile } from "node:fs/promises";
import { type LogoEntry, missingLogosSql } from "./catalogue.ts";

const FILE = new URL("../../src/client/logos/airlines.json", import.meta.url);
const catalogue = JSON.parse(await readFile(FILE, "utf8")) as LogoEntry[];
console.log(missingLogosSql(catalogue));
