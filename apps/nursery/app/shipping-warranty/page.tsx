import type { Metadata } from "next";
import Link from "next/link";
import type { ShippingCalendar } from "@grove/odoo-client";
import { GlyphIcon } from "@grove/ui-kit";
import { CategoryBar } from "../category-bar";
import { odoo } from "../../lib/clients";
import {
  shipScope,
  US_STATE_NAMES,
  ZONE_BY_STATE,
} from "../../lib/shipping-estimate";
import {
  formatWindow,
  servedZoneSpan,
  shipWindowEnvelope,
} from "../../lib/fulfillment-mode";
import { POTTED_SEASON_FALLBACK } from "../../lib/fulfillment-method";

// At The Grove Nursery — Shipping & Warranty policy page (GOL-967).
//
// Copy is BOARD-APPROVED and rendered verbatim from the `shipping-warranty-
// policy` document on GOL-944 (rev "FINAL", Josh 2026-07-30). Do not alter the
// terms, the state list, or any pricing language here.
//
// Ship WINDOW derived on GOL-2948 (CMO ratification, 2026-10-05). The
// at-a-glance box and the shipping-season prose hardcoded "Feb - May", the one
// figure on this page that was hand-written rather than read from the engine.
// It was wrong in both directions against the live calendar feed: February
// ships nothing in any zone, while the entire fall wave (November into early
// December) and the first week of June were denied outright — on a page a
// shopper reads while the storefront and the social queue are actively selling
// fall planting. Both now render `shipWindowEnvelope()` over the feed's
// `calendar` block, so a calendar edit is a data change here too. No terms,
// prices or list entries altered.
//
// Served USDA-zone span derived on GOL-2957: the "Shipping season" prose
// hardcoded "roughly USDA Zones 5-7", a three-zone band for a green list that
// actually spans zones 3-10 (northern MN/ME through Florida and the Gulf). The
// understatement ran in the harmful direction at the warm end — a Florida
// shopper read "5-7" and reasonably concluded we don't serve them, while
// checkout ships there. The span now renders `calendar.served_usda_range`
// (backend-derived from the green-filtered PHZM matrix, grove-odoo-modules
// GOL-2957), so a green-list change reshapes it with no copy edit; the clause
// is omitted rather than guessed when the feed is degraded. No terms, prices or
// list entries altered.
//
// Wording of the ship-scope figure corrected on GOL-2941 (CMO ratification,
// 2026-10-05): the derived count is a *destination* count and includes D.C., a
// federal district, so "N states" was factually wrong. `shipScope()` derives
// "N states and Washington, D.C." from the same engine mirror — the number is
// unchanged and still never drifts. No terms, prices or list entries altered.
//
// Geography + pricing are the system of record from the checkout shipping
// engine (`grove_headless` shipping-zone matrix, GOL-15): no
// HI/AK/territories/international, live per-address rate at checkout billed at
// cost + handling, no free-ship threshold. The state count and the spelled-out
// list are DERIVED from the engine mirror (`shipScope()` / `ZONE_BY_STATE`
// in lib/shipping-estimate) so this page can never drift from what checkout
// actually ships — the class of bug that left "21" and "22" both on this page
// before GOL-2128. The engine owns eligibility; this is the human-readable
// mirror, updated only by a matching engine change.
//
// Edited 2026-10-08 per Josh: the two em dashes in the shipping-season prose
// became a period and parentheses, and "there is no month we cannot get a tree
// to you" was replaced. Potted / peat-and-bagged ships only inside the feed's
// `leafed_window` (May 1 to Oct 15 in prod) and bareroot is always a pre-order
// for a fall or spring wave (lib/fulfillment-method, lib/preorder-waves), so
// the copy now reads "you can order any month; your tree ships in the next
// open window for your zone". The aside note names the same leafed window. No
// terms, prices or list entries altered. Otherwise the "do not alter" rule
// above still stands.
//
// Built from the app's own design-system classes (.section, .section-header,
// .section-tag, .section-lede, .with-sidebar, .field-notes) — no bespoke CSS.
export const dynamic = "force-dynamic";

// Ship-scope wording derived from the same engine mirror as the list below, so
// the figure and its noun stay correct together (GOL-2941).
const SHIP_SCOPE = shipScope();

// Title is the LEFT side only — `app/layout.tsx` appends " | At The Grove
// Nursery" via `title.template` (GOL-2878). Repeating the brand here renders it
// twice.
export const metadata: Metadata = {
  title: "Shipping & Warranty",
  alternates: { canonical: "/shipping-warranty" },
  description: `How and where At The Grove Nursery ships live trees: ${SHIP_SCOPE.phraseUS}, live per-address rates at cost plus handling, dormant-season shipping, local farm pickup, and our arrive-alive limited warranty.`,
};

// Derived from the engine mirror (ZONE_BY_STATE → full names), Oxford-comma
// joined, so the human-readable list can never drift from the states checkout
// actually ships to (GOL-2128). Eligibility itself is enforced by the checkout
// shipping engine (GOL-15).
const SHIP_STATE_NAMES = Object.keys(ZONE_BY_STATE)
  .map((code) => US_STATE_NAMES[code])
  .sort((a, b) => a.localeCompare(b));
const SHIP_STATES = `${SHIP_STATE_NAMES.slice(0, -1).join(", ")}, and ${SHIP_STATE_NAMES.at(-1)}.`;

