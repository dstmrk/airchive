import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES, PkpassError, readPassJson } from "./extract.ts";

const passJson = { formatVersion: 1, organizationName: "Example Air" };

function pkpass(
	entries: Record<string, Uint8Array>,
	level: 0 | 9 = 9,
): Uint8Array {
	return zipSync(entries, { level });
}

async function codeOf(bytes: Uint8Array): Promise<string> {
	try {
		await readPassJson(bytes);
		return "no error";
	} catch (error) {
		return error instanceof PkpassError
			? error.code
			: `unexpected: ${String(error)}`;
	}
}

describe("readPassJson", () => {
	it("gives the object of pass.json", async () => {
		const bytes = pkpass({
			"pass.json": strToU8(JSON.stringify(passJson)),
			"logo.png": new Uint8Array([137, 80, 78, 71]),
			"manifest.json": strToU8("{}"),
		});

		await expect(readPassJson(bytes)).resolves.toEqual(passJson);
	});

	it("reads a pass.json that is stored with no compression", async () => {
		const bytes = pkpass({ "pass.json": strToU8(JSON.stringify(passJson)) }, 0);

		await expect(readPassJson(bytes)).resolves.toEqual(passJson);
	});

	it("refuses a file larger than the limit before it opens it", async () => {
		expect(await codeOf(new Uint8Array(MAX_FILE_BYTES + 1))).toBe(
			"file_too_large",
		);
	});

	it("refuses a file that is not a zip archive", async () => {
		expect(await codeOf(strToU8("%PDF-1.7 not a pass"))).toBe("not_a_pass");
	});

	it("refuses an archive with no pass.json", async () => {
		expect(
			await codeOf(pkpass({ "logo.png": new Uint8Array([1, 2, 3]) })),
		).toBe("not_a_pass");
	});

	it("refuses a pass.json in a folder: the name must be exact", async () => {
		const bytes = pkpass({
			"evil/pass.json": strToU8(JSON.stringify(passJson)),
		});

		expect(await codeOf(bytes)).toBe("not_a_pass");
	});

	it("stops a zip bomb: a pass.json that expands past 1 MB", async () => {
		// 50 MB of spaces compress to approximately 50 KB.
		const bomb = new Uint8Array(50 * 1024 * 1024).fill(32);
		const bytes = pkpass({ "pass.json": bomb });
		expect(bytes.length).toBeLessThan(MAX_FILE_BYTES);

		expect(await codeOf(bytes)).toBe("pass_json_too_large");
	});

	it("refuses an archive with too many entries", async () => {
		const entries: Record<string, Uint8Array> = { "pass.json": strToU8("{}") };
		for (let i = 0; i < 300; i += 1) {
			entries[`f${i}.txt`] = strToU8("x");
		}

		expect(await codeOf(pkpass(entries))).toBe("not_a_pass");
	});

	it("refuses a pass.json that is not JSON", async () => {
		expect(await codeOf(pkpass({ "pass.json": strToU8("{not json") }))).toBe(
			"not_a_pass",
		);
	});

	it("refuses a pass.json that is not an object", async () => {
		expect(await codeOf(pkpass({ "pass.json": strToU8("[1,2]") }))).toBe(
			"not_a_pass",
		);
	});
});
