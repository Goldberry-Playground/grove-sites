import { NextResponse } from "next/server";
import { searchProducts, fetchVendorProducts } from "../../../../lib/marketplace";

/**
 * BFF: federated product search across all configured vendors.
 *
 * GET /api/marketplace/products?q=<query>
 * GET /api/marketplace/products?vendor=<slug>
 *
 * Server-only — pages render through this for any non-static product lookup.
 * The route hides backend topology (multiple Odoo origins) from the browser.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const vendor = url.searchParams.get("vendor")?.trim() ?? "";

  if (vendor) {
    const products = await fetchVendorProducts(vendor);
    return NextResponse.json({
      count: products.length,
      results: products.map(serialize),
    });
  }

  if (q) {
    const products = await searchProducts(q);
    return NextResponse.json({
      count: products.length,
      results: products.map(serialize),
    });
  }

  return NextResponse.json({ count: 0, results: [] });
}

function serialize(hp: Awaited<ReturnType<typeof searchProducts>>[number]) {
  return {
    vendor: { slug: hp.vendor.slug, name: hp.vendor.name },
    product: {
      slug: hp.product.slug,
      name: hp.product.name,
      price: hp.product.price,
      currency: hp.product.currency,
      imageUrl: hp.product.imageUrl,
    },
  };
}
