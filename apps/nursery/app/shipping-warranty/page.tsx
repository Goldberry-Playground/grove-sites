import type { Metadata } from "next";
import Link from "next/link";
import { CategoryBar } from "../category-bar";

// At The Grove Nursery — Shipping & Warranty policy page (GOL-967).
//
// Copy is BOARD-APPROVED and rendered verbatim from the `shipping-warranty-
// policy` document on GOL-944 (rev "FINAL", Josh 2026-07-30). Do not alter the
// terms, the state list, or any pricing language here.
//
// Geography + pricing are the system of record from the checkout shipping
// engine (`grove_headless` shipping-zone matrix, GOL-15): 21 states, no
// HI/AK/territories/international, live per-address rate at checkout billed at
// cost + handling, no free-ship threshold. Keep this page in sync with the
// engine — never hand-edit the state list or prices without a matching engine
// change. The state list below is spelled out to match the approved copy
// exactly (the engine owns eligibility; this is the human-readable mirror).
//
// Built from the app's own design-system classes (.section, .section-header,
// .section-tag, .section-lede, .with-sidebar, .field-notes) — no bespoke CSS.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shipping & Warranty — At The Grove Nursery",
  description:
    "How and where At The Grove Nursery ships live trees: 21 U.S. states, live per-address rates at cost plus handling, dormant-season shipping, local farm pickup, and our arrive-alive limited warranty.",
};

// Spelled out to match the board-approved copy exactly. Eligibility itself is
// enforced by the checkout shipping engine (GOL-15); this list is the
// human-readable mirror of that engine's 21-state map.
const SHIP_STATES =
  "Connecticut, Delaware, Illinois, Indiana, Kentucky, Maine, Maryland, Massachusetts, Michigan, Minnesota, New Hampshire, New Jersey, New York, North Carolina, Ohio, Pennsylvania, Rhode Island, Vermont, Virginia, West Virginia, and Wisconsin.";

