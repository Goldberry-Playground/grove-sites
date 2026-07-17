import "server-only";

import type { Product } from "@grove/odoo-client";
import {
  marketplace,
  findVendor,
  type FeaturedSlot,
  type Vendor,
} from "../data/marketplace";
import { clientForVendor } from "./clients";

/** Federated product hydrated with its vendor for hub rendering. */
export type HubProduct = {
  product: Product;
  vendor: Vendor;
};

/** Featured product with the editorial overlay attached. */
export type HubFeaturedProduct = HubProduct & {
  editorialNote?: string;
};

/**
 * Outcome of a vendor catalog fetch.
 *
 * `empty` and `unreachable` are deliberately distinct. The vendor's Odoo
 * answering "0 products" and the vendor's Odoo not answering at all are
 * different facts, and the hub states a different one to the reader for each.
 * Collapsing them into `[]` is what let /marketplace/vendor/goldberry tell
 * visitors the catalog was "currently unreachable" while that Odoo was up and
 * simply had no rows in it (GOL-400).
 *
 * `coming-soon` short-circuits before any network call — a pre-launch vendor
 * is an editorial fact from the overlay, never inferred from a fetch result.
 */
export type VendorCatalog =
  | { state: "ok"; products: HubProduct[] }
  | { state: "empty" }
  | { state: "unreachable" }
  | { state: "coming-soon"; message: string };

/** Single product page payload. */
export async function fetchProductByVendorSlug(
  vendorSlug: string,
  productSlug: string,
): Promise<HubProduct | null> {
  const vendor = findVendor(vendorSlug);
  if (!vendor) return null;

  try {
    const product = await clientForVendor(vendor).products.getBySlug(productSlug);
    if (!product) return null;
    return { product, vendor };
  } catch {
    // Vendor unreachable. Caller renders a partition-tolerant fallback.
    return null;
  }
}

/**
 * One vendor's catalog, with reachability preserved.
 * Used by /marketplace and /marketplace/vendor/[slug] to render a state that
 * matches what actually happened.
 */
export async function fetchVendorCatalog(vendorSlug: string): Promise<VendorCatalog> {
  const vendor = findVendor(vendorSlug);
  if (!vendor) return { state: "unreachable" };
  if (vendor.comingSoon) return { state: "coming-soon", message: vendor.comingSoon };

  try {
    const result = await clientForVendor(vendor).products.list({ limit: 100 });
    if (result.products.length === 0) return { state: "empty" };
    return {
      state: "ok",
      products: result.products.map((p) => ({ product: p, vendor })),
    };
  } catch (err) {
    console.warn(
      `[marketplace] vendor "${vendorSlug}" catalog unreachable at ${vendor.odoo.apiUrl}:`,
      err instanceof Error ? err.message : err,
    );
    return { state: "unreachable" };
  }
}

/**
 * Products only, for callers that genuinely don't care why a catalog is empty
 * (search). Anything that renders a vendor's own section wants
 * `fetchVendorCatalog` so it can tell an outage from an empty shelf.
 */
export async function fetchVendorProducts(vendorSlug: string): Promise<HubProduct[]> {
  const catalog = await fetchVendorCatalog(vendorSlug);
  return catalog.state === "ok" ? catalog.products : [];
}

/**
 * Resolve the editorial overlay's featured[] into hydrated products.
 *
 * Unresolvable refs are still dropped from the reader's view — a visitor should
 * not be shown a hole where a curator's typo was. But they are no longer
 * dropped *quietly*: each one warns server-side with the ref that failed, so a
 * stale slug surfaces in logs instead of only as an empty row on the page.
 * Callers must treat an empty return as "render no featured section at all".
 */
export async function fetchFeaturedProducts(): Promise<HubFeaturedProduct[]> {
  const resolutions = await Promise.all(
    marketplace.featured.map((slot) => resolveFeaturedSlot(slot)),
  );
  const resolved = resolutions.filter((r): r is HubFeaturedProduct => r !== null);

  const dropped = marketplace.featured.length - resolved.length;
  if (dropped > 0) {
    console.warn(
      `[marketplace] ${dropped}/${marketplace.featured.length} featured ref(s) did not resolve; ` +
        `the featured section will be hidden if none do.`,
    );
  }
  return resolved;
}

async function resolveFeaturedSlot(slot: FeaturedSlot): Promise<HubFeaturedProduct | null> {
  const hydrated = await fetchProductByVendorSlug(slot.ref.vendor, slot.ref.productSlug);
  if (!hydrated) {
    console.warn(
      `[marketplace] featured ref unresolved: vendor="${slot.ref.vendor}" ` +
        `productSlug="${slot.ref.productSlug}" (no such product, or vendor unreachable)`,
    );
    return null;
  }
  return { ...hydrated, editorialNote: slot.editorialNote };
}

/**
 * Search products across all vendors. Used by the marketplace landing search input.
 * Hub-side full-text matching against name + sku is sufficient for V0 catalog size.
 */
export async function searchProducts(query: string): Promise<HubProduct[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const allByVendor = await Promise.all(
    marketplace.vendors.map((v) => fetchVendorProducts(v.slug)),
  );
  const all = allByVendor.flat();
  return all.filter((hp) => {
    const hay = `${hp.product.name} ${hp.product.sku ?? ""}`.toLowerCase();
    return hay.includes(q);
  });
}
