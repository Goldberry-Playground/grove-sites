import Link from "next/link";
import { assetPath } from "@grove/ui";
import { CaptureForm } from "@grove/ui-kit";
import { CategoryBar } from "./category-bar";
import { NURSERY_CATEGORIES } from "../data/categories";
import { FeaturedLeadSellers, fetchCatalog } from "./featured-lead-sellers";

// At The Grove Nursery homepage — port of wireframes/nursery/index.html.
// Sections in wireframe order: cat-bar → pano-hero → qsearch → lead-sellers →
// with-sidebar → split-band.
//
// The category bar is now a shared server component that fetches the live
// product list (Odoo or mock) and renders counts. Clicking a pill navigates
// to /shop?cat=<slug>, which filters the catalog. On the homepage no pill is
// "active" — the bar is purely a discovery surface.
//
// GOL-659 — Josh: "none of those [links] navigate anywhere specific." Every
// hero CTA, the quick-search band, and each featured card now resolves to a
// real route, and the featured row is data-driven (see FeaturedLeadSellers)
// around our curated lead sellers rather than hardcoded markup.

// Render per-request so the data-driven lead-seller row (and the CategoryBar
// counts) reflect current Odoo state, and the build never bakes the mock
// fallback statically. Matches /shop; ISR returns once Odoo posts a
// revalidation webhook (Sprint 5).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // One catalog fetch for the whole page — feeds the hero "varieties" stat and
  // the data-driven lead-seller row so their counts always agree.
  const { products, total } = await fetchCatalog();

  return (
    <>
      <CategoryBar />

      <section
        className="pano-hero"
        // Verified content: a spring apple orchard in full white bloom over
        // dandelion-covered grass. Sourced from Wikimedia Commons
        // (Apple_orchard_Moscow_State_University_05.JPG, CC BY-SA 3.0),
        // compressed to webp @ 1800w.
        style={{ backgroundImage: `url('${assetPath("nursery", "hero/spring-orchard.webp")}')` }}
        role="img"
        aria-label="A spring apple orchard with rows of trees in full white bloom over grass dotted with yellow dandelions."
      >
        <div className="pano-content">
          <div>
            <div className="pano-eyebrow">Bare-root season · Through March 30</div>
            <h1>
              Fruit trees, berries &amp;<br />
              edible perennials —<br />
              <em>cold-climate, hard-grown,</em><br />
              shipped at the right week.
            </h1>
            <div className="pano-cta">
              <Link href="/shop" className="btn">Shop the catalog &rarr;</Link>
              <Link href="#lead-sellers" className="btn btn-outline">
                See this season&apos;s sellers &darr;
              </Link>
            </div>
          </div>
          <div className="pano-stats">
            <div className="pano-stat">
              <div className="num">{total}</div>
              <div className="label">Varieties in catalog</div>
            </div>
            <div className="pano-stat">
              <div className="num">USDA 3–7</div>
              <div className="label">Cold-hardy range</div>
            </div>
            <div className="pano-stat">
              <div className="num">2 yrs</div>
              <div className="label">Propagation in-house</div>
            </div>
            <div className="pano-stat">
              <div className="num">7-day</div>
              <div className="label">Bare-root ship window</div>
            </div>
          </div>
        </div>
      </section>

      {/* Real GET form → /shop?cat=<slug>. The category select drives the
          filter (its values are the live category slugs); the zone/pollination
          /rootstock selects are refinement hints not yet wired to the /shop
          facet params (sibling taxonomy issue) and so carry no `name` — the
          band always resolves to a real, filtered catalog page. */}
      <form className="qsearch" action="/shop" method="get">
        <h3>Find your tree.</h3>
        <div>
          <label htmlFor="qs-zone">USDA Zone</label>
          <select id="qs-zone" defaultValue="5">
            <option value="3">Zone 3</option>
            <option value="4">Zone 4</option>
            <option value="5">Zone 5 (the default)</option>
            <option value="6">Zone 6</option>
            <option value="7">Zone 7</option>
          </select>
        </div>
        <div>
          <label htmlFor="qs-cat">Category</label>
          {/* Options are the live taxonomy slugs (data/categories.ts), so this
              GET form resolves to a real, filtered /shop?cat=<slug> page. The
              old apple/pear/stone/nuts values were never real category slugs —
              filterByCategory fell through to the *full* catalog, so picking
              "Nuts" and searching returned everything. Data-driven off the same
              list the cat-bar uses keeps the two in lockstep (GOL-659). */}
          <select id="qs-cat" name="cat" defaultValue="fruit-trees">
            {NURSERY_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="qs-poll">Pollination</label>
          <select id="qs-poll" defaultValue="self">
            <option value="self">Self-fertile</option>
            <option value="partner">Needs partner</option>
            <option value="either">Either</option>
          </select>
        </div>
        <div>
          <label htmlFor="qs-root">Rootstock</label>
          <select id="qs-root" defaultValue="standard">
            <option value="standard">Standard</option>
            <option value="semi-dwarf">Semi-dwarf</option>
            <option value="dwarf">Dwarf</option>
            <option value="bush">Bush</option>
          </select>
        </div>
        <button type="submit">Browse →</button>
      </form>

      <FeaturedLeadSellers products={products} total={total} />

      <section className="with-sidebar">
        <div>
          <div className="section-header" style={{ marginBottom: "1.5rem" }}>
            <h2><em>How</em> we ship a fruit tree.</h2>
            <span className="section-tag">— A short field-guide</span>
          </div>
          <p style={{ fontSize: "1.05rem", marginBottom: "1.5rem", maxWidth: "60ch" }}>
            Every tree in our catalog is bare-root unless it says otherwise. We
            dig in late February when the wood is fully dormant, hold in a
            damp-sawdust cooler at 34°F, and ship in a seven-day window timed
            to your zone's last hard frost. The roots are wrapped in moist
            newspaper, the graft is sealed with horticultural wax, and a
            hand-written tag identifies the variety, rootstock, and the bed it
            was lifted from.
          </p>
          <p style={{ fontSize: "1.05rem", marginBottom: "1.5rem", maxWidth: "60ch" }}>
            Plant within ten days of arrival. Soak the roots in cool water for
            four hours before going in the ground. Don't fertilize the first
            year — let the tree spend its energy putting down roots, not
            pushing leaves it can't yet support.
          </p>
          {/* GOL-659 — /blog/planting-guide and /videos/bare-root were 404s.
              Point at real routes: the live blog hub, and the on-page lead
              form. Dedicated guide article + how-to video are a follow-up. */}
          <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", flexWrap: "wrap" }}>
            <Link href="/blog" className="btn btn-forest">Read the field guide</Link>
            <Link href="#notify" className="btn btn-outline">Get the ship-window alert</Link>
          </div>
        </div>

        <aside className="field-notes">
          <div className="field-notes-eyebrow">Field Notes — This Week</div>
          <h3>Bare-root shipping is open through March 30.</h3>
          <p>After March 30 we switch to potted stock. The same trees, just heavier to ship and less forgiving of late planting.</p>
          <ul>
            <li><span>Zone 3</span><strong>Ship Mar 22-27</strong></li>
            <li><span>Zone 4</span><strong>Ship Mar 14-20</strong></li>
            <li><span>Zone 5</span><strong>Ship Mar 7-13</strong></li>
            <li><span>Zone 6</span><strong>Now shipping</strong></li>
            <li><span>Zone 7</span><strong>Last call</strong></li>
          </ul>
        </aside>
      </section>

      <section className="split-band">
        <div
          className="split-img"
          // Verified content: honeybee perched on a pale-pink apple blossom in
          // direct sun. Sourced from Wikimedia Commons (Honey_bee_on_apple_
          // blossom_Sandy_Bedfordshire.jpg by Orangeaurochs, CC BY 2.0).
          style={{ backgroundImage: `url('${assetPath("nursery", "hero/pollination.webp")}')` }}
          role="img"
          aria-label="A honeybee resting in the center of a pale-pink apple blossom, with another open blossom in the foreground."
        />
        <div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", letterSpacing: "0.2em", color: "var(--orange)", textTransform: "uppercase" }}>
            A Note on Pollination
          </span>
          <h2>“Most fruit trees<br />are not single players.”</h2>
          <p>
            Roughly two-thirds of the catalog needs a second variety blooming
            within the same five-day window to set fruit. We tag every listing
            with its bloom period and a recommended partner from the same
            group. If you want one tree, plant a self-fertile.
          </p>
          <p>
            If the goal is a productive small orchard, we'll do the
            variety-matching for you — send us your zone, your space, and your
            harvest preferences, and we'll send back a three-tree plan and the
            partner-pollination calendar.
          </p>
          {/* /planting-plan was a 404 — no such route. Route the lead-gen CTA
              to the on-page email form (real, in-page); a dedicated
              planting-plan request form is a follow-up (see GOL-659 comment). */}
          <Link href="#notify" className="btn" style={{ marginTop: "1rem" }}>
            Request a planting plan &rarr;
          </Link>
        </div>
      </section>

      <section
        id="notify"
        className="with-sidebar"
        style={{ padding: "3rem 1.5rem", display: "flex", justifyContent: "center", scrollMarginTop: "2rem" }}
      >
        <CaptureForm
          brand="nursery"
          source="notify-me"
          label="nursery-restock"
          interests={["nursery"]}
          heading="Want us to tell you when these are back?"
          description="We grow in seasonal batches, so stock comes and goes. Leave your email and we'll send one note the week these trees are ready to ship again — that's it."
          submitLabel="Notify me"
          successMessage="You're on the list. We'll email you the week they're back."
          consentText="We'll only email you about this. Unsubscribe anytime."
        />
      </section>
    </>
  );
}
