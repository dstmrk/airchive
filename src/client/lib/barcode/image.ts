import { readBcbp } from "./read.ts";

/**
 * The longest side of the image for the decoder. A photo of a telephone has
 * 4,000 pixels or more. 3,000 pixels keep the bars of a PDF417 code, and they
 * limit the memory of the decoder.
 */
const MAX_SIDE = 3000;

/** The size in a square of `max` pixels, with the same proportions. A small image stays small. */
export function fitWithin(
	width: number,
	height: number,
	max: number,
): { width: number; height: number } {
	const scale = Math.min(1, max / Math.max(width, height));
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
}

/**
 * The BCBP text of an image file, in the browser. The browser decodes the
 * image (also HEIC on Safari), and it throws when the file is not an image.
 */
export async function readBarcodeImage(
	bytes: Uint8Array,
): Promise<string | null> {
	const bitmap = await createImageBitmap(new Blob([bytes.slice()]));
	const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext("2d");
	if (!context) {
		bitmap.close();
		throw new Error("The browser gave no 2D context.");
	}
	context.drawImage(bitmap, 0, 0, width, height);
	bitmap.close();
	return readBcbp(context.getImageData(0, 0, width, height));
}
