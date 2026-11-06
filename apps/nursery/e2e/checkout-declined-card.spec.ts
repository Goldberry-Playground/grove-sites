import { expect, test } from "@playwright/test";
import {
  STRIPE_TEST_CARD_DECLINE,
  addCurrentProductToCart,
  expectCartNotEmpty,
  expectOnReview,
  fillCheckoutForm,
  fillStripeCheckoutAndPay,
  findProductByCtaOrNull,
  payAtReview,
  submitAndCaptureSession,
} from "./helpers";
import { NO_FULL_CHARGE_PRODUCT_REASON } from "./qa-helpers";

/**
 * Spec 5 — Declined card (GOL-1074).
 *
 * Stripe decline card 4000 0000 0000 0002 → the error surfaces on Stripe's
 * page, the buyer never reaches `/checkout/success`, the order is not marked
 * paid, and the cart is **retained** (a cancelled/failed payment must not clear
 * the cart — the inverse of the GOL-1039 cart-clear fix).
 *
 * Two sessions, so the "keeps the cart" invariant is gated year-round (GOL-3787):
 * a full-charge session when the catalog offers an "Add to cart" line (skips on
 * product availability when it does not), and a $10-deposit session when an open
 * pre-order wave exists. Before GOL-3787 only the full-charge case ran and it
 * `test.skip`-ped on the date, so from Oct 16 to spring a declined card went
 * entirely ungated.
 *
 * @stripe — needs a real Stripe session; expected-red until GOL-899.
 */
const ZONE = 6; // ZIP 26651, the fillCheckoutForm default

test.describe("checkout — declined card", { tag: "@stripe" }, () => {
  test("a declined card on a full-charge session surfaces an error and keeps the cart", async ({
    page,
  }) => {
    // Full charge needs an "Add to cart" (ships-now) line; after the GOL-2233
    // cutover a shipped bareroot line is a deposit instead, so this skips on
    // product availability, never the date. The deposit case below carries the
    // invariant year-round.
    const product = await findProductByCtaOrNull(page, "Add to cart");
    test.skip(product === null, NO_FULL_CHARGE_PRODUCT_REASON);
    if (!product) return;
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, "Add to cart");

    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    const { status } = await submitAndCaptureSession(page);
    expect(status).toBe(200);

    await expectOnReview(page);
    await payAtReview(page);
    await fillStripeCheckoutAndPay(page, STRIPE_TEST_CARD_DECLINE);

    // Stripe keeps the buyer on its page and shows a decline message.
    await expect(
      page.getByText(/declin|card was declined|try a different card|incorrect/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    // We never got a success confirmation.
    expect(page.url()).not.toMatch(/\/checkout\/success/);

    // Cart is retained — a failed payment must not empty it.
    await expectCartNotEmpty(page);
  });

  test("a declined card on a deposit (pre-order) session surfaces an error and keeps the cart", async ({
    page,
  }) => {
    // Deployed target + Stripe's hosted page + a real decline: give it room
    // beyond the suite default (same budget as checkout-deposit-happy-path).
    test.setTimeout(180_000);

    // A bareroot wave pre-order makes the session a $10 deposit — the path that
    // IS live after the season cutover. Skips when no listing has an open zone 6
    // wave today (real date, which the browser cannot move), a product/date
    // availability reason, not a blanket season skip.
    const product = await findProductByCtaOrNull(page, "Pre-order for $10", {
      preorder: { method: "ship", zone: ZONE },
    });
    test.skip(
      product === null,
      `no bareroot listing with an open zone ${ZONE} pre-order wave on this target today (real date)`,
    );
    if (!product) return;
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, "Pre-order for $10", {
      method: "ship",
      zone: ZONE,
      wave: product.wave,
    });

    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    const { status, body } = await submitAndCaptureSession(page);
    expect(status, "a deposit session should be created for a wave pre-order").toBe(200);
    // Confirm it really is the deposit session we mean to decline, not a stray
    // full charge — otherwise a mis-seeded fixture could pass this test for the
    // wrong reason.
    expect(body?.hasPreorder, "the session under test is a deposit pre-order").toBe(true);

    await expectOnReview(page);
    await payAtReview(page);
    await fillStripeCheckoutAndPay(page, STRIPE_TEST_CARD_DECLINE);

    await expect(
      page.getByText(/declin|card was declined|try a different card|incorrect/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    expect(page.url()).not.toMatch(/\/checkout\/success/);

    // A declined deposit must not empty the cart any more than a declined full
    // charge does.
    await expectCartNotEmpty(page);
  });
});
