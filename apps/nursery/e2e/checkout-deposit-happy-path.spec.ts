import { expect, test } from "@playwright/test";
import {
  STRIPE_TEST_CARD_OK,
  addCurrentProductToCart,
  expectCartEmpty,
  expectOnReview,
  fillCheckoutForm,
  fillStripeCheckoutAndPay,
  findProductByCtaOrNull,
  payAtReview,
  submitAndCaptureSession,
  usd,
} from "./helpers";

/**
 * Deposit happy path: the flat $10-per-order pre-order deposit (GOL-2233 / #218,
 * re-keyed for the 2026-10-07 fall / spring wave hotfix).
 *
 * A bareroot line is now always a wave pre-order: the shopper picks a zone and
 * an OPEN fall or spring wave, clicks "Pre-order for $10", and grove_headless
 * takes ONE flat $10 deposit for the WHOLE order; the balance (goods + shipping
 * + WV tax) settles off-session at ship time (GOL-2053). Nothing else is charged
 * today: no goods, no shipping, no tax.
 *
 * Ships to WV ZIP 26651 (zone 6 in grove_headless/data/zip_usda_zone.csv), so
 * the PDP zone is 6: the backend validates the wave against the destination ZIP.
 * Waves open and close on the REAL date, which the browser cannot move, so the
 * spec skips with a reason when no listing has an open zone 6 wave today.
 *
 * Asserts, against the real session and the real Stripe TEST hosted page:
 *   - the session body carries the chosen `shipWave`;
 *   - the order is a preorder (`hasPreorder`) charged EXACTLY one `deposit`
 *     line, quantity 1, $10, with `amountDueToday === 10` and no
 *     goods/shipping/tax lines;
 *   - `amountDueToday` < `amountTotal` (a real balance remains for ship time);
 *   - the review page shows the due-today / due-later split, badged Reserve and
 *     never Ships now;
 *   - 4242 pays the deposit, lands on /checkout/success, and the cart empties.
 *
 * @stripe — real Stripe TEST session + payment on QA.
 */
const ZONE = 6; // ZIP 26651, the fillCheckoutForm default

test.describe("checkout — deposit happy path (flat $10 per order)", { tag: "@stripe" }, () => {
  test("a wave pre-order pays a single $10 deposit, lands on success, empties the cart", async ({
    page,
  }) => {
    // Deployed target + Stripe's hosted page + a real test payment: give it
    // room beyond the suite default so a slow Stripe render is a retry, not a
    // torn-down browser mid-poll.
    test.setTimeout(180_000);

    const product = await findProductByCtaOrNull(page, "Pre-order for $10", {
      preorder: { method: "ship", zone: ZONE },
    });
    test.skip(
      product === null,
      `no bareroot listing with an open zone ${ZONE} pre-order wave on this target today (real date)`,
    );
    if (!product) return;
    await page.goto(product.href);
    // Quantity 2 proves the deposit is flat PER ORDER, not per unit. Re-select
    // the same wave the scan found open (navigation resets the PDP choice).
    await addCurrentProductToCart(page, 2, "Pre-order for $10", {
      method: "ship",
      zone: ZONE,
      wave: product.wave,
    });

    const sessionBodies: { shipWave?: unknown }[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/checkout/session") && req.method() === "POST") {
        sessionBodies.push(JSON.parse(req.postData() ?? "{}"));
      }
    });
    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    const { status, body, errorBody } = await submitAndCaptureSession(page);
    expect(
      status,
      `a deposit session should be created for a flat-deposit order${errorBody ? ` — server said: ${errorBody}` : ""}`,
    ).toBe(200);
    expect(body).not.toBeNull();
    const session = body!;
    expect(sessionBodies).toHaveLength(1);
    expect(sessionBodies[0].shipWave, "the session carries the chosen wave").toBe(product.wave);

    // Preorder economics: a single flat $10 deposit is the whole charge today.
    expect(session.hasPreorder, "a flat-deposit order is a preorder").toBe(true);
    const lines = session.lineItems ?? [];
    expect(lines.length, "the flat-per-order deposit is a single line").toBe(1);
    const [deposit] = lines;
    expect(deposit.kind, "the only charged-today line is the deposit").toBe("deposit");
    expect(deposit.quantity, "one flat deposit for the whole order, regardless of cart quantity").toBe(1);
    expect(deposit.unitAmount, "the flat deposit is $10").toBe(10);
    expect(
      lines.some((l) => l.kind === "goods" || l.kind === "shipping" || l.kind === "tax"),
      "nothing but the deposit is charged today — goods/shipping/tax defer to ship time",
    ).toBe(false);
    expect(session.amountDueToday, "only the $10 deposit is due today").toBe(10);
    expect(session.amountDueToday, "a balance must remain for ship time").toBeLessThan(
      session.amountTotal,
    );

    // Review page mirrors the split and badges the line Reserve, never Ships now.
    await expectOnReview(page);
    await expect(page.getByText("Due today").first()).toBeVisible();
    await expect(page.getByText("Due when it ships").first()).toBeVisible();
    await expect(
      page.locator(".grove-review__amount--today .grove-review__amount-value"),
    ).toHaveText(usd(session.amountDueToday, session.currency));
    await expect(
      page.locator(".grove-review__amount--later .grove-review__amount-value"),
    ).toHaveText(usd(session.amountTotal - session.amountDueToday, session.currency));
    await expect(page.locator(".grove-review__badge--reserve").first()).toBeVisible();
    await expect(page.locator(".grove-review__badge--ship")).toHaveCount(0);

    // Pay the deposit on Stripe's hosted page and come home.
    await payAtReview(page);
    await fillStripeCheckoutAndPay(page, STRIPE_TEST_CARD_OK);
    await page.waitForURL(/\/checkout\/success(\?|$)/, { timeout: 60_000 });
    await expect(
      page.getByRole("heading", { name: /Payment received|Deposit received|Order confirmed/i }),
    ).toBeVisible();
    await expectCartEmpty(page);
  });
});
