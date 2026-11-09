import { expect, test } from "@playwright/test";

// Header and footer only. Full pages carry a live catalog, so a pixel diff
// there would fail every time a product or photo changed.
const SITES = {
  nursery: "https://atthegrovenursery.com",
  farm: "https://goldberrygrove.farm",
  hub: "https://gatheringatthegrove.com",
  woodworking: "https://woodworkingeorge.com",
};

for (const [name, url] of Object.entries(SITES)) {
  test(`${name} header and footer`, async ({ page }) => {
    await page.goto(url, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator("header").first()).toHaveScreenshot(`${name}-header.png`);
    await expect(page.locator("footer").first()).toHaveScreenshot(`${name}-footer.png`);
  });
}
