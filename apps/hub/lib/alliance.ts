/**
 * /alliance — the Gather at the Grove alliance directory, which doubles as the
 * self-hosted link-in-bio (replaces hopp.bio/goldberry). /links permanently
 * redirects here (next.config.ts) so the bio URLs keep working and their
 * ?utm_source= carries through.
 *
 * Pure data + helpers so the page stays a thin render and every URL rule is
 * unit-tested (lib/__tests__/alliance.test.ts).
 */
import type { Site } from "@grove/ui";

export const ALLIANCE_CANONICAL = "https://gatheringatthegrove.com/alliance";

export const ALLIANCE_INTRO =
  "Gather at the Grove is a regenerative alliance of Appalachian agroforestry farms and value-added producers. We share land, knowledge, and resources to strengthen our community.";

export type SocialLink = { key: string; label: string; href: string };

// Hidden on the page for now (Josh, 2026-09-29); kept so they can come back.
export const SOCIAL_LINKS: SocialLink[] = [
  { key: "youtube", label: "YouTube", href: "https://www.youtube.com/@GoldberryGrove" },
  { key: "instagram", label: "Instagram", href: "https://www.instagram.com/goldberrygrove/" },
  { key: "threads", label: "Threads", href: "https://www.threads.net/@goldberrygrove" },
  { key: "discord", label: "Discord", href: "https://discord.gg/DXMjHBCsnG" },
  { key: "email", label: "Email", href: "mailto:sales@goldberrygrove.farm" },
];

export type MemberKey = "hub" | "nursery" | "goldberry" | "sweetpotomac" | "coalridge";

export type AllianceMember = {
  key: MemberKey;
  title: string;
  blurb: string;
  href: string;
  /** Public path of the member's logo; null renders a monogram tile. */
  logo: string | null;
  monogram: string;
};

type MemberSpec = Omit<AllianceMember, "href"> &
  // Grove sites resolve per environment via siblingSitesForHost (QA links stay
  // on QA); members outside the Grove stack have a fixed URL.
  ({ siteName: string } | { url: string });

const MEMBERS: MemberSpec[] = [
  {
    key: "hub",
    siteName: "Gather at the Grove",
    title: "Gather at the Grove",
    blurb: "Agroforestry village, learning hub & marketplace for all",
    logo: "/brand/gather/gather-logomark-reversed.svg",
    monogram: "GG",
  },
  {
    key: "nursery",
    siteName: "At The Grove Nursery",
    title: "At The Grove Nursery",
    blurb: "Mountain-strong woody perennials, grown for Appalachia",
    logo: "/brand/alliance/nursery-mark.png",
    monogram: "ATG",
  },
  {
    key: "goldberry",
    siteName: "Goldberry Grove Farm",
    title: "Goldberry Grove",
    blurb: "Agroforestry food forest & chestnut orchard, open for U-pick",
    logo: "/brand/alliance/goldberry-badge.png",
    monogram: "GB",
  },
  {
    key: "sweetpotomac",
    url: "https://sweetpotomacfarm.com/",
    title: "Sweet Potomac Farm & Studio",
    blurb: "Seneca Rocks farm & art studio, saving native seed",
    logo: null, // no logo published anywhere yet
    monogram: "SP",
  },
  {
    key: "coalridge",
    url: "https://www.facebook.com/coalridgehomestead/",
    title: "Coal Ridge Homestead",
    blurb: "Reclaimed mine land homestead — berries & baked goods",
    logo: "/brand/alliance/coal-ridge-homestead.jpg",
    monogram: "CR",
  },
];

export function allianceMembers(sites: Site[]): AllianceMember[] {
  return MEMBERS.flatMap((spec) => {
    const href = "url" in spec ? spec.url : sites.find((s) => s.name === spec.siteName)?.href;
    if (!href) return [];
    const { key, title, blurb, logo, monogram } = spec;
    return [{ key, title, blurb, logo, monogram, href }];
  });
}

/**
 * schema.org Organization for the alliance, listing each business as a
 * member. Always uses PROD member URLs (the canonical page is prod) — pass
 * members resolved from the prod host.
 */
export function allianceJsonLd(members: AllianceMember[]) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Gather at the Grove",
    url: "https://gatheringatthegrove.com",
    description: ALLIANCE_INTRO,
    areaServed: "Appalachia",
    member: members
      .filter((m) => m.key !== "hub")
      .map((m) => ({ "@type": "Organization", name: m.title, url: m.href, description: m.blurb })),
  };
}

export type TipId = "5" | "10" | "25" | "custom";

/**
 * Stripe Payment Links for Sponsor-a-Tree, one per amount; "custom" is a
 * "customer chooses price" link ($1 minimum, $15 suggested). All on the
 * Goldberry Grove LLC account (product prod_VLpjPjEGtj7OB7, 2026-09-29).
 * The tip section stays hidden unless all four are set.
 */
export const TIP_PAYMENT_LINKS: Record<TipId, string> = {
  "5": "https://buy.stripe.com/fZu7sMbP64kbb962Ln33W00",
  "10": "https://buy.stripe.com/7sYaEYcTag2T6SQ5Xz33W01",
  "25": "https://buy.stripe.com/14A9AU1ascQHgtqfy933W02",
  custom: "https://buy.stripe.com/3cIaEY06o6sj1ywbhT33W03",
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
