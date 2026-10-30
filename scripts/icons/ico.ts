/**
 * An ICO file that holds PNG images, the format of `favicon.ico` since
 * Windows Vista. Each image keeps its PNG bytes. Pure: `render.mjs` gives the
 * PNG files.
 */
export function icoFromPngs(
	images: readonly { size: number; png: Uint8Array }[],
): Uint8Array {
	const header = 6;
	const entry = 16;
	let offset = header + entry * images.length;
	const total =
		offset + images.reduce((sum, image) => sum + image.png.length, 0);
	const ico = new Uint8Array(total);
	const view = new DataView(ico.buffer);
	view.setUint16(2, 1, true); // type: icon
	view.setUint16(4, images.length, true);
	images.forEach(({ size, png }, index) => {
		if (size < 1 || size > 256) {
			throw new Error(`An ICO image has 1 to 256 pixels, not ${size}.`);
		}
		const at = header + entry * index;
		// 256 is written as 0.
		ico[at] = size % 256;
		ico[at + 1] = size % 256;
		view.setUint16(at + 4, 1, true); // colour planes
		view.setUint16(at + 6, 32, true); // bits for each pixel
		view.setUint32(at + 8, png.length, true);
		view.setUint32(at + 12, offset, true);
		ico.set(png, offset);
		offset += png.length;
	});
	return ico;
}
