import { expect, test } from "@playwright/test";
import {
  addCurrentProductToCart,
  expectOnReview,
  fillCheckoutForm,
  findProductByCta,
  submitAndCaptureSession,
  submitCheckoutForm,
  usd,
} from "./helpers";
import { AFTER_CUTOVER_REASON, afterDepositCutover, fillPromoCode } from "./qa-helpers";

/**
 * Promo code at checkout — FLATWOODS (GOL-2088; grove-sites #700 + grove-odoo-modules #179).
 *
 * The nursery checkout offers a "Promo code" input (`allowPromoCode` is on for
 * `brand === "nursery"` in packages/checkout CheckoutPage). The code is
 * validated + applied SERVER-side by grove_headless (sale_loyalty `with_code`),
 * so the UI contract is:
 *   - the input is present and upper-cases what the buyer types;
 *   - an ineligible code surfaces as the form error and the flow does NOT
 *     advance to review;
 *   - an accepted code yields a session whose `lineItems` carry a
 *     `kind: "discount"` line (negative amount) rendered on the review page as
 *     a fee-style line, and the itemized lines still reconcile to the charge.
 *
 * Eligibility on QA today: FLATWOODS is rejected on deposit (preorder) carts
 * with a targeted message — that rejection is asserted deterministically. The
 * accepted-discount path needs an in-stock cart and is tagged `@stripe @promo`
 * so it can be excluded if the program is paused in Odoo.
 */
const PROMO = "FLATWOODS";

test.describe("checkout — promo code", () => {
  test("promo input is offered and upper-cases the entry", async ({ page }) => {
    const product = await findProductByCta(page, ["Add to Cart", "Reserve"]);
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, product.buyLabel);
    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    await fillPromoCode(page, PROMO.toLowerCase());
    // fillPromoCode asserts the value case-insensitively; the component
    // upper-cases on change, so the stored value is the canonical code.
    await expect(
      page.locator("form.grove-checkout__grid").getByLabel("Promo code", { exact: true }),
    ).toHaveValue(PROMO);
  });

  test("a promo on a deposit (preorder) cart is rejected server-side and surfaced", async ({
    page,
  }) => {
    // A Reserve line makes the cart a deposit cart; grove_headless refuses promo
    // codes on those ("Promo codes can't be applied to preorder (deposit) carts").
    const reserve = await findProductByCta(page, "Reserve");
    await page.goto(reserve.href);
    await addCurrentProductToCart(page, 1, "Reserve");
    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    await fillPromoCode(page, PROMO);

    const [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/checkout/session")),
      submitCheckoutForm(page),
    ]);
    expect(resp.status(), "promo on a deposit cart must be a client-safe rejection").toBe(400);
    const body = (await resp.json()) as { error?: string };
    expect(body.error ?? "").toMatch(/promo/i);
    expect(body.error ?? "").toMatch(/preorder|deposit/i);

    const err = page.locator("p.grove-checkout__error");
    await expect(err).toBeVisible();
    await expect(err).toContainText(/promo/i);
    await expect(page.getByRole("heading", { name: "Review & pay" })).toHaveCount(0);
  });

  test(
    "an eligible promo on an in-stock cart itemizes a discount line that reconciles",
    { tag: ["@stripe", "@promo"] },
    async ({ page }) => {
      // An in-stock cart is only a full-price (promo-eligible) cart BEFORE the
      // GOL-2233 season cutover; after it every order is a flat-deposit cart, and
      // the deposit-rejection test above is the relevant one.
      test.skip(afterDepositCutover(), AFTER_CUTOVER_REASON);
      const product = await findProductByCta(page, "Add to Cart");
      await page.goto(product.href);
      await addCurrentProductToCart(page, 1, "Add to Cart");
      await page.goto("/checkout");
      await fillCheckoutForm(page, { state: "WV" });
      await fillPromoCode(page, PROMO);

      const { status, body } = await submitAndCaptureSession(page);
      expect(status, "eligible promo on an in-stock ship order should create a session").toBe(
        200,
      );
      const session = body!;
      await expectOnReview(page);

      const lines = session.lineItems ?? [];
      const discounts = lines.filter((l) => l.kind === "discount");
      expect(discounts.length, "session should itemize the promo as a discount line").toBeGreaterThan(0);
      for (const d of discounts) {
        expect(d.unitAmount * d.quantity, "a discount line is negative").toBeLessThan(0);
        // Rendered as a fee-style line (no ship/reserve badge), showing the
        // negative amount exactly as formatted everywhere else.
        const el = page.locator(".grove-review__line--fee", { hasText: d.name }).first();
        await expect(el).toBeVisible();
        await expect(el).toContainText(usd(d.unitAmount * d.quantity, session.currency));
      }
      // Itemized parity still holds with the discount applied (GOL-1823 rule).
      const itemized = lines.reduce((s, l) => s + l.unitAmount * l.quantity, 0);
      expect(Math.round(itemized * 100)).toBe(Math.round(session.amountDueToday * 100));
      expect(session.amountDueToday).toBeGreaterThan(0);
    },
  );
});
