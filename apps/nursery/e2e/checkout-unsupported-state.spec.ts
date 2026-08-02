import { expect, test } from "@playwright/test";
import {
  addCurrentProductToCart,
  fillCheckoutForm,
  findProductByCta,
  submitCheckoutForm,
} from "./helpers";

/**
 * Spec 3 — Unsupported ship-to state (GOL-1074).
 *
 * The State `<select>` now only offers the 21 green-list states (GOL-1055), so
 * a shopper can no longer *pick* an unsupported state through the UI. This spec
 * therefore validates the defence-in-depth server gate: we submit a valid
 * selectable state but rewrite the outbound payload's `shipping.state` to an
 * off-list code, and assert grove-headless rejects it with a 400 that the UI
 * surfaces in the checkout error box (never advancing to the review page).
 *
 * Not @stripe: the state rejection short-circuits before the Stripe session is
 * minted — but it does need the QA Odoo backend reachable (preview up).
 */
test.describe("checkout — unsupported ship-to state", () => {
  test("server rejects an off-green-list state with a surfaced 400", async ({ page }) => {
    const product = await findProductByCta(page, "Add to Cart");
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, "Add to Cart");

    // Inject an unsupported state into the request the (constrained) UI would
    // never itself produce — proving the backend, not just the select, guards it.
    await page.route("**/api/checkout/session", async (route) => {
      const raw = route.request().postData() ?? "{}";
      const payload = JSON.parse(raw);
      if (payload.shipping) payload.shipping.state = "TX"; // not on the green list
      await route.continue({ postData: JSON.stringify(payload) });
    });

    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });

    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/checkout/session")),
      submitCheckoutForm(page),
    ]);
    expect(resp.status(), "off-list state must be rejected by grove-headless").toBe(400);

    // The buyer sees a targeted error, and the flow does NOT advance to review.
    await expect(page.locator("p.grove-checkout__error")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Review & pay" })).toHaveCount(0);
  });
});
