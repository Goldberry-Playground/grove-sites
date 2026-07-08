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

/** All products from one vendor, used by /marketplace/vendor/[slug]. */
export async function fetchVendorProducts(vendorSlug: string): Promise<HubProduct[]> {
  const vendor = findVendor(vendorSlug);
  if (!vendor) return [];
  // Pre-launch vendors have no catalog to fetch; callers render
  // vendor.comingSoon instead of a grid.
  if (vendor.comingSoon) return [];

  try {
    const result = await clientForVendor(vendor).products.list({ limit: 100 });
    return result.products.map((p) => ({ product: p, vendor }));
  } catch {
    return [];
  }
}

/**
 * Resolve the editorial overlay's featured[] into hydrated products.
 * Silently drops refs whose product was deleted, whose vendor is unreachable,
 * or whose vendor isn't in the overlay.
 */
export async function fetchFeaturedProducts(): Promise<HubFeaturedProduct[]> {
  const resolved: HubFeaturedProduct[] = [];
  const resolutions = await Promise.all(
    marketplace.featured.map((slot) => resolveFeaturedSlot(slot)),
  );
  for (const r of resolutions) {
    if (r) resolved.push(r);
  }
  return resolved;
}

async function resolveFeaturedSlot(slot: FeaturedSlot): Promise<HubFeaturedProduct | null> {
  const hydrated = await fetchProductByVendorSlug(slot.ref.vendor, slot.ref.productSlug);
  if (!hydrated) return null;
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
