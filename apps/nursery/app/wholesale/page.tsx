import type { Metadata } from "next";
import Link from "next/link";
import { CaptureForm } from "@grove/ui-kit";
import { CategoryBar } from "../category-bar";

// At The Grove Nursery — Wholesale & Trade landing.
//
// GOL-659: the shared category bar (category-bar.tsx) renders a trailing
// "Wholesale" link on the homepage and /shop. It pointed at /wholesale, which
// had no route and returned 404 — a live dead end, exactly the class of
// broken link Josh flagged ("none of those navigate anywhere specific"). This
// page gives that link a real, on-brand destination and a working inquiry
// capture so the nav no longer dead-ends.
//
// Built from the app's own design-system classes (.section, .with-sidebar,
// .field-notes, .btn) and the shared CaptureForm — no bespoke one-off styling.
// A richer trade-intake form (business name, species, volumes, ship dates) is
// a sensible follow-up; for now we capture the lead honestly and reply by hand.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wholesale & Trade — At The Grove Nursery",
  description:
    "Bare-root fruit trees, berries, and edible perennials at trade volume for landscapers, orchardists, CSAs, schools, and homestead co-ops. Cold-grown, hardy stock shipped at the right week.",
};

export default function WholesalePage() {
  return (
    <>
      <CategoryBar />

      <section className="section">
        <div className="section-header">
          <div>
            <span className="section-tag">Trade Program</span>
            <h1>
              Wholesale <em>&amp; trade</em>
            </h1>
          </div>
          <Link href="#inquire" className="btn">
            Start an inquiry &rarr;
          </Link>
        </div>
        <p className="section-lede" style={{ maxWidth: "62ch" }}>
          Same cold-grown, hard-grown stock we ship to homesteaders — at the
          volume a planting job needs. We supply bare-root fruit trees, berries,
          and edible perennials to landscapers, orchardists, CSAs, schools and
          municipalities, and homestead co-ops across USDA zones&nbsp;3–7.
        </p>
      </section>

      <div className="with-sidebar" style={{ paddingTop: 0 }}>
        <div>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              color: "var(--forest-deep)",
              marginBottom: "0.75rem",
            }}
          >
            Who it&apos;s for
          </h2>
          <p style={{ maxWidth: "60ch", marginBottom: "1.5rem" }}>
            If you plant for other people — a landscape crew putting in an
            edible hedge, an orchardist expanding a block, a school building a
            food-forest classroom, or a co-op splitting a bulk order — trade
            pricing and reserved propagation are made for you. We&apos;d rather
            grow to your planting calendar than have you chase retail stock.
          </p>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              color: "var(--forest-deep)",
              marginBottom: "0.75rem",
            }}
          >
            How it works
          </h2>
          <ol
            style={{
              maxWidth: "60ch",
              marginBottom: "1.5rem",
              paddingLeft: "1.2rem",
              lineHeight: 1.7,
            }}
          >
            <li>
              Send us your species list, quantities, ship-to zone, and target
              planting window using the form below.
            </li>
            <li>
              We confirm what we can lift from current stock and what we&apos;ll
              propagate to order, with trade pricing and a reserved lift date.
            </li>
            <li>
              Trees ship bare-root in a seven-day window timed to your
              zone&apos;s last hard frost — roots wrapped, grafts waxed, each
              tagged with variety, rootstock, and bed.
            </li>
          </ol>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              color: "var(--forest-deep)",
              marginBottom: "0.75rem",
            }}
          >
            What we grow
          </h2>
          <p style={{ maxWidth: "60ch" }}>
            Fruit trees, berries, and fruiting vines make up the current trade
            catalog; nut trees and regional natives are coming as that stock
            matures. Browse the live catalog to see what&apos;s bearing this
            season —{" "}
            <Link
              href="/shop"
              style={{ color: "var(--orange-deep)", textDecoration: "underline" }}
            >
              the full retail catalog
            </Link>{" "}
            is the same stock we grow at volume.
          </p>
        </div>

        <aside className="field-notes">
          <div className="field-notes-eyebrow">At a glance</div>
          <h3>Trade terms, plainly.</h3>
          <p>
            No membership, no gatekeeping — just volume pricing on hardy,
            honestly-grown stock and a lift date you can plan a crew around.
          </p>
          <ul>
            <li>
              <span>Minimum order</span>
              <strong>25 trees</strong>
            </li>
            <li>
              <span>Lead time</span>
              <strong>1 season</strong>
            </li>
            <li>
              <span>Ship window</span>
              <strong>7-day, by zone</strong>
            </li>
            <li>
              <span>Hardiness</span>
              <strong>USDA 3–7</strong>
            </li>
          </ul>
        </aside>
      </div>

      <section
        id="inquire"
        className="with-sidebar"
        style={{
          gridTemplateColumns: "1fr",
          justifyItems: "center",
          scrollMarginTop: "2rem",
        }}
      >
        <CaptureForm
          brand="nursery"
          source="newsletter-signup"
          label="nursery-wholesale"
          interests={["nursery", "wholesale"]}
          collectName
          heading="Start a wholesale inquiry"
          description="Leave your name and email and a one-line note about what you're planting — species, rough quantities, ship-to zone, and target window. Wesley reads these directly and replies with trade pricing and a lift date. (A full trade order form is on the way.)"
          submitLabel="Send inquiry"
          successMessage="Got it — thanks. Wesley will be in touch with trade pricing and next steps."
          consentText="We'll only use this to answer your wholesale inquiry. No list, no spam."
        />
      </section>
    </>
  );
}
