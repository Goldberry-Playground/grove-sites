import { expect, test } from "@playwright/test";
import {
  expectOnReview,
  findPairedProductOrNull,
  fillCheckoutForm,
  fulfillmentToggle,
  submitAndCaptureSession,
} from "./helpers";

/**
 * Fall / spring bareroot pre-order waves (hotfix 2026-10-07, Josh's rulings).
 *
 * Like the rest of this suite these run against the deployed QA storefront +
 * backend (no local backend; CI runs them on the preview droplet). The browser
 * clock is pinned with `page.clock.setFixedTime` so client-side season logic is
 * deterministic; server-rendered dates still come from the server clock, so the
 * specs assert behaviour that holds on either side of that skew and skip when the
 * QA catalog lacks the paired Potted + Bareroot fixture.
 */

const NO_FIXTURE =
  "no listing with both a Potted and a Bareroot pre-order format in the QA catalog";

async function clickAddToCart(page: import("@playwright/test").Page, label: string) {
  const anchor = page.locator("[data-add-to-cart-anchor]").first();
  await anchor.getByRole("button", { name: label, exact: true }).first().click();
  return anchor;
}

test.describe("pre-order waves", () => {
  test("a shipped zone 8 spring pre-order sends shipWave spring and a $10 deposit", async ({
    page,
  }) => {
    await page.clock.setFixedTime(new Date("2026-10-20T12:00:00-04:00"));
    const product = await findPairedProductOrNull(page);
    test.skip(product === null, NO_FIXTURE);
    if (!product) return;

    await page.goto(product.href);
    await fulfillmentToggle(page, "ship").click();
    await page.locator("#usda-zone").selectOption("8");
    await page.getByRole("button", { name: /^Bareroot pre-order/ }).first().click();
    const spring = page.getByRole("button", { name: /^Spring wave/ });
    await expect(spring).toBeVisible();
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

    await fillCheckoutForm(page, { state: "WV" });
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
    await page.clock.setFixedTime(new Date("2026-10-07T12:00:00-04:00"));
    const product = await findPairedProductOrNull(page);
    test.skip(product === null, NO_FIXTURE);
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
    await expect(openWave).toBeVisible();
    await openWave.click();
    await clickAddToCart(page, "Pre-order for $10");
    await expect(
      page.getByText("Pre-orders check out on their own. Check out or clear your cart first."),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Added!", exact: true })).toHaveCount(0);
  });
});
