import "server-only";

import { createOdooClient } from "@grove/odoo-client";
import { siblingSitesForHost } from "@grove/ui";
import { tenantSecrets } from "../tenant.secrets";

/**
 * GOL-3435: link-outs from /recipes to At The Grove Nursery.
 *
 * The nursery's PDPs live at `/shop/<product.template id>`, and those ids
 * differ between QA and prod. So a recipe links to `/recipes/trees/<tag>` and
 * this module resolves the tag's `grove_slug` against the same Odoo this
 * deploy reads (nursery tenant, like the hub's per-vendor clients) and the
 * nursery origin for this host (prod, QA, or preview), at request time.
 */

const nurseryOdoo = createOdooClient({
  tenantId: "nursery",
  odooUrl: tenantSecrets.odooUrl,
});

/** Nursery origin for the requesting host: atthegrovenursery.com or its QA twin. */
export function nurseryOrigin(host: string | null): string {
  const site = siblingSitesForHost(host).find((s) => s.name === "At The Grove Nursery");
  return (site?.href ?? "https://atthegrovenursery.com").replace(/\/+$/, "");
}

/**
 * The live nursery PDP for a `grove_slug`, or the nursery shop when the slug
 * has no published listing or Odoo is unreachable. Never a 404.
 */
export async function nurseryProductUrl(slug: string | undefined, host: string | null): Promise<string> {
  const origin = nurseryOrigin(host);
  if (!slug) return `${origin}/shop`;
  try {
    // One cached catalog read (30s Data Cache, shared with every tree link)
    // instead of a per-slug lookup. The nursery lists a few dozen products.
    const { products } = await nurseryOdoo.products.list({ limit: 200 });
    const hit = products.find((p) => p.slug === slug);
    return hit ? `${origin}/shop/${hit.id}` : `${origin}/shop`;
  } catch {
    return `${origin}/shop`;
  }
}
