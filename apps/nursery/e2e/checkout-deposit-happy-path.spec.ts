import { expect, test } from "@playwright/test";
import {
  STRIPE_TEST_CARD_OK,
  addCurrentProductToCart,
  expectCartEmpty,
  expectOnReview,
  fillCheckoutForm,
  fillStripeCheckoutAndPay,
  findProductByCta,
  payAtReview,
  submitAndCaptureSession,
  usd,
} from "./helpers";
import { afterDepositCutover } from "./qa-helpers";

/**
 * Deposit happy path — the flat $10-per-order deposit flow (GOL-2233 / #218).
 *
 * grove_headless takes ONE flat $10 deposit for the WHOLE order when EITHER
 * trigger fires: (a) a bareroot line is sold out / short on free stock, or
 * (b) the order is placed after the season cutover (default Oct 15,
 * `grove_headless.deposit_cutover_md`). The deposit reserves the trees; the
 * balance (goods + shipping + WV tax) settles off-session at ship time
 * (GOL-2053). Nothing else is charged today — no goods, no shipping, no tax.
 *
 * A sold-out bareroot renders a "Reserve" CTA on the grid, so it is the
 * primary trigger this spec proves. Before the cutover, with no sold-out
 * bareroot on QA, the deposit path is not exercisable and the test skips;
 * after the cutover ANY product qualifies.
 *
 * Asserts, against the real session and the real Stripe TEST hosted page:
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
test.describe("checkout — deposit happy path (flat $10 per order)", { tag: "@stripe" }, () => {
  test("a deposit order pays a single $10 deposit, lands on success, empties the cart", async ({
    page,
  }) => {
    // Deployed target + Stripe's hosted page + a real test payment: give it
    // room beyond the suite default so a slow Stripe render is a retry, not a
    // torn-down browser mid-poll.
    test.setTimeout(180_000);

    // The flat deposit triggers on a sold-out bareroot line OR after the season
    // cutover. Prefer a sold-out bareroot (a "Reserve" CTA on the grid) so the
    // deposit path is proven by its primary stock trigger. If there is none:
    //   - before the cutover the path is not exercisable → skip with a reason;
    //   - after the cutover ANY product deposits → fall back to any live CTA.
    const bareroot = await findProductByCta(page, "Reserve", { nameMatch: /bareroot/i }).catch(
      () => null,
    );
    test.skip(
      !bareroot && !afterDepositCutover(),
      "no sold-out bareroot on QA and before the cutover — deposit path not exercisable",
    );
    const product = bareroot ?? (await findProductByCta(page, ["Reserve", "Add to Cart"]));
    await page.goto(product.href);
    // Quantity 2 proves the deposit is flat PER ORDER, not per unit.
    await addCurrentProductToCart(page, 2, product.buyLabel);

    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    const { status, body, errorBody } = await submitAndCaptureSession(page);
    expect(
      status,
      `a deposit session should be created for a flat-deposit order${errorBody ? ` — server said: ${errorBody}` : ""}`,
    ).toBe(200);
    expect(body).not.toBeNull();
    const session = body!;

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
