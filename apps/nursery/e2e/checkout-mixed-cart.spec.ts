import { expect, test } from "@playwright/test";
import {
  addCurrentProductToCart,
  expectOnReview,
  fillCheckoutForm,
  findProductByCta,
  submitAndCaptureSession,
  usd,
} from "./helpers";
import { afterDepositCutover } from "./qa-helpers";

/**
 * Mixed cart — the whole-order deposit collapse (GOL-1074 → re-keyed for GOL-2233 / #218).
 *
 * Under the flat-per-order deposit rule a cart that mixes an in-stock line with
 * a Reserve (sold-out bareroot) line is NOT a per-line split any more: the
 * sold-out trigger collapses the WHOLE order onto a single flat $10 deposit, so
 * even the in-stock line's goods defer to the ship-time settlement. The review
 * shows one deposit (Reserve) line, the due-today / due-later split, and nothing
 * billed as goods today.
 *
 * The Reserve line is the deposit trigger before the cutover; with no Reserve
 * product on QA and before the cutover the whole-order deposit is not
 * exercisable, so the test skips. After the cutover any order deposits anyway.
 *
 * @stripe — creates a real Stripe session; expected-red until GOL-899.
 */
test.describe("checkout — mixed cart", { tag: "@stripe" }, () => {
  test("an in-stock + Reserve cart collapses to one whole-order $10 deposit", async ({
    page,
  }) => {
    // A Reserve (sold-out bareroot) line is what collapses the cart to a deposit
    // before the cutover; skip when QA has none and we are still before it.
    const reserve = await findProductByCta(page, "Reserve").catch(() => null);
    test.skip(
      !reserve && !afterDepositCutover(),
      "no Reserve product on QA and before the cutover — whole-order deposit not exercisable",
    );

    const inStock = await findProductByCta(page, "Add to Cart");
    await page.goto(inStock.href);
    await addCurrentProductToCart(page, 1, "Add to Cart");

    // Add the Reserve line when one exists — its sold-out trigger is what
    // collapses the whole cart to a deposit. After the cutover the in-stock line
    // alone already deposits, so a Reserve line is not required.
    if (reserve) {
      await page.goto(reserve.href);
      await addCurrentProductToCart(page, 1, "Reserve");
    }

    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });
    const { status, body } = await submitAndCaptureSession(page);
    expect(status).toBe(200);
    expect(body).not.toBeNull();
    const session = body!;

    await expectOnReview(page);

    // Whole-order deposit: a single $10 deposit due today, everything else
    // (including the in-stock line's goods) deferred to ship time.
    expect(session.hasPreorder, "a whole-order deposit is a preorder").toBe(true);
    const lines = session.lineItems ?? [];
    expect(lines.length, "the whole-order deposit is a single line").toBe(1);
    const [deposit] = lines;
    expect(deposit.kind).toBe("deposit");
    expect(deposit.quantity).toBe(1);
    expect(deposit.unitAmount, "the flat deposit is $10").toBe(10);
    expect(
      lines.some((l) => l.kind === "goods"),
      "no goods are billed today — the in-stock line defers to ship time",
    ).toBe(false);
    expect(session.amountDueToday, "only the $10 deposit is due today").toBe(10);

    // Review shows the two-part split; the line is badged Reserve, never Ships now.
    await expect(page.getByText("Due today").first()).toBeVisible();
    await expect(page.getByText("Due when it ships").first()).toBeVisible();
    await expect(page.locator(".grove-review__badge--reserve").first()).toBeVisible();
    await expect(page.locator(".grove-review__badge--ship")).toHaveCount(0);

    const dueLater = Math.max(0, session.amountTotal - session.amountDueToday);
    await expect(
      page.locator(".grove-review__amount--today .grove-review__amount-value"),
    ).toHaveText(usd(session.amountDueToday, session.currency));
    await expect(
      page.locator(".grove-review__amount--later .grove-review__amount-value"),
    ).toHaveText(usd(dueLater, session.currency));
  });
});
