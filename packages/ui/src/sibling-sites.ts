/**
 * Cross-tenant sibling URL resolution.
 *
 * The four Grove sites (hub + 3 tenants) link to each other in the
 * SiblingStrip + various footers. The URLs that should appear in those
 * links depend on which ENV the user is currently on:
 *
 *   - PROD: hub at gatheringatthegrove.com; each tenant at its own domain
 *   - QA:   hub at qa.gatheringatthegrove.com; tenants at <tenant>.qa.gatheringatthegrove.com
 *   - Local dev / preview / other: prod URLs (no harm; cross-tenant nav
 *     just leaves the dev env, which is the expected behavior)
 *
 * This module is the single source of truth for that resolution.
 *
 * Usage from a SERVER component (Next.js App Router):
 *
 *   import { headers } from 'next/headers';
 *   import { siblingSitesForHost } from '@grove/ui';
 *
 *   const host = (await headers()).get('host');
 *   const sites = siblingSitesForHost(host);
 *
 * Pass `sites` down to the SiblingStrip client component as a prop, so the
 * server-rendered HTML and the client-hydrated HTML agree (no hydration
 * mismatch). Don't read `window.location.hostname` from a client component
 * for this purpose -- the SSR pass wouldn't have access and you'd get a
 * mismatch warning.
 */

export type Site = { name: string; href: string };

const PROD_SITES: Site[] = [
  { name: "Gather at the Grove", href: "https://gatheringatthegrove.com" },
  { name: "Goldberry Grove Farm", href: "https://goldberrygrove.farm" },
  { name: "At The Grove Nursery", href: "https://atthegrovenursery.com" },
  { name: "GGG Woodworking", href: "https://woodworkingeorge.com" },
];

const QA_SITES: Site[] = [
  { name: "Gather at the Grove", href: "https://qa.gatheringatthegrove.com" },
  { name: "Goldberry Grove Farm", href: "https://goldberry.qa.gatheringatthegrove.com" },
  { name: "At The Grove Nursery", href: "https://nursery.qa.gatheringatthegrove.com" },
  { name: "GGG Woodworking", href: "https://ggg.qa.gatheringatthegrove.com" },
];

/**
 * Pick the cross-tenant URL set based on the current request's hostname.
 *
 * Detection: a hostname under the QA zone (`qa.gatheringatthegrove.com` or
 * any subdomain of it) returns QA URLs; anything else returns prod URLs.
 *
 * Anything that's neither (local dev, custom preview hostnames, future envs)
 * gets prod URLs by default. Acceptable -- the cross-tenant link just leaves
 * the dev env. If a future env wants its own URL set, add a branch here.
 *
 * @param host - the request's `Host` header value (e.g. from `headers().get('host')`).
 *               May include a `:port` suffix; that's stripped before matching.
 *               Null/undefined returns prod URLs.
 */
export function siblingSitesForHost(host: string | null | undefined): Site[] {
  if (!host) return PROD_SITES;
  const h = host.toLowerCase().split(":")[0];
  const isQA = h === "qa.gatheringatthegrove.com" || h.endsWith(".qa.gatheringatthegrove.com");
  return isQA ? QA_SITES : PROD_SITES;
}
