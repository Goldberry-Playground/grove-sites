import { expectRefusalVisible, lastQuoteRefusal, test, expect } from "../watchdog";
import {
  PREORDER_CTA,
  addCurrentProductToCart,
  collectProductHrefs,
  expectOnReview,
  fillCheckoutForm,
  findProductByCta,
  payAtReview,
  submitAndCaptureSession,
} from "../helpers";

/**
 * Production checkout canary (@synthetic). Runs on a schedule against PROD
 * (.github/workflows/synthetic-nursery.yml) on iPhone, Android, Mac and Windows
 * viewports, and with the rest of the suite against QA. It walks what a WV buyer
 * walks: shop grid, a bareroot pre-order PDP, cart, checkout (shipped AND farm
 * pickup), and fails on any /api 5xx, any page crash, any quote refusal the
 * shopper cannot see, or a Continue button that never enables.
 *
 * It NEVER pays. Creating a Stripe session also creates a draft sale order in
 * Odoo, so the session step only runs when SYNTHETIC_CREATE_SESSION=1 (the
 * workflow's twice-daily full run) and always uses a `synthetic-canary+…`
 * address, so the drafts are easy to filter and clean up. It stops once
 * Stripe's hosted page has rendered its Pay button (Chromium; on WebKit it
 * stops at the checkout.stripe.com hand-off, see GOL-3661).
 */

const CREATE_SESSION = process.env.SYNTHETIC_CREATE_SESSION === "1";
const canaryEmail = () => `synthetic-canary+${Date.now().toString(36)}@goldberrygrove.farm`;
const WV = { state: "WV", city: "Summersville", zip: "26651" } as const;

test.describe("@synthetic nursery checkout canary", () => {
  test("shop grid lists buyable products", async ({ page }) => {
    const hrefs = await collectProductHrefs(page);
    expect(hrefs.length, "shop grid rendered no products").toBeGreaterThan(5);
  });

  test("a WV shipped pre-order reaches payment", async ({ page, apiCalls, browserName }) => {
    const product = await findProductByCta(page, PREORDER_CTA, {
      preorder: { method: "ship", zone: 6 },
    });
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, PREORDER_CTA, { method: "ship", zone: 6 });

    await page.goto("/cart");
    await expect(page.getByRole("heading", { name: "Your Cart" })).toBeVisible();

    await page.goto("/checkout");
    await fillCheckoutForm(page, { ...WV, name: "Synthetic Canary", email: canaryEmail() });
    const submit = page.locator(".grove-checkout__submit");
    await expect(submit, "Continue to payment never enabled for a WV shipped order").toBeEnabled();
    const refused = apiCalls.filter((c) => c.path === "/api/cart/quote" && c.status >= 400);
    expect(refused, "the cart quote refused a fresh WV shipped pre-order").toEqual([]);

    if (!CREATE_SESSION) return;
    const { status, errorBody } = await submitAndCaptureSession(page);
    expect(status, `checkout session refused: ${errorBody}`).toBe(200);
    await expectOnReview(page);
    await payAtReview(page);
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30_000 });
    // Our part ends at the hand-off to a live Stripe session. Playwright's Linux
    // WebKit build cannot load Stripe's hosted page (its `payment_pages/:id/init`
    // fetch fails with "Load failed" on every run, GOL-3661), so the Pay button is
    // only checked in Chromium. That is a test-browser limit, not real Safari.
    if (browserName === "webkit") return;
    await expect(
      page.getByRole("button", { name: /^(Pay|Subscribe|Reserve)/ }).last(),
      "Stripe's hosted page did not render its Pay button",
    ).toBeVisible({ timeout: 30_000 });
  });

  test("a WV farm pickup pre-order reaches payment or explains why not", async ({
    page,
    apiCalls,
  }) => {
    const product = await findProductByCta(page, PREORDER_CTA, { preorder: { method: "pickup" } });
    await page.goto(product.href);
    await addCurrentProductToCart(page, 1, PREORDER_CTA, { method: "pickup" });

    await page.goto("/checkout");
    await fillCheckoutForm(page, { ...WV, name: "Synthetic Canary", email: canaryEmail() });
    const pickup = page.locator("form.grove-checkout__grid").getByText(/^Farm pickup/);
    // A pickup-only cart locks the form to pickup and may render no radio.
    if ((await pickup.count()) > 0) await pickup.click();
    await page.waitForLoadState("networkidle");

    const refusal = lastQuoteRefusal(apiCalls);
    if (refusal) {
      await expectRefusalVisible(page, refusal);
      const requoted = page.waitForResponse((r) => r.url().includes("/api/cart/quote"));
      await page.getByRole("button", { name: /^Switch this order to the/ }).click();
      expect((await requoted).status(), "the offered wave switch was refused too").toBe(200);
    }
    await expect(
      page.locator(".grove-checkout__submit"),
      "Continue to payment never enabled for a WV farm pickup",
    ).toBeEnabled();
  });
});
