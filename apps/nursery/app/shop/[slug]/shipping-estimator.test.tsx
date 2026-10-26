// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ShippingRateFeed } from "@grove/odoo-client";
import { ShippingEstimator, type EstimatorTier } from "./shipping-estimator";
import { ZONE_BY_STATE } from "../../../lib/shipping-estimate";

/**
 * The estimator's four eligibility states (GOL-2973, extended by GOL-3028).
 *
 * The regression this guards is specific and was live on prod: a GREEN state
 * the per-product plant-health carve-out gate (GOL-2132) refuses at checkout
 * still rendered "✓ We ship to Florida … from $20". A rate for a pair we will
 * refuse is the actual harm, so every assertion here is "no dollar figure" plus
 * "the item-specific reason is named".
 *
 * GOL-3028 adds the fourth: a consult-built mix (`consultBuilt`) whose deposit
 * the backend now ACCEPTS into FL/IN/OH/WI (GOL-3019). That branch must read as
 * a narrowing with real numbers, not a refusal, and it must stay keyed on the
 * flag — an empty botanical alone still gets the cautious fail-safe, because it
 * also covers products nobody has declared yet.
 */

const TIER: EstimatorTier = {
  tier: "bareroot",
  label: "Bareroot pre-order",
  fulfillment: "Fall wave, approx Nov 9 to Nov 26",
  badge: "Pre-order",
};

function renderEstimator(props: Partial<React.ComponentProps<typeof ShippingEstimator>> = {}) {
  let state = "";
  const view = render(
    <ShippingEstimator state={state} onStateChange={() => {}} tier={TIER} {...props} />,
  );
  return { ...view, state };
}

/** Rerender at a chosen state — the parent owns `state`, so tests drive it. */
function at(state: string, props: Partial<React.ComponentProps<typeof ShippingEstimator>> = {}) {
  render(<ShippingEstimator state={state} onStateChange={() => {}} tier={TIER} {...props} />);
  return screen.getByRole("region", { name: /estimate shipping/i, hidden: true });
}

const DOLLARS = /\$\d/;

