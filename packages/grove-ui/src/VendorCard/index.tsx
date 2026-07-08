import type { CSSProperties } from "react";

import { useGroveLink } from "../link-context";

/** Accent is passed to CSS via a custom property so the typed Link seam
 *  (which accepts no `style`) stays untouched. */
type AccentVars = CSSProperties & { "--vendor-card-accent"?: string };

export interface VendorCardProps {
  /** Vendor display name. */
  name: string;
  /** Short italic tagline. */
  tagline: string;
  /** Destination href for the whole card. */
  href: string;
  /**
   * Per-sub-brand accent for the top border + name. Applied via inline style,
   * NOT a token, so each vendor stays visually distinct.
   */
  accentColor?: string;
  /** CTA label. Defaults to the canonical "Visit the shop →". */
  cta?: string;
}

/**
 * Marketplace vendor card. Presentational — Link is injected through context,
 * no `next/*`. The per-sub-brand accent is a prop, all else is `--grove-*`.
 */
export function VendorCard({
  name,
  tagline,
  href,
  accentColor,
  cta = "Visit the shop →",
}: VendorCardProps) {
  const Link = useGroveLink();

  const accentStyle: AccentVars | undefined = accentColor
    ? { "--vendor-card-accent": accentColor }
    : undefined;

  return (
    <div className="vendor-card-wrap" style={accentStyle}>
      <Link href={href} className="vendor-card">
        <h3 className="vendor-card__name">{name}</h3>
        <p className="vendor-card__tagline">{tagline}</p>
        <span className="vendor-card__cta">{cta}</span>
      </Link>
    </div>
  );
}
