import type { CatalogNav } from "@grove/odoo-client";
import { odoo } from "./clients";
import { mockCatalogNav } from "../data/nav";

/**
 * Catalog-nav seam for the shop surfaces (GOL-2745).
 *
 * Odoo is the source of truth for the department tree; this module is the one
 * place the storefront reads it, with the same Odoo-first / mock-fallback
 * posture `/shop` already uses for products. Every shop page calls
 * `getCatalogNav()`, so the tab row, the department pages, the Guilds link and
 * grouped search all agree on one tree per request.
 */

export interface CatalogNavResult {
  nav: CatalogNav;
  /** True when the tree came from `data/nav.ts`, not Odoo. The shop pages
   *  already surface a "Demo catalog" notice on the mock product path; this
   *  lets a caller reason about the nav's provenance too. */
  usingMockNav: boolean;
}

/**
 * Fetch the department tree. Never throws: a backend that predates
 * `/catalog/nav` (every backend until Ada's grove_headless PR lands) and a
 * dead Odoo both fall back to the mock tree, so the storefront ships the
 * departments ahead of the data.
 */
export async function getCatalogNav(): Promise<CatalogNavResult> {
  try {
    const nav = await odoo.catalog.nav();
    // An empty tree is a backend that answered but has nothing filed yet —
    // rendering a nav with no tabs would hide /shop's own department, so fall
    // back rather than paint an empty bar.
    if (nav.departments.length > 0) return { nav, usingMockNav: false };
  } catch {
    // Route absent / Odoo unreachable — fall through to the mock tree.
  }
  return { nav: mockCatalogNav, usingMockNav: true };
}

// NOTE: the pure department rules live in `./departments` and are imported
// from there directly, by server and client alike. They are deliberately NOT
// re-exported here — this module pulls in the server-only Odoo client, and a
// convenience re-export is exactly how that ends up in a client bundle again.
