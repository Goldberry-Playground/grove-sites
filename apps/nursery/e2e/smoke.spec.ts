import { expect, test } from "@playwright/test";

/**
 * Runner smoke test (GOL-1074, Terra / infra).
 *
 * This is NOT one of the 6 acceptance specs (those are owned by Ada — see
 * README.md). Its only job is to prove the Playwright runner + config +
 * CI wiring are healthy against whatever `E2E_NURSERY_BASE_URL` points at,
 * WITHOUT depending on the GOL-899 Stripe test keys or seeded QA inventory.
 *
 * Keep it dependency-free so a red here always means "the runner/target is
 * broken", never "a checkout assertion changed".
 */
test.describe("nursery storefront — runner smoke", () => {
  test("storefront home responds and renders", async ({ page }) => {
    const res = await page.goto("/");
    expect(res, "no response from baseURL — is the preview droplet up?").toBeTruthy();
    expect(res!.status(), "home page should be 2xx/3xx").toBeLessThan(400);
    await expect(page).toHaveTitle(/.+/);
  });

  test("cart route is reachable", async ({ page }) => {
    const res = await page.goto("/cart");
    expect(res!.status()).toBeLessThan(400);
  });
});
