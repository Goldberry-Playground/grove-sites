import type { ReactNode } from "react";

/**
 * One-line volume-discount nudge for the cart and checkout summaries
 * ("Add 2 more trees to unlock 10% off", GOL-2432). The words carry the whole
 * message; the tag glyph and success tint are decoration, so nothing is
 * conveyed by colour alone. `role="status"` lets a screen reader hear the line
 * change as the buyer adjusts quantities. Styled in CheckoutShared.css.
 */
export function TierNudge({ children }: { children: ReactNode }) {
  return (
    <p className="grove-tier-nudge" role="status">
      {/* Inline SVG, not an emoji / icon font (those tofu in some renderers). */}
      <svg
        aria-hidden="true"
        focusable="false"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="grove-tier-nudge__icon"
      >
        <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
        <circle cx="7.5" cy="7.5" r="1.5" />
      </svg>
      <span>{children}</span>
    </p>
  );
}
