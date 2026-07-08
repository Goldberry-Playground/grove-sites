import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Workshop — opening October 2026",
  description:
    "GGG Woodworking's first pieces arrive October 2026. Milled on-site, air-dried four to six years, bench-built one at a time.",
};

// Coming-soon state: GGG has no inventory yet. This page is intentionally
// static and makes NO Odoo calls — the previous catalog + mock-product
// fallback rendered fake demo pieces, which reads worse than honesty.
// Flip back to the catalog page (git history) when the first run is entered
// in Odoo and the hub vendor's `comingSoon` flag is removed.
export default function ShopPage() {
  return (
    <div className="timber-shop">
      {/* Lodge header — same frame the catalog page used */}
      <div className="timber-header">
        <span className="notch-tl" aria-hidden="true" />
        <span className="notch-br" aria-hidden="true" />
        <div className="cross-beam" aria-hidden="true" />
        <h1>
          The <em>Workshop</em>
        </h1>
        <p className="header-sub">Handcrafted in West Virginia</p>
      </div>

      <div className="beam-divider" aria-hidden="true" />

      <section className="timber-coming-soon">
        <p className="timber-coming-soon__lede">
          The workshop is warming up, first pieces will fall in place this
          October 2026.
        </p>
        <p className="timber-coming-soon__body">
          We mill from timber felled on this land, air-dry it four to six
          years, and bench-build one piece at a time. The first run is curing
          now — walnut, cherry, and white oak.
        </p>
        <nav className="timber-coming-soon__links" aria-label="While you wait">
          <Link href="/blog">Follow the build in the journal →</Link>
          <Link href="/">Back to the homestead →</Link>
        </nav>
      </section>
    </div>
  );
}
