import type { Metadata } from "next";
import Link from "next/link";
import { notFoundMetadata } from "../lib/pdp-metadata";

export const metadata: Metadata = notFoundMetadata();

/**
 * Site-wide 404 (GOL-3601). Until the slug route shipped, an unknown
 * `/shop/<x>` answered 200 and this file did not exist, so nobody saw Next's
 * unstyled default. Unknown products, retired departments and stale links now
 * get a real 404 status, and this is the page they land on. It reuses the
 * catalog empty-state treatment and routes the shopper somewhere real.
 */
export default function NotFound() {
  return (
    <section className="section">
      <div className="section-header">
        <h1>
          That page isn&apos;t <em>in the ground.</em>
        </h1>
        <span className="section-tag">Page not found</span>
      </div>
      <div className="shop-empty">
        <p>
          The link may be old, or the plant may have moved on. Everything we&apos;re growing
          this season is in the{" "}
          <Link href="/shop" className="shop-empty__link">
            plant catalog
          </Link>
          , or you can head back to the{" "}
          <Link href="/" className="shop-empty__link">
            home page
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
