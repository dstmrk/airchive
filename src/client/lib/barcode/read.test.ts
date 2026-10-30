import { describe, expect, it } from "vitest";
import readerWasm from "zxing-wasm/reader/zxing_reader.wasm?inline";
import {
	prepareZXingModule as prepareWriter,
	writeBarcode,
} from "zxing-wasm/writer";
import writerWasm from "zxing-wasm/writer/zxing_writer.wasm?inline";
import { bcbpText, readBcbp } from "./read.ts";

const BCBP = "M1TRAVELER/ALEX MR    EK7Q2XD FCONRTAZ 0784 133Y014A0042 100";

// In Node, each module reads its WebAssembly from the data URL of Vite, not from a server.
const binary = (dataUrl: string) =>
	Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(",") + 1)), (c) =>
		c.charCodeAt(0),
	).buffer;
prepareWriter({ overrides: { wasmBinary: binary(writerWasm) } });
const reader = { wasmBinary: binary(readerWasm) };

async function image(text: string, format: "PDF417" | "Aztec" | "QRCode") {
	const { image } = await writeBarcode(text, { format, scale: 3 });
	if (!image) {
		throw new Error("The writer gave no image.");
	}
	return new Uint8Array(await image.arrayBuffer());
}

describe("readBcbp", () => {
	it.each(["PDF417", "Aztec", "QRCode"] as const)(
		"reads the boarding pass in a %s code",
		async (format) => {
			expect(await readBcbp(await image(BCBP, format), reader)).toBe(BCBP);
		},
	);

	it("gives null for a code that is not a boarding pass", async () => {
		expect(
			await readBcbp(await image("https://example.com", "QRCode"), reader),
		).toBeNull();
	});
});

describe("bcbpText", () => {
	it("gives the first text that is a boarding pass", () => {
		expect(bcbpText([{ text: "https://example.com" }, { text: BCBP }])).toBe(
			BCBP,
		);
	});

	it("gives null with no code", () => {
		expect(bcbpText([])).toBeNull();
	});
});
