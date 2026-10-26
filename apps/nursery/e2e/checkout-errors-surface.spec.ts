import { expectRefusalVisible, isInViewport, lastQuoteRefusal, test, expect } from "./watchdog";
import {
  PREORDER_CTA,
  addCurrentProductToCart,
  expectOnReview,
  fillCheckoutForm,
  findProductByCtaOrNull,
  submitAndCaptureSession,
} from "./helpers";

/**
 * Checkout must never fail silently (2026-10-26, WV shoppers reporting "can't
 * check out" with nothing in Stripe). Every spec here runs on every device
 * project (iPhone, Android, Mac + Windows desktop), because a refusal that is
 * on screen on a 1920px desktop can sit two screens above a phone's viewport.
 *
 * Reproduced on prod 10-26: a WV shopper adds a tree as "Shipped" (fall wave,
 * still open), switches to "Farm pickup" at checkout, and the backend refuses
 * the fall pickup wave (closed Oct 15). The refusal and its "Switch this order
 * to the spring wave" fix render at the TOP of the form while the shopper is at
 * the Fulfillment radios, and "Continue to payment" greys out with no reason.
 *
 * EXPECTED RED on iphone / android / desktop-mac until the checkout UI hotfix
 * (GOL-3648, grove-sites#1197) is deployed to the target. e2e-nursery.yml is
 * workflow_dispatch-only and not a required check, so this does not block PRs;
 * it is meant to fail the release-train gate run until the fix ships.
 */

const checkoutForm = (page: import("@playwright/test").Page) =>
  page.locator("form.grove-checkout__grid");

test.describe("checkout surfaces every refusal", () => {
  test("switching a shipped pre-order to farm pickup shows any refusal on screen", async ({
    page,
    apiCalls,
  }) => {
    const product = await findProductByCtaOrNull(page, PREORDER_CTA, {
      preorder: { method: "ship", zone: 6, wave: "fall" },
    });
    test.skip(product === null, "no product with an open shipped pre-order wave today");
    if (!product) return;

    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, PREORDER_CTA, { method: "ship", zone: 6, wave: "fall" });
    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });

    await checkoutForm(page).getByText(/^Farm pickup/).click();
    // The state select and the radio each re-quote; judge only the settled one.
    await page.waitForLoadState("networkidle");

    const refusal = lastQuoteRefusal(apiCalls);
    const submit = page.locator(".grove-checkout__submit");
    if (refusal) {
      // The backend refused this wave for pickup: the shopper must SEE why,
      // where they are, and get a one-click way out.
      await expectRefusalVisible(page, refusal);
      await expect(page.getByRole("button", { name: /^Switch this order to the/ })).toBeVisible();
    } else {
      await expect(submit, "no refusal came back, yet Continue to payment is off").toBeEnabled();
    }
  });

  test("a disabled Continue to payment always has a visible reason", async ({ page }) => {
    const product = await findProductByCtaOrNull(page, PREORDER_CTA, {
      preorder: { method: "ship", zone: 6 },
    });
    test.skip(product === null, "no product with an open shipped pre-order wave today");
    if (!product) return;

    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, PREORDER_CTA, { method: "ship", zone: 6 });
    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV" });

    for (const choice of [/^Farm pickup/, /^Ship to me/]) {
      await checkoutForm(page).getByText(choice).click();
      const submit = page.locator(".grove-checkout__submit");
      await submit.scrollIntoViewIfNeeded();
      // Let the re-quote for the new fulfillment settle before judging the button.
      await page.waitForLoadState("networkidle");
      if (await submit.isDisabled()) {
        const alerts = page.getByRole("alert");
        const shown = [];
        for (const a of await alerts.all()) {
          if ((await a.isVisible()) && (await isInViewport(page, a))) shown.push(a);
        }
        expect(
          shown.length,
          `"Continue to payment" is disabled after choosing ${choice} with no alert on screen`,
        ).toBeGreaterThan(0);
      }
    }
  });

  test("going back from Review & pay keeps contact and address @stripe", async ({ page }) => {
    const product = await findProductByCtaOrNull(page, PREORDER_CTA, {
      preorder: { method: "ship", zone: 6 },
    });
    test.skip(product === null, "no product with an open shipped pre-order wave today");
    if (!product) return;

    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, PREORDER_CTA, { method: "ship", zone: 6 });
    await page.goto("/checkout");
    await fillCheckoutForm(page, { state: "WV", name: "Back Button Buyer" });
    const { status, errorBody } = await submitAndCaptureSession(page);
    expect(status, `session refused: ${errorBody}`).toBe(200);
    await expectOnReview(page);

    await page.getByRole("button", { name: "Edit contact or shipping" }).click();
    const form = checkoutForm(page);
    await expect(form.getByLabel("Full name")).toHaveValue("Back Button Buyer");
    await expect(form.getByLabel("Street")).not.toHaveValue("");
    await expect(form.getByLabel("ZIP")).not.toHaveValue("");
  });
});
