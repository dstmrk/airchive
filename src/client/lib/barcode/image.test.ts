import { describe, expect, it } from "vitest";
import { fitWithin } from "./image.ts";

describe("fitWithin", () => {
	it.each([
		[4032, 3024, { width: 3000, height: 2250 }],
		[3024, 4032, { width: 2250, height: 3000 }],
		[1170, 2532, { width: 1170, height: 2532 }],
		[800, 600, { width: 800, height: 600 }],
		[3000, 10, { width: 3000, height: 10 }],
		[30000, 1, { width: 3000, height: 1 }],
	])("fits %d × %d in 3000 pixels", (width, height, expected) => {
		expect(fitWithin(width, height, 3000)).toEqual(expected);
	});
});
