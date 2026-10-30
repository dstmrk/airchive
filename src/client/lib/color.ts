/** The smallest contrast for a large accent on the paper (WCAG, non-text). */
const MIN_ACCENT_CONTRAST = 3;

/**
 * A colour of `pass.json`, which writes `rgb(r, g, b)`, as `#rrggbb`. Any
 * other text gives null: the value comes from a file that is not trusted.
 */
export function parsePassColor(value: unknown): string | null {
	if (typeof value !== "string") {
		return null;
	}
	const text = value.trim().toLowerCase();
	if (/^#[0-9a-f]{6}$/.test(text)) {
		return text;
	}
	const match = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(
		text,
	);
	if (!match) {
		return null;
	}
	const channels = match.slice(1, 4).map(Number);
	if (channels.some((c) => c > 255)) {
		return null;
	}
	return `#${channels.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex: string): number {
	const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
		const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The contrast of two `#rrggbb` colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
	const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

/**
 * The colour of an airline as the accent of the pass, or null when it is too
 * pale on the paper. Many passes have a white or a pale background; the pass
 * then keeps the default accent.
 */
export function usableAccent(
	color: string | null,
	paper: string,
): string | null {
	if (color === null) {
		return null;
	}
	return contrastRatio(color, paper) >= MIN_ACCENT_CONTRAST ? color : null;
}
