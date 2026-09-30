import type { CSSProperties, ReactElement, SVGProps } from "react";

/**
 * Inline-SVG stand-ins for the decorative glyphs we used to type straight into
 * markup (→ ← ⚠ ✓ ⓘ ● ◷ ✦ ▾).
 *
 * GOL-2797: none of those codepoints are inside the `unicode-range` Google
 * Fonts actually serves for Fraunces / Newsreader / IBM Plex Mono. The latin
 * subset covers U+0000-00FF and U+2000-206F plus a short explicit list
 * (U+2191, U+2193, U+2212, U+2215) — it deliberately excludes U+2190 and
 * U+2192. So the browser could never paint these in a brand face on ANY
 * platform: it fell through "Cormorant Garamond" → Georgia → whatever symbol
 * font the OS happens to carry. That is literal tofu on a bare Linux box and an
 * uncontrolled typeface/weight/baseline substitution everywhere else — in, among
 * other places, the primary checkout CTA.
 *
 * Every one of these is decorative: the adjacent text always carries the
 * meaning, so they are all `aria-hidden` and none of them is the sole signal for
 * a state (colour-independence is unaffected). They size in `em` so they track
 * the surrounding type scale, and paint in `currentColor` so they inherit the
 * token colour of whatever context they land in.
 *
 * Geometry and alignment ride on inline attributes rather than a stylesheet on
 * purpose: `CheckoutPage.css` sits ~8 bytes under the `errorBytes` perf ratchet,
 * so these must cost zero CSS bytes.
 */

/** Decorative only — never labelled, never in the accessibility tree. */
export type GroveGlyphProps = Pick<SVGProps<SVGSVGElement>, "className">;

/**
 * `display` is load-bearing, not cosmetic: Tailwind's Preflight resets
 * `svg { display: block }`, which would put every one of these on its own line
 * — it broke "CONTINUE TO PAYMENT" away from its arrow in the checkout banner,
 * and `white-space: nowrap` could not pull it back because the break was not a
 * soft wrap. Inline-block restores the text-run behaviour the old character had.
 *
 * A 1em box otherwise sits on the baseline and reads visibly low beside text;
 * the nudge optically centres it on the x-height. `flex: none` keeps it from
 * being squashed when it lands in a flex row.
 *
 * This rides inline rather than in a stylesheet because the checkout sheets are
 * at their byte ceiling (see the file header).
 */
const glyphStyle: CSSProperties = {
  display: "inline-block",
  verticalAlign: "-0.125em",
  flex: "none",
};

const strokeBase = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  focusable: "false",
  "aria-hidden": true,
  style: glyphStyle,
} as const;

const fillBase = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 16 16",
  fill: "currentColor",
  focusable: "false",
  "aria-hidden": true,
  style: glyphStyle,
} as const;

/** Trailing direction mark on a forward CTA ("Continue to payment ›"). */
export function ArrowRight({ className }: GroveGlyphProps) {
  return (
    <svg {...strokeBase} className={className}>
      <path d="M2.5 8h11M9.5 4l4 4-4 4" />
    </svg>
  );
}

/** Leading direction mark on a back link ("‹ Keep shopping"). */
export function ArrowLeft({ className }: GroveGlyphProps) {
  return (
    <svg {...strokeBase} className={className}>
      <path d="M13.5 8h-11M6.5 4l-4 4 4 4" />
    </svg>
  );
}

/** Error/alert mark. Decorative — the alert text states the problem. */
export function WarningIcon({ className }: GroveGlyphProps) {
  return (
    <svg {...strokeBase} className={className}>
      <path d="M8 2.1 15 14.2H1z" />
      <path d="M8 6.3v3.3" />
      <path d="M8 11.9h.01" />
    </svg>
  );
}

/** Affirmative mark. Decorative — the sentence beside it says "yes". */
export function CheckIcon({ className }: GroveGlyphProps) {
  return (
    <svg {...strokeBase} className={className}>
      <path d="M2.8 8.6 6.2 12 13.2 4.4" />
    </svg>
  );
}

/** Advisory mark on a note. */
export function InfoIcon({ className }: GroveGlyphProps) {
  return (
    <svg {...strokeBase} className={className}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 7.4v3.6" />
      <path d="M8 5h.01" />
    </svg>
  );
}

/** "Due today" bullet on the review split. */
export function DotIcon({ className }: GroveGlyphProps) {
  return (
    <svg {...fillBase} className={className}>
      <circle cx="8" cy="8" r="4.2" />
    </svg>
  );
}

/** "Due later / when it ships" bullet — a clock face, not a filled bullet. */
export function ClockIcon({ className }: GroveGlyphProps) {
  return (
    <svg {...strokeBase} className={className}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 4.4V8l2.6 1.9" />
    </svg>
  );
}

/** Reassurance sparkle beside the Stripe hand-off note. */
export function SparkIcon({ className }: GroveGlyphProps) {
  return (
    <svg {...fillBase} className={className}>
      <path d="M8 1.2l1.55 5.25L14.8 8l-5.25 1.55L8 14.8l-1.55-5.25L1.2 8l5.25-1.55z" />
    </svg>
  );
}

/** Disclosure caret on the mobile sibling-strip toggle. */
export function CaretDown({ className }: GroveGlyphProps) {
  return (
    <svg {...strokeBase} className={className}>
      <path d="M3.8 6.2 8 10.4l4.2-4.2" />
    </svg>
  );
}

/** "Came back without finishing" mark — the canceled-payment page. */
export function UndoIcon({ className }: GroveGlyphProps) {
  return (
    <svg {...strokeBase} className={className}>
      <path d="M3 5.5h6.5a3.5 3.5 0 010 7H6" />
      <path d="M5.5 3 3 5.5 5.5 8" />
    </svg>
  );
}

/** Partial/deposit mark — a half-filled disc. */
export function HalfCircleIcon({ className }: GroveGlyphProps) {
  return (
    <svg {...strokeBase} className={className}>
      <circle cx="8" cy="8" r="6.2" />
      <path d="M8 1.8a6.2 6.2 0 010 12.4z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Generic reassurance bullet — a lozenge. */
export function DiamondIcon({ className }: GroveGlyphProps) {
  return (
    <svg {...fillBase} className={className}>
      <path d="M8 1.6 14.4 8 8 14.4 1.6 8z" />
    </svg>
  );
}

/**
 * The icon vocabulary a trust badge may name. A closed set on purpose: a badge
 * picks from icons we ship rather than typing an arbitrary character that the
 * brand faces may not carry (GOL-2797).
 */
export type GroveTrustIconName = "spark" | "check" | "half" | "diamond" | "clock" | "info";

const TRUST_ICONS: Record<GroveTrustIconName, (p: GroveGlyphProps) => ReactElement> = {
  spark: SparkIcon,
  check: CheckIcon,
  half: HalfCircleIcon,
  diamond: DiamondIcon,
  clock: ClockIcon,
  info: InfoIcon,
};

/** Renders the named trust-strip icon. Decorative — the badge text carries the claim. */
export function TrustIcon({ name, className }: GroveGlyphProps & { name: GroveTrustIconName }) {
  const Glyph = TRUST_ICONS[name];
  return Glyph ? <Glyph className={className} /> : null;
}
