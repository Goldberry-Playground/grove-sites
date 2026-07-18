import { beforeAll, describe, expect, it } from "vitest";
import { createOdooClient } from "@grove/odoo-client";
import { marketplace, findVendor } from "../marketplace";

/**
 * GOL-440 — live half of the featured-slug guard.
 *
 * The hub's featured row is populated by fetchFeaturedProducts, which resolves
 * each featured[] ref against the vendor's grove_headless catalog and *silently
 * drops* any ref it can't resolve. That is convenient at render time (a single
 * missing product doesn't 500 the page) but dangerous at authoring time: a slug
 * that doesn't exist in the seeded catalog produces a blank row with no error.
 * GOL-400 was exactly that — two Goldberry slugs that never existed in the QA
 * snapshot.
 *
 * This test closes the gap by resolving every featured slug against the *live
 * seeded catalog*, the same way production does. It is gated behind an env flag
 * so the default `pnpm test` (which has no Odoo) skips it; a dedicated CI job
 * (.github/workflows/ci.yml → `featured-slug-guard`) sets the flag and points
 * GROVE_ODOO_URL at the seeded QA Odoo.
 *
 * Reachability policy: if the seeded Odoo is unreachable we *skip* rather than
 * fail, so a QA-droplet outage doesn't turn every unrelated PR red. A reachable
 * endpoint that is missing a featured slug is a hard failure — that's the whole
 * point of the guard.
 */

const ENABLED = process.env.FEATURED_SLUG_CHECK === "1";

describe.skipIf(!ENABLED)("featured slugs resolve against the seeded catalog", () => {
  let reachable = false;

  beforeAll(async () => {
    // Probe one vendor's health endpoint; all vendors share the same Odoo host
    // in QA. A network error or non-ok status means "can't determine" → skip.
    const probe = marketplace.vendors[0];
    try {
      const res = await fetch(`${probe.odoo.apiUrl}/grove/api/v1/health`, {
        headers: { "X-Grove-Tenant": probe.odoo.tenantSlug },
        signal: AbortSignal.timeout(15_000),
      });
      reachable = res.ok;
      if (!reachable) {
        console.warn(
          `[featured-slug-guard] seeded Odoo health returned ${res.status}; skipping (infra, not a slug gap).`,
        );
      }
    } catch (err) {
      console.warn(
        `[featured-slug-guard] seeded Odoo unreachable at ${probe.odoo.apiUrl}; skipping (infra, not a slug gap): ${String(err)}`,
      );
      reachable = false;
    }
  });

  it("has at least one featured slot to check", () => {
    expect(marketplace.featured.length).toBeGreaterThan(0);
  });

  for (const slot of marketplace.featured) {
    const ref = `${slot.ref.vendor}/${slot.ref.productSlug}`;
    it(`resolves ${ref}`, async (ctx) => {
      if (!reachable) {
        ctx.skip();
        return;
      }
      const vendor = findVendor(slot.ref.vendor);
      expect(vendor, `unknown vendor "${slot.ref.vendor}"`).not.toBeNull();

      const client = createOdooClient({
        tenantId: vendor!.odoo.tenantSlug,
        odooUrl: vendor!.odoo.apiUrl,
      });
      const product = await client.products.getBySlug(slot.ref.productSlug);

      expect(
        product,
        `featured slug "${slot.ref.productSlug}" returned count=0 from ${vendor!.slug}'s seeded catalog — the featured row will render this slot blank. Seed the product or retarget the slug.`,
      ).not.toBeNull();
    });
  }
});
