/**
 * Runs `update` in a view transition: the browser animates the change of the
 * elements with a `view-transition-name`. With `prefers-reduced-motion` or with
 * no API in the browser, the change has no animation.
 */
export function withViewTransition(
	update: () => void,
	{
		reduce,
		start,
	}: Readonly<{
		reduce: boolean;
		start: ((callback: () => void) => unknown) | undefined;
	}>,
): void {
	if (reduce || !start) {
		update();
		return;
	}
	start(update);
}
