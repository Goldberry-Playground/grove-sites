// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShippingEstimator, type EstimatorTier } from "./shipping-estimator";

/**
 * The estimator's three eligibility states (GOL-2973).
 *
 * The regression this guards is specific and was live on prod: a GREEN state
 * the per-product plant-health carve-out gate (GOL-2132) refuses at checkout
 * still rendered "✓ We ship to Florida … from $20". A rate for a pair we will
 * refuse is the actual harm, so every assertion here is "no dollar figure" plus
 * "the item-specific reason is named".
 */

const TIERS: EstimatorTier[] = [
  { tier: "bareroot", label: "Bareroot", fulfillment: "Ships in 5–10 business days" },
];

function renderEstimator(props: Partial<React.ComponentProps<typeof ShippingEstimator>> = {}) {
  let state = "";
  const view = render(
    <ShippingEstimator state={state} onStateChange={() => {}} tiers={TIERS} {...props} />,
  );
  return { ...view, state };
}

/** Rerender at a chosen state — the parent owns `state`, so tests drive it. */
function at(state: string, props: Partial<React.ComponentProps<typeof ShippingEstimator>> = {}) {
  render(<ShippingEstimator state={state} onStateChange={() => {}} tiers={TIERS} {...props} />);
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

  it("green + no declared botanical: the consult branch, and quotes NOTHING", () => {
    // Templates 134/135 — consult-built mixes declare no botanical by design.
    const panel = at("FL", { botanicalName: null });
    expect(panel.textContent).toMatch(/can’t confirm this mix for Florida/);
    expect(panel.textContent).toMatch(/confirm your list in the consult/);
    expect(panel.textContent).not.toMatch(DOLLARS);
    expect(panel.textContent).not.toMatch(/exact rate is confirmed at checkout/);
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
        <ShippingEstimator state="FL" onStateChange={() => {}} tiers={TIERS} {...props} />,
      );
      expect(screen.getByRole("button", { name: "Ask us" })).toBeTruthy();
      expect(screen.getByText(/free at the farm/)).toBeTruthy();
      unmount();
    }
  });

  it("colour is never the only signal: each state has a distinct opening phrase", () => {
    const openings = ["WV", "FL", "TX"].map((s) => {
      const { container, unmount } = render(
        <ShippingEstimator
          state={s}
          onStateChange={() => {}}
          tiers={TIERS}
          botanicalName="Castanea spp."
        />,
      );
      const text = container.textContent ?? "";
      unmount();
      return text;
    });
    expect(openings[0]).toMatch(/We ship to/);
    expect(openings[1]).toMatch(/Not cleared for/);
    expect(openings[2]).toMatch(/can’t ship living trees/);
  });

  it("selecting a state calls back so the parent (and the Format cards) follow", async () => {
    const seen: string[] = [];
    render(
      <ShippingEstimator state="" onStateChange={(s) => seen.push(s)} tiers={TIERS} />,
    );
    await userEvent.selectOptions(screen.getByRole("combobox"), "FL");
    expect(seen).toContain("FL");
  });

  it("before a state is picked, nothing is promised about any state", () => {
    const { container } = renderEstimator({ botanicalName: "Castanea spp." });
    expect(container.textContent).toMatch(/pick yours to see your rate/);
    expect(container.textContent).not.toMatch(/Not cleared/);
  });
});
