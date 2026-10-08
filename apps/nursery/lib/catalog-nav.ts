import type { CatalogNav } from "@grove/odoo-client";
import { odoo } from "./clients";
import { fallbackCatalogNav, mockCatalogNav } from "../data/nav";

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
 * `/catalog/nav` and a dead Odoo both fall back. In production the fallback is
 * the Orchard + Guilds tree only, so an Odoo hiccup can never paint the mock's
 * placeholder coming-soon departments and unapproved copy on the live shop.
 * Local dev keeps the full mock IA for screenshots and review.
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
  return {
    nav: process.env.NODE_ENV === "production" ? fallbackCatalogNav : mockCatalogNav,
    usingMockNav: true,
  };
}

// NOTE: the pure department rules live in `./departments` and are imported
// from there directly, by server and client alike. They are deliberately NOT
// re-exported here — this module pulls in the server-only Odoo client, and a
// convenience re-export is exactly how that ends up in a client bundle again.
