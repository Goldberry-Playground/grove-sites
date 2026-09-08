import { expect, test } from "@playwright/test";
import {
  MIN_REAL_PHOTO_BYTES,
  catalogCards,
  heroPhoto,
  probeImage,
  readShopGrid,
} from "./qa-helpers";

/**
 * QA gate — accurate product photos.
 *
 * "Accurate" here means: every catalog product renders a REAL photo — not the
 * branded "Photo coming soon" fallback, and not Odoo's silent HTTP-200 gray
 * placeholder — and the photo the buyer sees is the product's own (the `alt`
 * carries the product name, the `src` resolves to that product's Odoo record).
 *
 * Why the byte probe: Odoo answers `/web/image/...` with a 200 + a 7 KB gray PNG
 * for imageless records, so `onError` never fires and a naive "image loaded"
 * check passes on a missing photo (product-image.tsx documents this). Fetching
 * the served bytes and requiring a real-photo size closes that hole.
 *
 * The two `AAA QA E2E ...` runner fixtures are excluded: they are seeded
 * without images by design (grove-odoo-modules seed_e2e_test_inventory.py).
 */
test.describe("qa gate — product photos", () => {
  test("every catalog card on /shop shows a real photo, not a placeholder", async ({
    page,
  }) => {
    const cards = catalogCards(await readShopGrid(page));
    expect(cards.length, "catalog should list products on /shop").toBeGreaterThan(0);

    // Grid cards render through the same ProductImage component as the PDP:
    // a real photo is `img.product-photo`, a fallback is `.product-ph`.
    const placeholders = await page
      .locator(".var-card")
      .filter({ has: page.locator(".product-ph") })
      .evaluateAll((els) =>
        els.map((el) => el.querySelector(".var-name")?.textContent?.trim() ?? "?"),
      );
    const catalogPlaceholders = placeholders.filter((n) => !/^AAA QA E2E /.test(n));
    expect(
      catalogPlaceholders,
      "catalog products rendering the 'Photo coming soon' placeholder",
    ).toEqual([]);

    // Every catalog card's <img> decoded and names the product.
    const photos = await page
      .locator(".var-card")
      .evaluateAll((els) =>
        els.map((el) => {
          const name = el.querySelector(".var-name")?.textContent?.trim() ?? "";
          const img = el.querySelector("img.product-photo") as HTMLImageElement | null;
          return {
            name,
            hasImg: !!img,
            alt: img?.alt ?? "",
            decoded: !!img && img.complete && img.naturalWidth > 0,
          };
        }),
      );
    for (const p of photos.filter((x) => !/^AAA QA E2E /.test(x.name))) {
      expect(p.hasImg, `${p.name}: card should render a photo element`).toBe(true);
      expect(p.alt, `${p.name}: photo alt should name the product`).toBe(p.name);
    }
    // Lazy grid images below the fold may not be decoded yet; require the
    // above-the-fold set (first 6) to have decoded.
    const aboveFold = photos.filter((x) => !/^AAA QA E2E /.test(x.name)).slice(0, 6);
    await expect
      .poll(
        async () =>
          page.locator(".var-card img.product-photo").evaluateAll((els) =>
            els.slice(0, 6).every((el) => (el as HTMLImageElement).naturalWidth > 0),
          ),
        { timeout: 20_000, message: "above-the-fold card photos should decode" },
      )
      .toBe(true);
    expect(aboveFold.length).toBeGreaterThan(0);
  });

  test("product-detail hero photos are the product's own real image", async ({ page }) => {
    // Sample the first N catalog products (grid is name-asc, so this is a stable
    // slice) rather than every PDP — keeps the gate under a minute while still
    // catching a broken image pipeline, which fails uniformly.
    const SAMPLE = 6;
    const cards = catalogCards(await readShopGrid(page)).slice(0, SAMPLE);
    expect(cards.length).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const card of cards) {
      await page.goto(card.href);
      const photo = await heroPhoto(page);
      if (!photo) {
        missing.push(`${card.name}: placeholder shown (no hero photo)`);
        continue;
      }
      expect(photo.alt, `${card.name}: hero alt should be the product name`).toBe(card.name);

      // Resolve what actually got served. `currentSrc` is the Next-optimized URL
      // (`/_next/image?url=<odoo web/image ...>`); probe it for real bytes.
      const served = await probeImage(page, new URL(photo.src, page.url()).toString());
      expect(served.status, `${card.name}: hero image request`).toBe(200);
      expect(
        served.contentType,
        `${card.name}: hero should be an image (got ${served.contentType})`,
      ).toMatch(/^image\//);
      if (served.bytes < MIN_REAL_PHOTO_BYTES) {
        missing.push(
          `${card.name}: served ${served.bytes} B (${served.contentType}) — looks like Odoo's gray placeholder, not a photo`,
        );
      }

      // Provenance: the optimized URL must point at an Odoo product image record,
      // so the photo can't be a stale/foreign asset.
      const inner = new URL(photo.src, page.url()).searchParams.get("url") ?? photo.src;
      expect(inner, `${card.name}: photo should come from an Odoo product image`).toMatch(
        /\/web\/image\/product\.(template|product|image)\//,
      );
    }
    expect(missing, "catalog PDPs without a real hero photo").toEqual([]);
  });
});
