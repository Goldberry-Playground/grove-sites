import type { SocialLink } from "@grove/ui";

// Goldberry Grove's own accounts (Josh, 2026-09-30) — the same set its card on
// the hub /alliance page links to. Clean profile URLs, no tracking params.
// Rendered in the footer and listed as `sameAs` in the homepage Organization
// block (GOL-4086), so the two cannot drift.
export const GOLDBERRY_SOCIALS: SocialLink[] = [
  { kind: "facebook", href: "https://www.facebook.com/goldberrygrove/" },
  { kind: "instagram", href: "https://www.instagram.com/goldberrygrove/" },
  { kind: "threads", href: "https://www.threads.com/@goldberrygrove" },
  { kind: "youtube", href: "https://www.youtube.com/@GoldberryGrove" },
];