describe("ShippingEstimator — eligibility branches", () => {
  it("green + cleared: quotes a rate and says we ship there", () => {
    const panel = at("WV", { botanicalName: "Castanea spp." });
    expect(panel.textContent).toMatch(/We ship to West Virginia/);
    expect(panel.textContent).toMatch(DOLLARS);
    expect(panel.textContent).not.toMatch(/Not cleared/);
  });

  it("green + carved out: names the restriction and the swap, and quotes NOTHING", () => {
    // Prod template 22 (Chestnut Grove), the exact payload that was lying.
    const panel = at("FL", { botanicalName: "Castanea spp." });
    expect(panel.textContent).toMatch(/Not cleared for Florida/);
    expect(panel.textContent).toMatch(/restricts chestnut/);
    expect(panel.textContent).toMatch(/Shagbark Hickory/);
    // The two things that must never appear with a block: a dollar figure, and
    // the rate disclaimer that frames one. The body DOES still say "We ship to
    // Florida, but …" on purpose — the state is fine, the item is not, and
    // saying so is what stops this reading as a geography problem.
    expect(panel.textContent).not.toMatch(DOLLARS);
    expect(panel.textContent).not.toMatch(/exact rate is confirmed at checkout/);
  });

  it("green + no declared botanical and NOT consult-built: the cautious fail-safe", () => {
    // Any product whose botanical nobody has declared yet. Checkout still
    // hard-refuses this (the GOL-2132 fail-safe), so the panel must not quote.
    const panel = at("FL", { botanicalName: null });
    expect(panel.textContent).toMatch(/can’t confirm this one for Florida/);
    expect(panel.textContent).toMatch(/haven’t confirmed where this one falls/);
    expect(panel.textContent).not.toMatch(DOLLARS);
    expect(panel.textContent).not.toMatch(/exact rate is confirmed at checkout/);
    // It must NOT borrow the consult-built disclosure: nothing here is built in
    // a consult, and promising one would be a different lie.
    expect(panel.textContent).not.toMatch(/of our 17 food-forest species/);
  });

  it("green + consult-built into FL: discloses the constraint with real numbers", () => {
    // Template 134 (Centennial Food Forest, $400) shipping to Florida. Florida
    // restricts chestnut and dogwood, so 14 of our 17 palette species clear.
    const panel = at("FL", { botanicalName: null, consultBuilt: true });
    expect(panel.textContent).toMatch(
      /Your Florida mix: 14 of our 17 food-forest species/,
    );
    expect(panel.textContent).toMatch(/restricts chestnut and dogwood/);
    // Every excluded species is named — a count alone is not a disclosure.
    expect(panel.textContent).toMatch(/American Chestnut/);
    expect(panel.textContent).toMatch(/Chinese Chestnut/);
    expect(panel.textContent).toMatch(/Flowering Dogwood/);
    // Still no rate: the mix is not built, so the box count that prices it is
    // genuinely unknown. And no refusal language — the deposit goes through.
    expect(panel.textContent).not.toMatch(DOLLARS);
    expect(panel.textContent).not.toMatch(/Not cleared for/);
    expect(panel.textContent).not.toMatch(/can’t confirm/);
  });

  it("green + consult-built into IN: one exclusion, and only WHITE mulberry", () => {
    const panel = at("IN", { botanicalName: null, consultBuilt: true });
    expect(panel.textContent).toMatch(
      /Your Indiana mix: 16 of our 17 food-forest species/,
    );
    expect(panel.textContent).toMatch(/restricts white mulberry/);
    expect(panel.textContent).toMatch(/Mulberry/);
    // Morus rubra is clean, so the notice must not imply every mulberry is out.
    expect(panel.textContent).not.toMatch(/American Chestnut/);
    expect(panel.textContent).not.toMatch(DOLLARS);
  });

  it("green + consult-built into an UNREGULATED state: nothing is constrained", () => {
    // WV restricts nothing, so there is no constraint to disclose and the mix
    // quotes like any other product. Silence is the honest answer here.
    const panel = at("WV", { botanicalName: null, consultBuilt: true });
    expect(panel.textContent).toMatch(/We ship to West Virginia/);
    expect(panel.textContent).toMatch(DOLLARS);
    expect(panel.textContent).not.toMatch(/species we grow/);
  });

  it("consult-built does NOT override a declared botanical, exactly like the gate", () => {
    // The backend takes its deferral branch only when the botanical is empty.
    // A consult-built template that somehow declares one falls through to the
    // ordinary per-taxon evaluation, so the storefront must too.
    const panel = at("FL", { botanicalName: "Castanea spp.", consultBuilt: true });
    expect(panel.textContent).toMatch(/Not cleared for Florida/);
    expect(panel.textContent).not.toMatch(/species we grow/);
  });

  it("consult-built is suppressed by the compliance exemption, like every notice", () => {
    const panel = at("FL", {
      botanicalName: null,
      consultBuilt: true,
      complianceExempt: true,
    });
    expect(panel.textContent).toMatch(/We ship to Florida/);
    expect(panel.textContent).toMatch(DOLLARS);
    expect(panel.textContent).not.toMatch(/species we grow/);
  });

  it("not green: unchanged 'not there yet', which is about geography not the item", () => {
    const panel = at("TX", { botanicalName: "Castanea spp." });
    expect(panel.textContent).toMatch(/can’t ship living trees to Texas yet/);
    expect(panel.textContent).not.toMatch(/Not cleared for/);
    expect(panel.textContent).not.toMatch(DOLLARS);
  });

  it("compliance-exempt products quote normally, exactly like checkout", () => {
    const panel = at("FL", { botanicalName: "Castanea spp.", complianceExempt: true });
    expect(panel.textContent).toMatch(/We ship to Florida/);
    expect(panel.textContent).toMatch(DOLLARS);
  });

  it("substitution bundles quote normally, exactly like checkout (GOL-3015)", () => {
    // Template 132: Castanea-led bundle on a phantom Kit BoM. Checkout swaps
    // the chestnut for a hickory per destination and ships it, so the notice
    // that would read "Not cleared for Florida" must go quiet — otherwise the
    // PDP turns away an order we can actually fulfil.
    const panel = at("FL", { botanicalName: "Castanea spp.", shipsAllGreenStates: true });
    expect(panel.textContent).toMatch(/We ship to Florida/);
    expect(panel.textContent).toMatch(DOLLARS);
    expect(panel.textContent).not.toMatch(/Not cleared/);
  });

  it("a consult mix with the substitution flag loses the can't-confirm notice (GOL-3015)", () => {
    const panel = at("FL", { botanicalName: null, shipsAllGreenStates: true });
    expect(panel.textContent).toMatch(/We ship to Florida/);
    expect(panel.textContent).not.toMatch(/can’t confirm this mix/);
  });

  it("without the substitution flag the GOL-2973 notice is unchanged", () => {
    // The flag is false catalog-wide until the phantom BoMs are seeded
    // (GOL-2589), so the carve-out notice has to survive its arrival untouched.
    const panel = at("FL", { botanicalName: "Castanea spp.", shipsAllGreenStates: false });
    expect(panel.textContent).toMatch(/Not cleared for Florida/);
    expect(panel.textContent).not.toMatch(DOLLARS);
  });

  it("the substitution flag never widens the green list (GOL-3015)", () => {
    // Texas is not green. `ships_all_green_states` means "all GREEN states",
    // and the geographic gate runs first, so the copy must not budge.
    const panel = at("TX", { botanicalName: "Castanea spp.", shipsAllGreenStates: true });
    expect(panel.textContent).toMatch(/can’t ship living trees to Texas yet/);
    expect(panel.textContent).not.toMatch(DOLLARS);
  });

  it("an unregulated green state is untouched by the fail-safe", () => {
    // GA carries no carve-out rule, so an undeclared botanical still ships.
    const panel = at("GA", { botanicalName: "" });
    expect(panel.textContent).toMatch(/We ship to Georgia/);
    expect(panel.textContent).toMatch(DOLLARS);
  });

  it("every branch offers a next action — none is a dead end", () => {
    for (const props of [
      { botanicalName: "Castanea spp." }, // restricted
      { botanicalName: null }, // unconfirmed
    ]) {
      const { unmount } = render(
        <ShippingEstimator state="FL" onStateChange={() => {}} tier={TIER} {...props} />,
      );
      expect(screen.getByRole("button", { name: "Ask us" })).toBeTruthy();
      expect(screen.getByText(/free at the farm/)).toBeTruthy();
      unmount();
    }
  });

  it("colour is never the only signal: each state has a distinct opening phrase", () => {
    // Four branches, four openings that differ in WORDS — so the panel reads
    // correctly in grayscale and under deuteranopia / protanopia / tritanopia.
    const cases: Array<[string, Partial<React.ComponentProps<typeof ShippingEstimator>>]> = [
      ["WV", { botanicalName: "Castanea spp." }],
      ["FL", { botanicalName: "Castanea spp." }],
      ["FL", { botanicalName: null, consultBuilt: true }],
      ["TX", { botanicalName: "Castanea spp." }],
    ];
    const openings = cases.map(([s, props]) => {
      const { container, unmount } = render(
        <ShippingEstimator state={s} onStateChange={() => {}} tier={TIER} {...props} />,
      );
      const text = container.textContent ?? "";
      unmount();
      return text;
    });
    expect(openings[0]).toMatch(/We ship to/);
    expect(openings[1]).toMatch(/Not cleared for/);
    expect(openings[2]).toMatch(/Your Florida mix:/);
    expect(openings[3]).toMatch(/can’t ship living trees/);
  });

  it("selecting a state calls back so the parent (and the Format cards) follow", async () => {
    const seen: string[] = [];
    render(
      <ShippingEstimator state="" onStateChange={(s) => seen.push(s)} tier={TIER} />,
    );
    await userEvent.selectOptions(screen.getByRole("combobox"), "FL");
    expect(seen).toContain("FL");
  });

  // The one em dash the brand-voice guard (GOL-3065) exempts, pinned to a real
  // render so the exemption can never drift into covering prose. A shippable
  // tier with no rate in the table is a missing VALUE, not a message, and a
  // bare dash in a price cell is what that is written as.
  it("a shippable tier with no rate shows the em-dash placeholder, not a $0", () => {
    const panel = at("WV", {
      botanicalName: "Castanea spp.",
      rates: {} as never,
    });
    expect(panel.textContent).toMatch(/\u2014/);
    expect(panel.textContent).not.toMatch(/\$0/);
    expect(panel.textContent).not.toMatch(DOLLARS);
  });

  it("before a state is picked, nothing is promised about any state", () => {
    const { container } = renderEstimator({ botanicalName: "Castanea spp." });
    expect(container.textContent).toMatch(/pick yours to see your rate/);
    expect(container.textContent).not.toMatch(/Not cleared/);
  });
});