export default function ShippingWarrantyPage() {
  return (
    <>
      <CategoryBar />

      <section className="section">
        <div className="section-header">
          <div>
            <span className="section-tag">Policies</span>
            <h1>
              Shipping <em>&amp; warranty</em>
            </h1>
          </div>
          <Link href="/shop" className="btn">
            Browse the catalog &rarr;
          </Link>
        </div>
        <p className="section-lede" style={{ maxWidth: "62ch" }}>
          At the Grove Nursery ships live trees within the United States to the{" "}
          <strong>21 states</strong> currently on our shipping map. We are a
          small West Virginia nursery and are expanding our shipping footprint
          deliberately over time — the list below reflects where we can ship
          today.
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
            Where we ship
          </h2>
          <p style={{ maxWidth: "60ch", marginBottom: "0.75rem" }}>
            <strong>We currently ship to:</strong> {SHIP_STATES}
          </p>
          <p style={{ maxWidth: "60ch", marginBottom: "1.5rem" }}>
            If your state is not listed, we are not yet able to ship there. Add
            an item to your cart and enter your address at checkout — if we
            can&apos;t ship to your state, no shipping option will appear. We add
            states as our capacity grows, so check back. We do{" "}
            <strong>not</strong> currently ship to Hawaii, Alaska, U.S.
            territories, or internationally.
          </p>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              color: "var(--forest-deep)",
              marginBottom: "0.75rem",
            }}
          >
            Shipping season
          </h2>
          <p style={{ maxWidth: "60ch", marginBottom: "0.75rem" }}>
            Our trees are shipped bareroot or potted while dormant. Bareroot
            trees must be planted while dormant, long before your area&apos;s
            last frost date — this is different from ordinary &ldquo;garden
            planting.&rdquo;
          </p>
          <p style={{ maxWidth: "60ch", marginBottom: "0.75rem" }}>
            <strong>Snow or frost will not hurt a dormant tree.</strong> For our
            shipping region (roughly USDA Zones 5–7 across the states we serve),
            the goal is to get trees in the ground while there is still good
            moisture in the soil, so roots establish months before bud break.
          </p>
          <p style={{ maxWidth: "60ch", marginBottom: "1.5rem" }}>
            We ship in late winter through spring, roughly{" "}
            <strong>February through May</strong>, depending on the weather and
            how quickly the ground thaws in your region. If your ground is still
            frozen or your soil is too wet when your trees arrive, &ldquo;heel&rdquo;
            the trees in — cover the roots with moist soil or sand in a shady
            spot — until your ground thaws and drains. Let us know when you order
            if your ground is frozen solid and we will hold your order for a
            later ship date.
          </p>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              color: "var(--forest-deep)",
              marginBottom: "0.75rem",
            }}
          >
            How shipping is priced
          </h2>
          <p style={{ maxWidth: "60ch", marginBottom: "0.75rem" }}>
            All orders ship via ground service within the U.S.{" "}
            <strong>
              The price you see at checkout is the actual, current rate for your
              address
            </strong>{" "}
            — our checkout prices each order live against carrier rates for the
            destination, so what you see is what you pay.
          </p>
          <p style={{ maxWidth: "60ch", marginBottom: "0.75rem" }}>
            Shipping is billed at cost plus handling. Handling covers the real
            materials and labor to prepare your trees — boxes, bags, moist
            shredded packing, string, tape, and staples. We are a small nursery
            and do not receive the volume discounts the big-box stores get; we
            aim only to recover the actual cost of packing and shipping. We
            don&apos;t make money on shipping, and we can&apos;t afford to lose
            money on it either.
          </p>
          <p style={{ maxWidth: "60ch", marginBottom: "0.75rem" }}>
            Because carriers bill us by box size (dimensional weight) plus an
            oversized-package fee, <strong>ordering more trees is more
            cost-effective</strong> — a box of ten trees often costs about the
            same to ship as a box of one. Orders of one to three trees ship in a
            48-inch box; these trees are professionally pruned before shipping
            and are ready to plant on arrival.
          </p>
          <p style={{ maxWidth: "60ch", marginBottom: "1.5rem" }}>
            Your trees are packed in a new cardboard box with the roots wrapped
            in a sturdy plastic bag of moist shredded paper, tied off to keep
            roots moist in transit. Planting instructions are included.{" "}
            <strong>
              Please tell us right away if your package arrives damaged.
            </strong>
          </p>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              color: "var(--forest-deep)",
              marginBottom: "0.75rem",
            }}
          >
            Local farm pickup
          </h2>
          <p style={{ maxWidth: "60ch", marginBottom: "1.5rem" }}>
            Prefer to pick up in person?{" "}
            <strong>Local farm pickup is available by appointment</strong> at our
            West Virginia nursery. If you&apos;d like to collect your order at the
            farm, contact us when you order and we&apos;ll arrange a time that
            works. Pickup orders are not charged shipping.
          </p>

          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              color: "var(--forest-deep)",
              marginBottom: "0.75rem",
            }}
          >
            Limited warranty
          </h2>
          <p style={{ maxWidth: "60ch", marginBottom: "0.75rem" }}>
            Our trees are guaranteed to <strong>arrive alive and healthy</strong>.
            Planted according to the instructions we include, they will leaf out
            and grow.
          </p>
          <p style={{ maxWidth: "60ch", marginBottom: "0.75rem" }}>
            <strong>
              If you notify us by July 1st of the same year you received your
              tree
            </strong>
            , we will replace any tree that fails to grow by issuing a{" "}
            <strong>store credit</strong> for the price you paid for the tree
            (not including shipping). We may ask you to return the tree for
            inspection or to email photos.
          </p>
          <p style={{ maxWidth: "60ch", marginBottom: "0.75rem" }}>
            After July 1st there are too many variables outside our control —
            extreme weather, rodent damage, disease, soil deficiencies, and
            individual care — for us to guarantee a tree.
          </p>
          <p style={{ maxWidth: "60ch" }}>
            Any tree that proves to be a different variety than the one you
            ordered will be replaced. Replacements require payment of shipping
            and handling. We reserve the right to substitute a comparable variety
            if the one in question is unavailable, and not to re-issue credit on
            a tree that has already been replaced. Our liability is limited to
            the original price paid for the tree. <strong>Sorry, no refunds.</strong>
          </p>
        </div>

        <aside className="field-notes">
          <div className="field-notes-eyebrow">At a glance</div>
          <h3>The short version.</h3>
          <p>
            Live trees, shipped dormant to 21 states, priced live at checkout at
            cost plus handling — with an arrive-alive guarantee.
          </p>
          <ul>
            <li>
              <span>Ships to</span>
              <strong>21 U.S. states</strong>
            </li>
            <li>
              <span>Ship window</span>
              <strong>Feb – May</strong>
            </li>
            <li>
              <span>Shipping cost</span>
              <strong>Live at checkout</strong>
            </li>
            <li>
              <span>Farm pickup</span>
              <strong>By appointment</strong>
            </li>
            <li>
              <span>Warranty claim</span>
              <strong>By July 1st</strong>
            </li>
          </ul>
        </aside>
      </div>
    </>
  );
}
