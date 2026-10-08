import type { GroveTrustIconName } from "./trust-items";

/**
 * The trust-strip marks, drawn as geometry instead of typed as characters
 * (GOL-3117). Each path reproduces the glyph it replaces so the strip looks
 * unchanged on a machine that *did* have a symbol font, and now looks the same
 * on one that does not.
 *
 * All four are 12x12, `currentColor`, and sized in `em` so a badge's mark
 * tracks its label's font-size the way the old glyph did. Decorative only: the
 * wrapper is `aria-hidden` and the badge text carries the meaning.
 */
const PATHS: Record<GroveTrustIconName, React.ReactNode> = {
  // U+2726 BLACK FOUR POINTED STAR — four concave-sided points.
  sparkle: <path d="M6 0.5 7.3 4.7 11.5 6 7.3 7.3 6 11.5 4.7 7.3 0.5 6 4.7 4.7Z" fill="currentColor" />,
  // U+25D0 CIRCLE WITH LEFT HALF BLACK — hairline ring, left half filled.
  "half-circle": (
    <>
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.25" />
      <path d="M6 1a5 5 0 0 0 0 10Z" fill="currentColor" />
    </>
  ),
  // U+2713 CHECK MARK — the stroke geometry GOL-3112 shipped on the estimator.
  check: (
    <path
      d="M1.75 6.4 4.6 9.25 10.25 2.9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  // U+2666 BLACK DIAMOND SUIT — a filled rhombus, taller than wide like the glyph.
  diamond: <path d="M6 0.75 10 6 6 11.25 2 6Z" fill="currentColor" />,
};

export interface TrustIconProps {
  name: GroveTrustIconName;
  className?: string;
}

export function TrustIcon({ name, className }: TrustIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 12 12"
      className={className}
      // flexShrink is load-bearing, not defensive: the trust-strip badge is an
      // inline-flex row, so at 390px — where the longest labels wrap to two
      // lines — the mark was being squeezed to 8x12 and the half-circle drew as
      // an ellipse. A 1em box that is allowed to shrink is not a 1em box.
      style={{
        width: "1em",
        height: "1em",
        flexShrink: 0,
        display: "inline-block",
        verticalAlign: "-0.125em",
      }}
    >
      {PATHS[name]}
    </svg>
  );
}
