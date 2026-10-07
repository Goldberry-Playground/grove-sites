import type { Metadata } from "next";
import type { Product } from "@grove/odoo-client";
import { resolveOdooImageUrl, withOdooImageSize } from "@grove/odoo-client";
import { PDP_SEO_COPY } from "../data/pdp-seo-copy";
import { tenantConfig } from "../tenant.config";
import {
  DEFAULT_OG_IMAGE,
  DEFAULT_OG_IMAGE_WIDTH,
  DEFAULT_OG_IMAGE_HEIGHT,
} from "./site-metadata";

/**
 * Per-product SEO metadata for the nursery PDP (GOL-2878 Phase 1).
 *
 * Before this, all 21 published PDPs served the same `<title>` and the same
 * `<meta description>` — `apps/nursery/app/layout.tsx` set `title` as a bare
 * string, and no storefront had a `generateMetadata` anywhere. A title tag is a
 * primary ranking input, so this is the larger half of the GOL-2875 finding;
 * the `/shop/[slug]` route is Phase 2.
 */

/**
 * Length window a feed-supplied description must land in to be usable.
 *
 * Measured against the three products that actually carry a
 * `grove_seo_description` on prod today (checked 2026-10-01 via the detail
 * endpoint): id 22 is **68** chars — a stub; id 93 is **179**; id 91 is
 * **302**. Google renders roughly 155–160, so the two long ones get cut
 * mid-sentence and the short one reads as half-filled next to a 140-char
 * sibling. None of the three is usable as written, which is why the window
 * exists rather than a bare non-empty check.
 */
export const FEED_DESCRIPTION_MIN_LENGTH = 100;
export const FEED_DESCRIPTION_MAX_LENGTH = 170;

/** Odoo's image ladder rung closest to the 1200px share-card width. */
const OG_IMAGE_RUNG = 1024;

