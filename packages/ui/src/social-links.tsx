// Shared social-account icons + link row, first used on the hub /alliance
// member cards and the Goldberry footer. Same approach as FooterContact:
// inline styles and `currentColor`, so each site sets the colour from its
// own footer/card CSS without a per-app copy of the icons.
import type { CSSProperties, ReactNode } from "react";

export type SocialKind = "facebook" | "instagram" | "threads" | "youtube" | "etsy";

export type SocialLink = { kind: SocialKind; href: string };

export const SOCIAL_LABELS: Record<SocialKind, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  threads: "Threads",
  youtube: "YouTube",
  etsy: "Etsy shop",
};

// 24×24 stroke glyphs, drawn with currentColor at a 1.8 line weight.
const GLYPHS: Record<SocialKind, ReactNode> = {
  facebook: <path d="M15 4h-2.5A3.5 3.5 0 0 0 9 7.5V10H7v3h2v7h3v-7h2.5l.5-3H12V8a1 1 0 0 1 1-1h2z" />,
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="0.6" />
    </>
  ),
  threads: (
    <path d="M17 8.5C16 5.5 13.8 4 11.5 4 7.5 4 5 7.2 5 12s2.5 8 6.8 8c3.2 0 5.7-1.8 5.7-4.6 0-2.5-2-4-5-4-2.3 0-3.8 1.1-3.8 2.7 0 1.4 1.2 2.3 2.8 2.3 2.8 0 4-2.3 4-6.4" />
  ),
  youtube: (
    <>
      <rect x="2.5" y="5.5" width="19" height="13" rx="3.5" />
      <path d="M10 9.5v5l4.5-2.5z" />
    </>
  ),
  etsy: (
    <>
      <path d="M6 8h12l-1 12H7L6 8z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </>
  ),
};

/** One social glyph (decorative — label the link around it). */
export function SocialIcon({ kind, size = 20 }: { kind: SocialKind; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[kind]}
    </svg>
  );
}

export interface SocialLinksProps {
  links: SocialLink[];
  /** Whose accounts these are — used in each link's accessible name. */
  owner: string;
  /** Draw a thin currentColor ring around each 44px target (footer style). */
  ringed?: boolean;
  className?: string;
}

const listStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: "0.5rem",
  margin: 0,
  padding: 0,
  listStyle: "none",
};

/** A row of icon links with 44px tap targets and "Owner on Platform" names. */
export function SocialLinks({ links, owner, ringed = false, className }: SocialLinksProps) {
  if (links.length === 0) return null;
  const linkStyle: CSSProperties = {
    width: 44,
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    color: "inherit",
    boxSizing: "border-box",
    border: ringed ? "1.5px solid currentColor" : undefined,
  };
  return (
    <ul className={className} style={listStyle} aria-label={`${owner} on social media`}>
      {links.map((s) => (
        <li key={s.kind}>
          <a href={s.href} rel="noopener" aria-label={`${owner} on ${SOCIAL_LABELS[s.kind]}`} style={linkStyle}>
            <SocialIcon kind={s.kind} />
          </a>
        </li>
      ))}
    </ul>
  );
}
