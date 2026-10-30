import {
	prepareZXingModule,
	type ReaderOptions,
	readBarcodes,
	type ZXingModuleOverrides,
} from "zxing-wasm/reader";
// The bundle serves the WebAssembly of ZXing, not the CDN that the package uses by default.
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import { parseBcbp } from "../bcbp.ts";

/** The formats of IATA Resolution 792: PDF417, Aztec and QR, and Data Matrix on some passes. */
const OPTIONS: ReaderOptions = {
	formats: ["PDF417", "Aztec", "QRCode", "DataMatrix"],
	tryHarder: true,
	tryRotate: true,
	tryInvert: true,
	maxNumberOfSymbols: 4,
};

/** The first text that is a BCBP boarding pass. Another code, for example a link, gives null. */
export function bcbpText(results: readonly { text: string }[]): string | null {
	return results.find((result) => parseBcbp(result.text))?.text ?? null;
}

/**
 * The BCBP text of a boarding pass in an image. The image stays in the browser.
 * `overrides` changes the source of the WebAssembly, for the tests in Node.
 */
export async function readBcbp(
	image: ImageData | Uint8Array,
	overrides: ZXingModuleOverrides = { locateFile: () => wasmUrl },
): Promise<string | null> {
	prepareZXingModule({ overrides });
	return bcbpText(await readBarcodes(image, OPTIONS));
}