function clean(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Title shown when a product has no staged copy — a new or un-archived
 * product, e.g. id 28 Shagbark Hickory, which is `is_published` but `active:
 * false` on prod today and would ship with no copy the moment it is restored.
 *
 * Just the product name. Deliberately no "Trees" suffix: the catalog holds
 * shrubs (serviceberry, buttonbush, winterberry) and multi-species bundles, so
 * a blanket suffix would be false for some of them. The brand half comes from
 * `title.template`.
 */
export function fallbackTitle(product: Pick<Product, "name">): string {
  return product.name;
}

/**
 * Description shown when a product has neither feed nor staged copy.
 *
 * Every clause here is true of any item in this catalog — nursery stock, grown
 * at the farm, in West Virginia. It asserts no species, no hardiness zone, no
 * stock state and no fulfilment promise, because none of those can be inferred
 * from a product name. A generic-but-true description still beats 21 pages
 * sharing one sentence, and it degrades safely for a product nobody reviewed.
 */
export function fallbackDescription(product: Pick<Product, "name">): string {
  return `${product.name} from At The Grove Nursery — nursery stock grown on our West Virginia hilltop farm. Sizes, pricing, and planting notes on the page.`;
}

/**
 * Resolve the title/description pair for a product.
 *
 * Precedence, highest first:
 *   1. The reviewed table in `data/pdp-seo-copy.ts`, keyed by template id.
 *   2. `product.seoDescription` (Odoo `grove_seo_description`), when it lands
 *      inside the length window above.
 *   3. The claim-free fallbacks above.
 *
 * ## Why reviewed copy beats the feed, against GOL-2878's original wording
 *
 * The ticket said to prefer `grove_seo_description` when non-empty, on the
 * understanding (GOL-2875 correction C3) that the API did not expose it at all.
 * It does — on the **detail** endpoint; C3 was reading the *list* serializer.
 * Rendering `/shop/93` with feed-first wired up showed what that actually
 * ships: American Chestnut got "A large, fast-growing deciduous tree in the
 * beech family…" — 179 chars of encyclopedia prose, truncated by Google
 * mid-sentence, in nobody's voice, and **silently dropping the "farm pickup
 * only — these do not ship" line** that GOL-2874 requires on that product.
 *
 * So the order is inverted deliberately: reviewed copy wins, and the feed is
 * the tier-2 source for products nobody has written copy for. To make an Odoo
 * edit authoritative for a product that IS in the table, delete its row — that
 * is a one-line change and an explicit handover, which is the right shape for
 * "this copy is now maintained in Odoo".
 *
 * Only the description has a feed source; there is no SEO-title field in Odoo,
 * so the title falls straight through to the reviewed table.
 */
export function resolvePdpCopy(product: Pick<Product, "id" | "name" | "seoDescription">): {
  title: string;
  description: string;
  /** Which tier each half came from — asserted in tests, handy when debugging. */
  source: { title: "staged" | "fallback"; description: "feed" | "staged" | "fallback" };
} {
  const staged = PDP_SEO_COPY[product.id];
  if (staged) {
    return {
      title: staged.title,
      description: staged.description,
      source: { title: "staged", description: "staged" },
    };
  }

  const feedDescription = clean(product.seoDescription);
  const useFeed =
    feedDescription !== null &&
    feedDescription.length >= FEED_DESCRIPTION_MIN_LENGTH &&
    feedDescription.length <= FEED_DESCRIPTION_MAX_LENGTH;

  return {
    title: fallbackTitle(product),
    description: useFeed ? feedDescription : fallbackDescription(product),
    source: { title: "fallback", description: useFeed ? "feed" : "fallback" },
  };
}

export interface PdpMetadataInput {
  product: Product;
  /**
   * Site-relative canonical path for this product, e.g. `/shop/93`. Passed in
   * rather than derived so Phase 2 can hand it the slug form (`/shop/<slug>`)
   * without touching this module — R1/R8 of the GOL-2875 redirect spec put the
   * canonical on the slug, and the id form 301s to it.
   */
  canonicalPath: string;
  /** Public Odoo origin, for turning a relative `/web/image/...` path absolute. */
  odooBase: string;
}

/**
 * Build the full `Metadata` object for one PDP: title, description, canonical,
 * Open Graph and Twitter card.
 *
 * `og:url` and `<link rel="canonical">` are both the same absolute URL (R8).
 * They resolve through `metadataBase`, which the root layout sets — without it
 * Next drops relative canonical/og:url entirely, which is why the site emitted
 * neither before this change.
 */
export function buildPdpMetadata({
  product,
  canonicalPath,
  odooBase,
}: PdpMetadataInput): Metadata {
  const { title, description } = resolvePdpCopy(product);

  // Product photo as the share card, at the largest rung below the 1200px card
  // width; the site card is the fallback when a product has no image at all.
  //
  // ⚠ Odoo serves `/web/image/...` as **image/webp unconditionally** — verified
  // 2026-10-01 against prod with `Accept: image/jpeg,image/png`, with no Accept
  // header, as `facebookexternalhit`, and with the `.jpg` filename and
  // `?download=1` forms. There is no JPEG variant to ask for. Some scrapers do
  // not render a WebP og:image, so a product card may still come up blank on
  // those; the fix is a Next `opengraph-image` route that transcodes, filed as
  // a follow-up rather than guessed at here. The site-level card
  // (`og-default.jpg`) is a JPEG, so the homepage and every non-PDP route are
  // unaffected.
  const productImage = resolveOdooImageUrl(
    withOdooImageSize(product.imageUrl, OG_IMAGE_RUNG),
    odooBase,
  );
  const images = productImage
    ? [{ url: productImage, alt: product.name }]
    : [
        {
          url: DEFAULT_OG_IMAGE,
          width: DEFAULT_OG_IMAGE_WIDTH,
          height: DEFAULT_OG_IMAGE_HEIGHT,
          alt: tenantConfig.name,
        },
      ];

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "website",
      siteName: tenantConfig.name,
      // Bare title, no brand suffix. Next DOES apply the root layout's
      // `openGraph.title.template` to a child's openGraph.title even when the
      // child replaces the whole openGraph object — adding the suffix here
      // rendered `og:title` as "… | At The Grove Nursery | At The Grove
      // Nursery". Caught by reading the served HTML, not by typecheck.
      title,
      description,
      url: canonicalPath,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((image) => image.url),
    },
  };
}

/**
 * Metadata for a PDP request that resolves to nothing — an unknown id, or a
 * product the feed will not return.
 *
 * `noindex` matters because the route currently answers HTTP 200 while
 * rendering Next's not-found body (GOL-2875 §1d); until that soft-404 is fixed,
 * the robots directive is the only thing keeping those URLs out of the index.
 */
export function notFoundMetadata(): Metadata {
  return {
    title: "Not found",
    robots: { index: false, follow: false },
  };
}
