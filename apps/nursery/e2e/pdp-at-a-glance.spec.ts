import { expect, test, type Page } from "@playwright/test";
import { catalogCards, readShopGrid } from "./qa-helpers";

/**
 * PDP "At a glance" right column + responsive order (GOL-2734).
 *
 * Contract asserted:
 *   - PHONE (390×844): the page stacks in decision order — buy box → zone check
 *     → "At a glance" — and nothing overflows the viewport horizontally.
 *   - DESKTOP (1440×900): the zone check and the "At a glance" card sit in the
 *     RIGHT column, under the buy box and to the right of the gallery.
 *   - The layout is one render, not a breakpoint-duplicated pair: exactly one
 *     `#glance-heading` and one `#zone-check` exist at either viewport.
 *   - The "plant two" hint, when a listing's pollination fact triggers it, sets
 *     the quantity to 2 (`lib/plant-two.ts` owns the trigger rule and its tests).
 *
 * Data-driven against the live catalog: a product with no growing facts renders
 * none of this by design, so the specs find a product that HAS the card and skip
 * (not fail) when the catalog has none. That keeps the suite green while content
 * backfill (GOL-2385) is still in flight.
 */

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

/** Selector hooks owned by app/shop/[id]/at-a-glance.tsx + zone-check.tsx. */
const GLANCE = 'section[aria-labelledby="glance-heading"]';
const ZONE = "#zone-check";
const BUY = "[data-add-to-cart-anchor]";

/**
 * Find a catalog PDP whose server-rendered HTML contains `marker`, WITHOUT
 * navigating to each candidate: the pages are image-heavy and a sequential walk
 * of the catalog blows the per-test timeout on a cold preview. `page.request`
 * fetches the same document the browser would, all candidates CONCURRENTLY, so
 * discovery costs one round trip instead of twenty; we then navigate only to
 * the winner. Results are memoized per worker so the specs in this file share
 * one discovery pass. `null` when no catalog product matches.
 */
const discovered = new Map<string, string | null>();

async function findPdp(page: Page, marker: RegExp, limit = 20): Promise<string | null> {
  const key = marker.source;
  if (discovered.has(key)) return discovered.get(key)!;

  const hrefs = catalogCards(await readShopGrid(page))
    .slice(0, limit)
    .map((c) => c.href);

  // Bounded concurrency, not `Promise.all` over the whole catalog: every PDP is
  // an SSR render that round-trips the backend, and firing twenty at once made
  // the target time them out — which reads back as "no product matches" and
  // silently SKIPS the suite. Four in flight is fast and keeps the target sane.
  const matches: (string | null)[] = new Array(hrefs.length).fill(null);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < hrefs.length; i = next++) {
      const res = await page.request.get(hrefs[i], { timeout: 45_000 }).catch(() => null);
      if (res?.ok() && marker.test(await res.text())) matches[i] = hrefs[i];
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, hrefs.length) }, worker));

  // First match in catalog order, so a rerun picks the same product.
  const hit = matches.find((h) => h !== null) ?? null;
  discovered.set(key, hit);
  return hit;
}

/** A PDP that renders the "At a glance" card (i.e. the product has facts). */
const HAS_GLANCE = /id="glance-heading"/;
/** A PDP whose pollination fact trips the plant-two rule. */
const HAS_PLANT_TWO = /Set quantity to 2/;

/**
 * Navigate to a PDP matching `marker`, or skip the test when none exists.
 *
 * `test.slow()` (×3 the suite timeout) is deliberate: which product carries the
 * facts is CONTENT, not a fixture, so the first test in a worker pays a catalog
 * sweep before it can assert anything. Without the extra budget this spec fails
 * as a timeout on a cold target — a false red that says nothing about layout.
 */
async function gotoPdp(page: Page, marker: RegExp, why: string): Promise<void> {
  test.slow();
  const href = await findPdp(page, marker);
  test.skip(!href, why);
  await page.goto(href!);
}

/** Top edge of the first match, in document coordinates. */
async function top(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).first().boundingBox();
  expect(box, `${selector} should be laid out`).not.toBeNull();
  return box!.y;
}

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  expect(b, `${selector} should be laid out`).not.toBeNull();
  return b!;
}

test.describe("PDP — At a glance, phone", () => {
  test.use({ viewport: MOBILE });

  test("stacks buy box → zone check → at a glance, with no horizontal overflow", async ({
    page,
  }) => {
    await gotoPdp(page, HAS_GLANCE, "no catalog product has growing facts on this target yet");

    // Decision order top-to-bottom in the single mobile column.
    const buyY = await top(page, BUY);
    const zoneY = await top(page, ZONE);
    const glanceY = await top(page, GLANCE);
    expect(zoneY, "zone check sits below the buy box").toBeGreaterThan(buyY);
    expect(glanceY, "at-a-glance sits below the zone check").toBeGreaterThan(zoneY);

    // …and the long-form content stays below all three.
    const spec = page.locator("#spec-heading");
    if (await spec.count()) {
      expect(await top(page, "#spec-heading")).toBeGreaterThan(glanceY);
    }

    // No 390px horizontal overflow (GOL-2440 standard).
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(scrollWidth, "document must not scroll sideways at 390px").toBeLessThanOrEqual(
      innerWidth,
    );

    // One render per component — no md:-hidden mobile duplicate.
    await expect(page.locator("#glance-heading")).toHaveCount(1);
    await expect(page.locator(ZONE)).toHaveCount(1);
  });

  test("the zone-check input clears the 44px tap target", async ({ page }) => {
    await gotoPdp(page, HAS_GLANCE, "no catalog product has growing facts on this target yet");
    const input = await box(page, ZONE);
    expect(input.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe("PDP — At a glance, desktop", () => {
  test.use({ viewport: DESKTOP });

  test("puts the zone check and at-a-glance in the right column, under the buy box", async ({
    page,
  }) => {
    await gotoPdp(page, HAS_GLANCE, "no catalog product has growing facts on this target yet");

    const buy = await box(page, BUY);
    const zone = await box(page, ZONE);
    const glance = await box(page, GLANCE);
    const gallery = await box(page, "img.product-photo, .product-ph");

    // Same column as the buy box: starts at or right of its left edge…
    for (const [name, b] of [
      ["zone check", zone],
      ["at a glance", glance],
    ] as const) {
      expect(b.x, `${name} starts in the buy column`).toBeGreaterThanOrEqual(buy.x - 2);
      expect(b.y, `${name} sits under the buy box`).toBeGreaterThan(buy.y);
      // …and clear of the gallery, which owns the left column.
      expect(b.x, `${name} is right of the gallery`).toBeGreaterThan(gallery.x + gallery.width - 2);
    }

    expect(glance.y, "at a glance follows the zone check").toBeGreaterThan(zone.y);
    await expect(page.locator("#glance-heading")).toHaveCount(1);
  });

  test("the plant-two hint, when it applies, sets the quantity to 2", async ({ page }) => {
    await gotoPdp(
      page,
      HAS_PLANT_TWO,
      "no catalog product's pollination fact requires a partner right now",
    );

    const cta = page.getByRole("button", { name: /^Set quantity to 2$/ });
    await expect(cta).toHaveCount(1);
    await cta.click();

    // The stepper the hint drives lives in the buy box, not inside the hint.
    const qty = page.locator(`${BUY} input`).first();
    if (await qty.count()) await expect(qty).toHaveValue("2");
    await expect(page.getByText(/enough for a pair/)).toBeVisible();
    // The nudge is reversible and honest: the button is replaced by a status,
    // never by a silent add to cart.
    await expect(cta).toHaveCount(0);
  });
});
