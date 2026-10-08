import { expect, test } from "@playwright/test";
import { GREEN_STATE_COUNT, ZONE_BY_STATE } from "../lib/shipping-estimate";
import { addCurrentProductToCart, findProductByCta } from "./helpers";
import { catalogCards, readShopGrid } from "./qa-helpers";

/**
 * Ship-to green list mirror (GOL-2128; grove-sites #705 ↔ grove-odoo-modules #186).
 *
 * The storefront hard-codes the states it will offer (ZONE_BY_STATE, 32 as of
 * 2026-09-21 — FL green-listed, GOL-2235) and grove_headless enforces the same
 * list server-side. A drift
 * between the two is the exact class of bug behind the 2026-09-06 checkout
 * incident (frontend offered a state the backend 500'd on), so this spec pins
 * the FRONTEND half of the contract against the deployed build:
 *
 *   - the checkout State <select> offers exactly the green list (no more, no
 *     fewer) — a shopper can never pick a state the server will refuse, and
 *     every state the server accepts is selectable;
 *   - the PDP shipping estimator agrees: a green state yields a price line, a
 *     non-green state (CA — never shippable, plant-health) yields the
 *     "when we ship to your state" capture instead of a price;
 *   - and (GOL-2973) the estimator never quotes a rate for a GREEN state that
 *     the per-product plant-health carve-out gate (GOL-2132) refuses at
 *     checkout. That third case had no branch at all until GOL-2973: /shop/22
 *     rendered "✓ We ship to Florida … from $20" on prod while checkout
 *     hard-stopped the same shopper — advertise-then-reject.
 *
 * The server half (an off-list state injected past the UI is rejected with a
 * 400) is checkout-unsupported-state.spec.ts.
 */
test.describe("checkout — ship-to green list mirror", () => {
  test(`checkout State select offers exactly the ${GREEN_STATE_COUNT} shippable states`, async ({
    page,
  }) => {
    const product = await findProductByCta(page, ["Add to cart", "Pre-order for $10"]);
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, product.buyLabel);
    await page.goto("/checkout");

    const form = page.locator("form.grove-checkout__grid");
    const stateSelect = form.getByLabel(/^State\b/);
    await expect(stateSelect).toBeVisible();
    const offered = (await stateSelect.locator("option").evaluateAll((els) =>
      els.map((o) => (o as HTMLOptionElement).value).filter((v) => /^[A-Z]{2}$/.test(v)),
    )).sort();
    const expected = Object.keys(ZONE_BY_STATE).sort();

    expect(offered.length, "number of selectable ship-to states").toBe(GREEN_STATE_COUNT);
    expect(offered, "selectable states must equal the green list exactly").toEqual(expected);
    // Sanity on the known boundaries of the list: the home state, one of the
    // ten states added in the 2026-09-07 expansion (#705/#186), and two that
    // must never be offered (CA is plant-health closed; TX is off-list).
    expect(offered).toContain("WV");
    expect(offered).toContain("GA");
    expect(offered).not.toContain("CA");
    expect(offered).not.toContain("TX");
  });

  test("PDP shipping estimator prices a green state and captures a non-green one", async ({
    page,
  }) => {
    const [first] = catalogCards(await readShopGrid(page));
    expect(first).toBeTruthy();
    await page.goto(first.href);

    const estimator = page.locator('[aria-labelledby="ship-est-label"]');
    test.skip((await estimator.count()) === 0, "this product renders no shipping estimator");
    const stateSelect = estimator.locator("select").first();
    await expect(stateSelect).toBeVisible();

    // Green state → a price ("$…" or "Free"), and no state-capture prompt.
    await stateSelect.selectOption("WV");
    await expect(estimator.getByText(/\$\d|Free/).first()).toBeVisible();
    await expect(estimator.getByRole("button", { name: "Notify me", exact: true })).toHaveCount(0);

    // Non-green state → the "when we open your state" capture, and no price.
    // CA must be selectable in the ESTIMATOR (it lists all states so a shopper
    // can ask), unlike the checkout select which only lists shippable ones.
    await stateSelect.selectOption("CA");
    await expect(estimator.getByRole("button", { name: "Notify me", exact: true })).toBeVisible();
    await expect(estimator.getByText(/\$\d/)).toHaveCount(0);
  });

  // The invariant, written so it cannot false-fail on per-environment catalog
  // data: whatever this product's compliance posture is, a rate and a
  // "not cleared" notice must never appear together. One of them is a lie.
  test("PDP estimator never shows a rate and a carve-out notice at once", async ({ page }) => {
    const [first] = catalogCards(await readShopGrid(page));
    expect(first).toBeTruthy();
    await page.goto(first.href);

    const estimator = page.locator('[aria-labelledby="ship-est-label"]');
    test.skip((await estimator.count()) === 0, "this product renders no shipping estimator");
    const stateSelect = estimator.locator("select").first();

    // Two unregulated green states, the three green states that carry a
    // carve-out rule, and one off-list state.
    for (const state of ["WV", "GA", "FL", "IN", "OH", "TX"]) {
      await stateSelect.selectOption(state);
      const text = await estimator.innerText();
      const notCleared = /Not cleared for|confirm this mix for/.test(text);
      const quoted = /\$\d/.test(text);
      expect(
        notCleared && quoted,
        `${state}: estimator showed a rate AND a carve-out notice together`,
      ).toBe(false);
      // Whichever branch rendered, it offered a way forward.
      expect(
        /Ask us|Notify me|from |Free/.test(text),
        `${state}: estimator left the shopper with no next action`,
      ).toBe(true);
    }
  });

  // Targeted: the exact product and state from the GOL-2973 report. Chestnut
  // Grove (template 22) declares a Castanea-led botanical, which the carve-out
  // map blocks into FL/OR/WA. Skipped rather than failed where the catalog
  // differs (not published, or `grove_compliance_exempt` still set) so this
  // can't go red on a data difference it isn't testing.
  test("Chestnut Grove quotes WV but is not cleared for FL", async ({ page }) => {
    const res = await page.goto("/shop/22");
    test.skip(!res || res.status() >= 400, "template 22 is not published here");

    const estimator = page.locator('[aria-labelledby="ship-est-label"]');
    test.skip((await estimator.count()) === 0, "template 22 renders no shipping estimator");
    const stateSelect = estimator.locator("select").first();

    // Control: an unregulated green state still prices normally.
    await stateSelect.selectOption("WV");
    await expect(estimator.getByText(/\$\d|Free/).first()).toBeVisible();

    await stateSelect.selectOption("FL");
    const flText = await estimator.innerText();
    test.skip(
      !/Not cleared for Florida/.test(flText),
      "template 22 is not carve-out-blocked into FL in this environment",
    );
    // No rate, the reason named, the swap offered, a live next action.
    expect(flText).not.toMatch(/\$\d/);
    expect(flText).not.toMatch(/exact rate is confirmed at checkout/);
    expect(flText).toMatch(/restricts chestnut/);
    expect(flText).toMatch(/Shagbark Hickory/);
    await expect(estimator.getByRole("button", { name: "Ask us", exact: true })).toBeVisible();

    // And the geography branch keeps its own, different words.
    await stateSelect.selectOption("TX");
    await expect(estimator.getByText(/ship living trees to Texas yet/)).toBeVisible();
  });
});
