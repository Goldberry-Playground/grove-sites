/**
 * /links — the self-hosted link-in-bio page (replaces hopp.bio/goldberry).
 *
 * Pure data + helpers so the page stays a thin render and every URL rule is
 * unit-tested (lib/__tests__/links.test.ts).
 */
import type { Site } from "@grove/ui";

export type SocialLink = { key: string; label: string; href: string };

export const SOCIAL_LINKS: SocialLink[] = [
  { key: "youtube", label: "YouTube", href: "https://www.youtube.com/@GoldberryGrove" },
  { key: "instagram", label: "Instagram", href: "https://www.instagram.com/goldberrygrove/" },
  { key: "threads", label: "Threads", href: "https://www.threads.net/@goldberrygrove" },
  { key: "discord", label: "Discord", href: "https://discord.gg/DXMjHBCsnG" },
  { key: "email", label: "Email", href: "mailto:sales@goldberrygrove.farm" },
];

export type FarmLink = {
  key: "hub" | "nursery" | "goldberry";
  title: string;
  blurb: string;
  href: string;
};

// Keyed by the sibling-site name so the href comes from siblingSitesForHost()
// and QA links to QA, prod to prod. GGG Woodworking is deliberately absent —
// the bio page is the farm's.
const FARMS: Array<Omit<FarmLink, "href"> & { siteName: string }> = [
  {
    key: "hub",
    siteName: "Gather at the Grove",
    title: "Gather at the Grove",
    blurb: "Our village, journal & rewilding project",
  },
  {
    key: "nursery",
    siteName: "At The Grove Nursery",
    title: "At The Grove Nursery",
    blurb: "Native & nut trees, plus new Food Forest packages",
  },
  {
    key: "goldberry",
    siteName: "Goldberry Grove Farm",
    title: "Goldberry Grove",
    blurb: "U-pick orchard — come walk the rows",
  },
];

export function farmLinks(sites: Site[]): FarmLink[] {
  return FARMS.flatMap(({ siteName, ...farm }) => {
    const site = sites.find((s) => s.name === siteName);
    return site ? [{ ...farm, href: site.href }] : [];
  });
}

export type TipId = "5" | "10" | "25" | "custom";

/**
 * Stripe Payment Links for Sponsor-a-Tree, one per amount; "custom" is a
 * "customer chooses price" link. Created in the Stripe dashboard — paste the
 * https://buy.stripe.com/... URLs here. The tip section stays hidden until
 * all four are set.
 */
export const TIP_PAYMENT_LINKS: Record<TipId, string> = {
  "5": "",
  "10": "",
  "25": "",
  custom: "",
};

export type TipOption = { id: TipId; label: string; href: string };

const TIP_LABELS: Record<TipId, string> = { "5": "$5", "10": "$10", "25": "$25", custom: "Other" };

export function tipOptions(links: Record<TipId, string> = TIP_PAYMENT_LINKS): TipOption[] | null {
  const ids: TipId[] = ["5", "10", "25", "custom"];
  if (!ids.every((id) => isHttpsUrl(links[id]))) return null;
  return ids.map((id) => ({ id, label: TIP_LABELS[id], href: links[id] }));
}

const DEFAULT_SOURCE = "linkinbio";

/**
 * Where the visitor came from, from the incoming ?utm_source= (the bio link
 * on each platform carries its own). Restricted to a short slug so it can be
 * echoed into outbound URLs safely.
 */
export function normalizeSource(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const slug = (value ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
  return slug || DEFAULT_SOURCE;
}

/** Tag an outbound web link so the destination site's analytics can attribute it. */
export function withUtm(href: string, source: string): string {
  if (!isHttpsUrl(href)) return href;
  const url = new URL(href);
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "link_in_bio");
  return url.toString();
}

function isHttpsUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