// GOL-3344 (Josh 2026-10-14): the quoting line names how many trees the price
// covers. The fixture is the live 2026-10-14 prod feed shape after GOL-3285 and
// the 10-13 rate ruling: bareroot packs into the p24x10x4 / p24x10x6 cartons
// (10 / 20 trees), zone_1 (WV) cells $14.33 / $16.06 with handling inside.
function liveFeed(extra: Partial<ShippingRateFeed> = {}): ShippingRateFeed {
  return {
    schema: 2,
    zones: {
      zone_1: { p24x10x4: { base: 14.33 }, p24x10x6: { base: 16.06 } },
      zone_2: { p24x10x4: { base: 13.04 }, p24x10x6: { base: 14.81 } },
    },
    zone_by_state: { ...ZONE_BY_STATE },
    green_states: Object.keys(ZONE_BY_STATE),
    packing: {
      boxes: {
        p24x10x4: { length: 24, width: 10, height: 4, capacity: { dormant: 10, leafed: 10 } },
        p24x10x6: { length: 24, width: 10, height: 6, capacity: { dormant: 20, leafed: 20 } },
      },
      length_classes: [16, 20],
      modes: ["dormant", "leafed"],
    },
    calendar: {
      preorder_open: { fall: [8, 15], spring: [11, 1] },
      leafed_window: [[5, 1], [10, 15]],
      fulfillment_days: [5, 10],
      zones: {},
    },
    ...extra,
  } as ShippingRateFeed;
}

