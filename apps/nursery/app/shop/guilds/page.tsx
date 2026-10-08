import type { Metadata } from "next";
import Link from "next/link";
import type { Product } from "@grove/odoo-client";
import { odoo } from "../../../lib/clients";
import { mockProducts } from "../../../data/mock-products";
import { getCatalogNav } from "../../../lib/catalog-nav";
import { GUILDS_SLUG, isGuildProduct, guildPurpose } from "../../../lib/departments";
import { DepartmentNav } from "../../department-nav";
import { GuildCard } from "./guild-card";

// Own title + canonical: without this the page inherits the site default and
// every `?`-suffixed variant would be a separate indexable URL (GOL-2878).
export const metadata: Metadata = {
  title: "Guilds",
  alternates: { canonical: "/shop/guilds" },
};

interface GuildsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `/shop/guilds` — the cross-department **Guilds** collection (GOL-2745).
 *
 * Guilds is a real static route, not a department tab: a guild can hold
 * products from several departments, so it isn't a peer of the tabs (spec
 * decision 4). A static segment also outranks the `[id]` product segment in
 * Next.js routing, so "guilds" can never be mistaken for a product id.
 *
 * Phase 1 sources the guilds from today's collection category — the five Food
 * Forest Packages — so this page ships without waiting on the Odoo restructure.
 */
export default async function GuildsPage({ searchParams }: GuildsPageProps) {
  await searchParams;
  const { nav } = await getCatalogNav();
  const guildsSlug = nav.guilds?.slug ?? GUILDS_SLUG;

  let catalog: Product[] = [];
  try {
    catalog = (await odoo.products.list({ limit: 200 })).products;
  } catch {
    catalog = mockProducts;
  }
  if (catalog.length === 0) catalog = mockProducts;

  // A guild is anything filed under the collection category, matched by the
  // nav's slug OR the pre-restructure one the backend still serves. Reading
  // membership off the product's own categories (not a hardcoded id) means the
  // Odoo restructure — which keeps category 6's id but renames it to "Guilds" —
  // needs no change here.
  const guilds = catalog.filter((p) => isGuildProduct(p, guildsSlug));

  // The one-line purpose lives in each guild's description, which the LIST
  // endpoint doesn't carry — so the cards need a detail read each. Bounded by
  // construction (there are five guilds, and the collection is curated, not a
  // catalog), fetched in parallel, and each failure degrades to a card without
  // a purpose line rather than taking the page down.
  const purposes = new Map<number, string>();
  await Promise.all(
    guilds.map(async (guild) => {
      try {
        const detail = await odoo.products.get(guild.id);
        const purpose = guildPurpose(detail.description);
        if (purpose) purposes.set(guild.id, purpose);
      } catch {
        // No purpose line for this card. Not worth failing the page over.
      }
    }),
  );

  return (
    <>
      <DepartmentNav nav={nav} activeSlug={guildsSlug} />

      <section className="section">
        <div className="section-header">
          <h1>{nav.guilds?.name ?? "Guilds"}</h1>
          <span className="section-tag">
            {guilds.length === 1 ? "1 guild" : `${guilds.length} guilds`}
          </span>
        </div>
        <p className="section-lede">
          {nav.guilds?.teaser ?? "Plants that grow better together."}
        </p>

        {guilds.length === 0 ? (
          // Empty state gets the same care as the happy path: say what a guild
          // is and offer the way back, rather than showing a bare heading.
          <div className="shop-empty">
            <p>
              No guilds are made up just yet. They&rsquo;re curated sets that
              plant well together, and the first ones are being put together
              now.{" "}
              <Link href="/shop" className="shop-empty__link">
                Browse the full catalog
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="guild-grid">
            {guilds.map((guild) => (
              <GuildCard
                key={guild.id}
                guild={guild}
                purpose={purposes.get(guild.id) ?? null}
                // Plant chips come from the guild's cross-cutting tags until the
                // bundle's components are on the list endpoint (GOL-2589 BoMs).
                // Best-effort by design: an empty list renders no chip row
                // rather than an invented one.
                plants={guild.tags ?? []}
                departments={guild.department ? [guild.department.name] : []}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
