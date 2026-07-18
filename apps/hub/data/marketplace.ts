/**
 * V0 source of truth for the hub's editorial overlay.
 *
 * The hub stores *opinions* (featured status, editorial notes, cross-links),
 * not *inventory*. Canonical product data always reads from each vendor's
 * grove_headless API at render time (ISR-cached).
 *
 * Schema upgrade path: this TS file → SQLite → Postgres when vendor count or
 * editorial volume warrants. The shape below is portable to a relational schema.
 *
 * See docs/superpowers/specs/2026-05-18-grove-hub-marketplace-pivot-design.md §4.
 */

/** Pointer into any vendor's grove_headless catalog. Hub stores no product copy. */
export type ProductRef = {
  vendor: string;          // matches Vendor.slug
  productSlug: string;     // grove_slug from the vendor's Odoo
};

/** A village member. All vendors run Odoo + Stripe + grove_headless. */
export type Vendor = {
  slug: string;            // url-safe: "goldberry" | "nursery" | "ggg"
  name: string;
  tagline: string;
  story: string;           // markdown — renders on /marketplace/vendor/[slug]
  brandColor: string;      // hex — accent on hub vendor card / link hover
  homepageUrl: string;     // where "Visit <vendor>" sends them

  /** Where the hub pulls canonical products via grove_headless. */
  odoo: {
    apiUrl: string;        // e.g. http://localhost:8069 (V0 shared)
    tenantSlug: string;    // X-Grove-Tenant header value
  };

  /** Hard-redirect target for "Buy at <vendor>". {productId} is interpolated.
   *  Defaults to: `${homepageUrl}/shop/cart/update?product_id={productId}&add_qty=1`
   *  Override only if vendor's Odoo lives at a different domain than homepage. */
  checkoutTemplate?: string;

  /** Pre-launch state. When set, the hub renders this line instead of a
   *  product grid and never calls the vendor's Odoo. Must be EXPLICIT —
   *  never inferred from an empty catalog, because "zero products" and
   *  "vendor's Odoo is unreachable" are indistinguishable at fetch time
   *  and an outage must not read as "coming soon". */
  comingSoon?: string;
};

/** Curated for the marketplace home + journal embeds. Order matters. */
export type FeaturedSlot = {
  ref: ProductRef;
  editorialNote?: string;  // ≤ 120 chars — pull-quote on the card
  weekOf?: string;         // ISO date — optional weekly rotation
};

/** Cross-link from a journal post to a product. Many-to-many. Optional. */
export type JournalProductLink = {
  postSlug: string;        // Ghost post slug
  ref: ProductRef;
  position: "inline" | "sidebar" | "footer";
};

export type Marketplace = {
  vendors: Vendor[];
  featured: FeaturedSlot[];
  journalLinks: JournalProductLink[];
};

// ─── V0 data ────────────────────────────────────────────────────────────────

const ODOO_API_URL = process.env.GROVE_ODOO_URL ?? "http://localhost:8069";

export const marketplace: Marketplace = {
  vendors: [
    {
      slug: "goldberry",
      name: "Goldberry Grove Farm",
      tagline:
        "Regenerative agroforestry rooted in the chestnut — Appalachian land, Korean heritage.",
      story: [
        "Goldberry Grove is a twenty-acre regenerative agroforestry orchard and tree nursery in Nicholas County, West Virginia, founded in December 2024 by Abigail and Josh Dunbar — two years in, still in the first chapter.",
        "",
        "The chestnut is the anchor: an agroforestry keystone and a family story through Abigail's Korean heritage. We farm with JADAM and Korean Natural Farming principles — fermented soil amendments, no GMO stock, naturally grown trees in air-pruning beds. Chestnut and hazelnut canopy, pawpaw and pear sub-canopy, elderberry and hazel shrubs, ramps and medicinals on the forest floor, shiitake on hardwood logs alongside. Every product in our catalog comes from this hillside or its immediate edge.",
      ].join("\n"),
      brandColor: "#5A2A4B",
      homepageUrl: "https://goldberrygrove.farm",
      odoo: { apiUrl: ODOO_API_URL, tenantSlug: "goldberry" },
    },
    {
      slug: "nursery",
      name: "At The Grove Nursery",
      tagline:
        "Cold-hardy fruit & nut trees propagated on-site in Appalachian WV.",
      story: [
        "At The Grove Nursery propagates cold-climate fruit trees, berries, and edible perennials on the same Goldberry Grove hillside.",
        "",
        "Every tree we ship was grafted in our beds, lined out for two years, and lifted bare-root in February. Zones 5–7. We don't sell anything we didn't grow.",
      ].join("\n"),
      brandColor: "#1F3F2B",
      homepageUrl: "https://atthegrovenursery.com",
      odoo: { apiUrl: ODOO_API_URL, tenantSlug: "nursery" },
    },
    {
      slug: "ggg",
      name: "GGG Woodworking",
      tagline:
        "Furniture from the trees of the land — walnut, cherry, white oak.",
      story: [
        "GGG Woodworking is a one-bench shop in the old hay barn at Goldberry Grove.",
        "",
        "We mill from felled-on-site timber, air-dry it four to six years, and bench-build one piece at a time. Twelve pieces a year, sometimes thirteen, never twenty.",
      ].join("\n"),
      brandColor: "#3A2418",
      homepageUrl: "https://woodworkingeorge.com",
      odoo: { apiUrl: ODOO_API_URL, tenantSlug: "ggg" },
      comingSoon:
        "The workshop is warming up, first pieces will fall in place this October 2026.",
    },
  ],

  featured: [
    // CEO product decision (2026-07-18, GOL-439): the two Goldberry sticker
    // SKUs (samoyed-goldberry-grove-stickers, cryptid-support-forests-stickers)
    // do NOT exist in the sanitized QA/preview snapshot and won't until the
    // Goldberry catalog is built (GOL-104, ~2026-07-21+). An unresolved featured
    // ref is silently dropped by fetchFeaturedProducts, so both slots rendered
    // an empty featured row (GOL-400).
    //
    // Retarget, don't seed fake products: feature the real, seeded nursery
    // sticker (grove_slug "sticker", At The Grove Nursery) so the row proves the
    // render path with a live product card. One slot on purpose — the sticker
    // also lists in the nursery section below, so a second identical card would
    // be a duplicate, not a second feature.
    //
    // Every slug here is guarded by the seeded-catalog check
    // (data/qa-catalog-snapshot.ts + __tests__/featured-slugs-resolve.test.ts,
    // regenerated by scripts/check-featured-slugs.mjs against the seeded Odoo).
    // Swap back to the Goldberry slugs once GOL-104 seeds them — the guard will
    // fail the build until they actually resolve.
    {
      ref: { vendor: "nursery", productSlug: "sticker" },
      editorialNote:
        "A little flag for the food-forest crowd — slaps onto a nursery pot, a water bottle, or truck glass.",
    },
  ],

  journalLinks: [
    // Empty in V0. Adds happen as journal posts are written with related products.
  ],
};

/** Resolve a Vendor by slug, or null if no such vendor. */
export function findVendor(slug: string): Vendor | null {
  return marketplace.vendors.find((v) => v.slug === slug) ?? null;
}

/** Build the hard-redirect URL for "Buy at <vendor>". */
export function buildCheckoutUrl(vendor: Vendor, productId: number): string {
  const template =
    vendor.checkoutTemplate ??
    `${vendor.homepageUrl}/shop/cart/update?product_id={productId}&add_qty=1`;
  return template.replace("{productId}", String(productId));
}
