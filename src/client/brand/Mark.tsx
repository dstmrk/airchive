import {
	GLYPH_PATHS,
	MARK_RADIUS,
	MARK_STROKE,
	MARK_VIEW_BOX,
} from "./mark.ts";

/** The mark of airchive, with the colours of the theme. `mark.ts` gives the drawing. */
export function Mark({ className }: Readonly<{ className: string }>) {
	return (
		<svg viewBox={MARK_VIEW_BOX} aria-hidden="true" className={className}>
			<rect
				x="-4"
				y="-4"
				width="32"
				height="32"
				rx={MARK_RADIUS}
				className="fill-pass-accent"
			/>
			<g
				fill="none"
				strokeWidth={MARK_STROKE}
				strokeLinecap="round"
				strokeLinejoin="round"
				className="stroke-paper"
			>
				{GLYPH_PATHS.map((d) => (
					<path key={d} d={d} />
				))}
			</g>
		</svg>
	);
}

/** The mark and the name, in Barlow. */
export function Wordmark({ size }: Readonly<{ size: "large" | "small" }>) {
	return (
		<span
			className={
				size === "large"
					? "flex items-center gap-3 font-semibold text-3xl tracking-tight"
					: "flex items-center gap-2 font-semibold text-lg tracking-tight"
			}
		>
			<Mark className={size === "large" ? "size-10" : "size-7"} />
			airchive
		</span>
	);
}