export default async function ShippingWarrantyPage() {
  // Live per-USDA-zone ship calendar (GOL-1172/1177), the same feed + helpers
  // the homepage Field Notes and the PDP buy box read, so the policy page can
  // never state a season the buy box contradicts. Best-effort, exactly as on
  // the homepage: a missing or degraded feed falls back to the baked
  // backend-mirror snapshot inside `shipWindowEnvelope`, never to a literal.
  let shippingCalendar: ShippingCalendar | null = null;
  try {
    shippingCalendar = (await odoo.shipping.rateFeed())?.calendar ?? null;
  } catch {
    shippingCalendar = null;
  }
  const windows = shipWindowEnvelope(shippingCalendar);
  const fulfillmentDays = shippingCalendar?.fulfillment_days ?? [5, 10];
  // The leafed-out (potted / peat-and-bagged) season, from the same feed the
  // PDP format gate reads (`isPottedSeason`), so the policy page states the
  // same immediate-ship window the buy box enforces (Josh 2026-10-08).
  const leafedWindow =
    shippingCalendar?.leafed_window ?? POTTED_SEASON_FALLBACK;
  // GOL-2957: the served USDA hardiness span, derived from the same feed. The
  // backend computes `[min, max]` across the green-filtered PHZM matrix, so
  // adding or removing a green state reshapes it with no copy edit here. A
  // degraded feed (absent/null/malformed) drops the parenthetical rather than
  // asserting a possibly-stale band — the sentence still reads correctly
  // without it, and `servedZoneSpan` validates the shape so a half-migrated
  // feed can never render "USDA Zones –" (GOL-2967).
  const servedZones = servedZoneSpan(shippingCalendar);

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
            Browse the catalog <GlyphIcon name="arrow-right" />
          </Link>
        </div>
        <p className="section-lede" style={{ maxWidth: "62ch" }}>
          At the Grove Nursery ships live trees within the United States to the{" "}
          <strong>{SHIP_SCOPE.phrase}</strong> currently on our shipping map. We are a
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
            shipping region
            {servedZones
              ? ` (USDA Zones ${servedZones[0]}–${servedZones[1]} across the states we serve)`
              : ""}
            , the goal is to get trees in the ground while there is still good
            moisture in the soil, so roots establish months before bud break.
          </p>
          <p style={{ maxWidth: "60ch", marginBottom: "0.75rem" }}>
            We ship dormant trees in two waves a year:{" "}
            <strong>{formatWindow(windows.fall)}</strong> in the fall and{" "}
            <strong>{formatWindow(windows.spring)}</strong> in the spring. Those
            are the outside edges of the season. The exact weeks stagger by
            USDA hardiness zone and depend on the weather and how quickly the
            ground thaws in your region, so warmer zones ship earlier in spring
            and later in fall. Your window is confirmed at checkout.
          </p>
          <p style={{ maxWidth: "60ch", marginBottom: "0.75rem" }}>
            While the trees are leafed out (
            <strong>{formatWindow(leafedWindow)}</strong>), you can also order
            a potted tree to ship right away. It ships as peat and bagged (a
            leafed tree with its roots wrapped in damp peat) on our normal{" "}
            {fulfillmentDays[0]} to {fulfillmentDays[1]} business day
            timeline. Bareroot trees are sold as pre-orders: each one is
            reserved for the next fall or spring wave and ships dormant in your
            zone&apos;s window. You can order any month; your tree ships in the
            next open window for your zone.
          </p>
          <p style={{ maxWidth: "60ch", marginBottom: "1.5rem" }}>
            If your ground is still frozen or your soil is too wet when your
            trees arrive, &ldquo;heel&rdquo; the trees in — cover the roots with
            moist soil or sand in a shady spot — until your ground thaws and
            drains. Let us know when you order if your ground is frozen solid
            and we will hold your order for a later ship date.
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
            same to ship as a box of one. Orders of one to five trees ship in one
            box, and six to ten in one larger box; trees are professionally
            pruned to fit before shipping and are ready to plant on arrival.
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
            <strong>If you notify us within 14 days of delivery</strong>, we
            will replace any tree that fails to grow by issuing a{" "}
            <strong>store credit</strong> for the price you paid for the tree
            (not including shipping). We may ask you to return the tree for
            inspection or to email photos.
          </p>
          <p style={{ maxWidth: "60ch", marginBottom: "0.75rem" }}>
            After that window there are too many variables outside our control —
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
            Live trees, shipped dormant to {SHIP_SCOPE.phrase}, priced live at checkout at
            cost plus handling — with an arrive-alive guarantee.
          </p>
          <ul>
            <li>
              <span>Ships to</span>
              <strong>{SHIP_SCOPE.shortPhrase}</strong>
            </li>
            <li>
              <span>Fall shipping</span>
              <strong>{formatWindow(windows.fall)}</strong>
            </li>
            <li>
              <span>Spring shipping</span>
              <strong>{formatWindow(windows.spring)}</strong>
              <small>
                Staggered by USDA zone, weather permitting. From{" "}
                {formatWindow(leafedWindow)}, potted trees ship as peat and
                bagged in {`${fulfillmentDays[0]}–${fulfillmentDays[1]}`}{" "}
                business days.
              </small>
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
              <strong>Within 14 days of delivery</strong>
            </li>
          </ul>
        </aside>
      </div>
    </>
  );
}

