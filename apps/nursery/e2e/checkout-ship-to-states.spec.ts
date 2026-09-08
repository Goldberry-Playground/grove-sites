import { expect, test } from "@playwright/test";
import { GREEN_STATE_COUNT, ZONE_BY_STATE } from "../lib/shipping-estimate";
import { addCurrentProductToCart, findProductByCta } from "./helpers";
import { catalogCards, readShopGrid } from "./qa-helpers";

/**
 * Ship-to green list mirror (GOL-2128; grove-sites #705 ↔ grove-odoo-modules #186).
 *
 * The storefront hard-codes the states it will offer (ZONE_BY_STATE, 32 as of
 * 2026-09-07) and grove_headless enforces the same list server-side. A drift
 * between the two is the exact class of bug behind the 2026-09-06 checkout
 * incident (frontend offered a state the backend 500'd on), so this spec pins
 * the FRONTEND half of the contract against the deployed build:
 *
 *   - the checkout State <select> offers exactly the green list (no more, no
 *     fewer) — a shopper can never pick a state the server will refuse, and
 *     every state the server accepts is selectable;
 *   - the PDP shipping estimator agrees: a green state yields a price line, a
 *     non-green state (CA — never shippable, plant-health) yields the
 *     "when we ship to your state" capture instead of a price.
 *
 * The server half (an off-list state injected past the UI is rejected with a
 * 400) is checkout-unsupported-state.spec.ts.
 */
test.describe("checkout — ship-to green list mirror", () => {
  test(`checkout State select offers exactly the ${GREEN_STATE_COUNT} shippable states`, async ({
    page,
  }) => {
    const product = await findProductByCta(page, ["Add to Cart", "Reserve"]);
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
});
