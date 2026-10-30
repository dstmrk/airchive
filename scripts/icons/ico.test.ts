import { describe, expect, it } from "vitest";
import { icoFromPngs } from "./ico.ts";

const png = (size: number) =>
	new Uint8Array([0x89, 0x50, 0x4e, 0x47, size, 1, 2, 3]);

describe("icoFromPngs", () => {
	it("writes the header, one entry for each image, then the images", () => {
		const ico = icoFromPngs([
			{ size: 16, png: png(16) },
			{ size: 32, png: png(32) },
		]);
		const view = new DataView(ico.buffer);

		expect([view.getUint16(0, true), view.getUint16(2, true)]).toEqual([0, 1]);
		expect(view.getUint16(4, true)).toBe(2);
		// The first entry: 16 x 16, 8 bytes, after the header and the two entries.
		expect([ico[6], ico[7]]).toEqual([16, 16]);
		expect(view.getUint32(6 + 8, true)).toBe(8);
		expect(view.getUint32(6 + 12, true)).toBe(6 + 2 * 16);
		// The second image follows the first one.
		expect(view.getUint32(22 + 12, true)).toBe(6 + 2 * 16 + 8);
		expect(ico.slice(38, 46)).toEqual(png(16));
		expect(ico.length).toBe(6 + 2 * 16 + 16);
	});

	it("writes 0 for a size of 256", () => {
		expect(icoFromPngs([{ size: 256, png: png(0) }])[6]).toBe(0);
	});

	it("refuses a size that ICO cannot hold", () => {
		expect(() => icoFromPngs([{ size: 300, png: png(0) }])).toThrow(/300/);
	});
});
