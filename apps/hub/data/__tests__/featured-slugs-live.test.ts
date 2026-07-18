import { describe, expect, it } from "vitest";
import { marketplace, findVendor } from "../marketplace";
import { clientForVendor } from "../../lib/clients";

/**
 * Live seeded-Odoo gate for featured[].
 *
 * Skipped in normal CI (no Odoo reachable). When GROVE_ODOO_URL points at a
 * seeded Odoo — the GOL-144 preview env or grove-qa-l3-odoo — this asserts that
 * every featured slug actually resolves (getBySlug !== null), i.e. does NOT
 * return count=0. Run it in the preview pipeline for a live gate on top of the
 * every-PR snapshot check (featured-slugs-resolve.test.ts):
 *
 *     GROVE_ODOO_URL=<seeded-odoo-url> pnpm --filter @grove/hub test featured-slugs-live
 *
 * Optional auth via GROVE_ODOO_API_KEY (Bearer), matching createOdooClient.
 */
const odooUrl = process.env.GROVE_ODOO_URL;

describe.runIf(odooUrl)("featured slugs resolve against the live seeded Odoo", () => {
  it.each(marketplace.featured.map((s) => [s.ref.vendor, s.ref.productSlug]))(
    "%s / %s resolves to a live product",
    async (vendorSlug, productSlug) => {
      const vendor = findVendor(vendorSlug);
      expect(vendor, `featured vendor "${vendorSlug}" is unknown`).not.toBeNull();

      const product = await clientForVendor(vendor!).products.getBySlug(productSlug);
      expect(
        product,
        `featured slug "${vendorSlug}/${productSlug}" returned count=0 from the seeded Odoo — ` +
          `it would render an empty featured row (GOL-400). Retarget it or seed the product.`,
      ).not.toBeNull();
    },
  );
});
