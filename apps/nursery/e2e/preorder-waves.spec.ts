import { expect, test, type Page } from "@playwright/test";
import {
  expectOnReview,
  findPairedProduct,
  fillCheckoutForm,
  fulfillmentToggle,
  pottedSeasonToday,
  submitAndCaptureSession,
} from "./helpers";

/**
 * Fall / spring bareroot pre-order waves (hotfix 2026-10-07, Josh's rulings).
 *
 * Like the rest of this suite these run against the deployed QA storefront +
 * backend (no local backend; CI runs them on the preview droplet). The backend
 * validates season and waves on its real clock, which a browser-side
 * `page.clock` cannot move, so specs hold on the REAL date: the potted-dependent
 * one skips (with a reason) outside May 1 to Oct 15, and neither pins the clock.
 */

async function clickAddToCart(page: Page, label: string) {
  const anchor = page.locator("[data-add-to-cart-anchor]").first();
  await anchor.getByRole("button", { name: label, exact: true }).first().click();
  return anchor;
}

test.describe("pre-order waves", () => {
  test("a shipped zone 8 spring pre-order sends shipWave spring and a $10 deposit", async ({
    page,
  }) => {
    const { product, scanned, listings } = await findPairedProduct(page, { needPotted: false });
    test.skip(
      product === null,
      `none of the ${scanned} scanned PDPs (of ${listings} listings) carried the Bareroot pre-order card`,
    );
    if (!product) return;

    await page.goto(product.href);
    await fulfillmentToggle(page, "ship").click();
    await page.locator("#usda-zone").selectOption("8");
    await page.getByRole("button", { name: /^Bareroot pre-order/ }).first().click();
    const spring = page.getByRole("button", { name: /^Spring wave/ });
    await expect(spring).toBeVisible();
    test.skip(
      (await spring.getAttribute("aria-disabled")) === "true",
      "the zone 8 spring wave is closed today (past its order-by or before Sep 1)",
    );
    await spring.click();
    await expect(spring).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByText("Pre-orders check out on their own, one wave per order."),
    ).toBeVisible();

    const anchor = await clickAddToCart(page, "Pre-order for $10");
    await expect(
      anchor.getByRole("button", { name: "Added!", exact: true }).first(),
    ).toBeVisible({ timeout: 5_000 });

    await page.goto("/checkout");
    await expect(page.getByTestId("order-type")).toHaveText(
      "Pre-order · spring wave · $10 deposit today, balance when your trees ship",
    );

    // Georgia is a green-list state in USDA zone 8, matching the zone chosen on the PDP.
    await fillCheckoutForm(page, {
      state: "GA",
      city: "Atlanta",
      zip: "30301",
      street: "100 Peachtree St",
    });
    const sessionBodies: unknown[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/checkout/session") && req.method() === "POST") {
        sessionBodies.push(JSON.parse(req.postData() ?? "{}"));
      }
    });
    const { status, body, errorBody } = await submitAndCaptureSession(page);
    expect(status, `session must be created; server said: ${errorBody ?? "(no body)"}`).toBe(200);
    expect(sessionBodies).toHaveLength(1);
    expect(sessionBodies[0]).toMatchObject({ shipWave: "spring" });
    const deposit = (body?.lineItems ?? []).filter((l) => l.kind === "deposit");
    expect(deposit).toHaveLength(1);
    expect(deposit[0].unitAmount * deposit[0].quantity).toBe(10);
    expect(body?.amountDueToday).toBe(10);
    await expectOnReview(page);
  });

  test("adding a pre-order to a cart that holds a potted line is refused", async ({ page }) => {
    test.skip(
      !pottedSeasonToday(),
      "real date is outside the potted season (May 1 to Oct 15); no immediate line to conflict with",
    );
    const { product, scanned, listings } = await findPairedProduct(page, { needPotted: true });
    test.skip(
      product === null,
      `none of the ${scanned} scanned PDPs (of ${listings} listings) had both a potted format and the Bareroot pre-order card`,
    );
    if (!product) return;

    // Immediate line first: potted for Farm pickup.
    await page.goto(product.href);
    await fulfillmentToggle(page, "pickup").click();
    await page.getByRole("button", { name: /^Potted/ }).first().click();
    const anchor = await clickAddToCart(page, "Add to cart");
    await expect(
      anchor.getByRole("button", { name: "Added!", exact: true }).first(),
    ).toBeVisible({ timeout: 5_000 });

    // Now a pre-order on the same listing: the cart is immediate, so it must refuse.
    await page.reload();
    await fulfillmentToggle(page, "pickup").click();
    await page.getByRole("button", { name: /^Bareroot pre-order/ }).first().click();
    const openWave = page
      .getByRole("group", { name: "Pre-order wave" })
      .getByRole("button")
      .and(page.locator('[aria-disabled="false"]'))
      .first();
    await expect(openWave, "an open farm-zone pickup wave is needed").toBeVisible();
    await openWave.click();
    await clickAddToCart(page, "Pre-order for $10");
    await expect(
      page.getByText("Pre-orders check out on their own. Check out or clear your cart first."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Added!", exact: true })).toHaveCount(0);
  });
});