const PEAT: EstimatorTier = {
  tier: "potted",
  label: "Peat & bagged",
  fulfillment: "Ships in 5–10 business days",
  badge: null,
};

function boxRows(panel: HTMLElement) {
  return [...panel.querySelectorAll("[data-estimator-box]")].map((li) => li.textContent ?? "");
}

describe("ShippingEstimator — trees per box (GOL-3344)", () => {
  it("WV bareroot: the current feed price to the cent, up to 10 trees, then the 20-tree box", () => {
    const panel = at("WV", { botanicalName: "Castanea spp.", feed: liveFeed() });
    const line = panel.querySelector("[data-estimator-line]")?.textContent ?? "";
    expect(line).toMatch(/^Bareroot pre-orderPre-order ·\sFall wave/);
    expect(line).toMatch(/from \$14\.33$/); // the cell, not a ceiled $15
    expect(boxRows(panel)).toEqual([
      "Up to 10 trees in one box$14.33",
      "Up to 20 trees in one boxBest per tree$16.06",
    ]);
    // The bulk chip is on the larger carton only, in words.
    const rows = panel.querySelectorAll("[data-estimator-box]");
    expect(rows[0].textContent).not.toMatch(/Best per tree/);
    expect(rows[1].textContent).toMatch(/Best per tree/);
    // A list, so the count of options is announced.
    expect(panel.querySelector("ul[data-estimator-boxes]")).not.toBeNull();
  });

  it("another zone re-prices both rows from that zone's cells", () => {
    const panel = at("MD", { botanicalName: "Castanea spp.", feed: liveFeed() });
    expect(boxRows(panel)).toEqual([
      "Up to 10 trees in one box$13.04",
      "Up to 20 trees in one boxBest per tree$14.81",
    ]);
  });

  it("no double handling: a stray shipping_handling_fee adds nothing and no fee line is written", () => {
    const panel = at("WV", {
      botanicalName: "Castanea spp.",
      feed: liveFeed({ shipping_handling_fee: 2.5 }),
    });
    expect(panel.textContent).toMatch(/from \$14\.33/);
    expect(panel.textContent).not.toMatch(/\$16\.83|\$17\b/);
    expect(panel.textContent).not.toMatch(/handling fee/);
    expect(panel.textContent).toMatch(/handling included/);
    expect(panel.textContent).toMatch(/exact rate is confirmed at checkout/);
  });

  it("'Potted' never appears in shipping copy", () => {
    for (const tier of [TIER, PEAT]) {
      cleanup();
      const panel = at("WV", { botanicalName: "Castanea spp.", feed: liveFeed(), tier });
      expect(panel.textContent).not.toMatch(/Potted/);
    }
  });

  it("peat & bagged stays price-only until the feed publishes potted capacities, then reads 5 / 10", () => {
    const bare = at("WV", { botanicalName: "Castanea spp.", feed: liveFeed(), tier: PEAT });
    expect(bare.textContent).toMatch(/^.*Peat & bagged.*from \$14\.33/s);
    expect(boxRows(bare)).toEqual([]); // never a hard-coded 5 / 10
    const withPotted = liveFeed({
      packing: {
        ...liveFeed().packing,
        potted_boxes: { p24x10x4: { capacity: 5 }, p24x10x6: { capacity: 10 } },
      },
    });
    cleanup();
    const published = at("MD", { botanicalName: "Castanea spp.", feed: withPotted, tier: PEAT });
    expect(boxRows(published)).toEqual([
      "Up to 5 trees in one box$13.04",
      "Up to 10 trees in one boxBest per tree$14.81",
    ]);
  });

  it("a pickup-only format quotes no price and no rows", () => {
    const panel = at("WV", {
      botanicalName: "Castanea spp.",
      feed: liveFeed(),
      tier: { ...TIER, pickupOnly: true },
    });
    expect(panel.textContent).not.toMatch(DOLLARS);
    expect(boxRows(panel)).toEqual([]);
  });

  it("the legacy per-tree snapshot (no box feed) keeps the single whole-dollar line", () => {
    const panel = at("WV", { botanicalName: "Castanea spp." });
    expect(panel.querySelector("[data-estimator-line]")?.textContent).toMatch(/from \$\d+$/);
    expect(boxRows(panel)).toEqual([]);
  });
});

describe("ShippingEstimator — ids", () => {
  it("label and select ids are per-instance, so two estimators never share them", () => {
    cleanup();
    renderEstimator();
    renderEstimator();
    const panels = screen.getAllByRole("region", { name: "Estimate shipping to your state" });
    expect(panels).toHaveLength(2);
    const selects = screen.getAllByRole("combobox", { name: "Estimate shipping to your state" });
    expect(selects).toHaveLength(2);
    expect(new Set(selects.map((s) => s.id)).size).toBe(2);
    expect(document.querySelectorAll('[id^="ship-est"]')).toHaveLength(0);
  });
});
