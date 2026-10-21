import type {
  ApiPlannerBundle,
  ApiPlannerCatalog,
  ApiPlannerPlant,
  OdooClient,
  ProductVariant,
  ShippingCalendar,
} from "@grove/odoo-client";
import type { PlannerCatalog } from "@grove/planner";
import { FIXTURE_CATALOG } from "@grove/planner/fixtures";

/**
 * The planner catalog as the BFF hands it to the browser (order-builder spec
 * §B + §C): the Odoo feed, every plant and bundle resolved to the
 * `product.product` id the cart keys lines by, plus the per-zone ship calendar
 * the result card reads ship timing and pre-order waves from.
 *
 * Why the variant resolution lives here: the feed carries TEMPLATE ids (its
 * facts are template fields), while `useCart().add()` and the checkout session
 * post `variant_id`. Resolving once, server-side, per 5-minute feed window
 * keeps the planner package free of Odoo and the browser free of N detail
 * fetches. A plant whose detail fetch fails keeps `variant_id: null` and the
 * card sends the shopper to the product page for that line instead of adding
 * a line the backend would reject.
 */
export interface PlannerCatalogPayload extends PlannerCatalog {
  calendar: ShippingCalendar | null;
  /** Where the plants came from; "fixture" only ever outside production. */
  source: "odoo" | "fixture";
}

/** The feed's own `Cache-Control: public, max-age=300` window, mirrored here. */
export const PLANNER_CATALOG_TTL_MS = 5 * 60 * 1000;

/** Detail fetches in flight at once while resolving variant ids. */
const DETAIL_CONCURRENCY = 4;

export interface LoadPlannerCatalogOptions {
  /** Serve the fixture catalog when Odoo has no feed (dev / preview only). */
  allowFixture: boolean;
  /** Injectable clock for the memo window (tests). */
  now?: () => number;
}

/**
 * Pick the variant a planner line should add: the plant's shipping tier, in
 * stock if possible; else that tier at all; else the first variant.
 */
export function pickPlannerVariant(
  variants: readonly ProductVariant[],
  tier: string | null,
): ProductVariant | null {
  if (variants.length === 0) return null;
  const ofTier = variants.filter((v) => (v.shippingTier ?? null) === tier);
  return ofTier.find((v) => v.available) ?? ofTier[0] ?? variants[0];
}

async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i]);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function resolveVariant(
  odoo: OdooClient,
  templateId: number,
  tier: string | null,
): Promise<{ variant_id: number | null; price: number | null }> {
  try {
    const detail = await odoo.products.get(templateId);
    const v = pickPlannerVariant(detail.variants, tier);
    return { variant_id: v?.id ?? null, price: v?.price ?? null };
  } catch {
    return { variant_id: null, price: null };
  }
}

/** Resolve `variant_id` (and the variant's price) for every row that lacks one. */
export async function enrichWithVariants(
  odoo: OdooClient,
  feed: ApiPlannerCatalog,
): Promise<ApiPlannerCatalog> {
  const plants = await mapLimit(feed.plants, DETAIL_CONCURRENCY, async (p): Promise<ApiPlannerPlant> => {
    if (p.variant_id) return p;
    const r = await resolveVariant(odoo, p.id, p.tier);
    return { ...p, variant_id: r.variant_id, price: r.price ?? p.price };
  });
  const bundles = await mapLimit(feed.bundles, DETAIL_CONCURRENCY, async (b): Promise<ApiPlannerBundle> => {
    if (b.variant_id) return b;
    const r = await resolveVariant(odoo, b.id, null);
    return { ...b, variant_id: r.variant_id, price: r.price ?? b.price };
  });
  return { ...feed, plants, bundles };
}

let memo: { at: number; payload: PlannerCatalogPayload } | null = null;

/** Drop the memoised payload (tests). */
export function resetPlannerCatalogMemo(): void {
  memo = null;
}

/**
 * Load the catalog the planner runs over, memoised for the feed's TTL.
 * Returns null when Odoo has no feed and the fixture is not allowed, so the
 * route can answer 503 and the card can show its error state.
 */
export async function loadPlannerCatalog(
  odoo: OdooClient,
  opts: LoadPlannerCatalogOptions,
): Promise<PlannerCatalogPayload | null> {
  const now = opts.now ?? Date.now;
  if (memo && now() - memo.at < PLANNER_CATALOG_TTL_MS) return memo.payload;

  let calendar: ShippingCalendar | null = null;
  try {
    calendar = (await odoo.shipping.rateFeed())?.calendar ?? null;
  } catch {
    calendar = null;
  }

  let feed: ApiPlannerCatalog | null = null;
  try {
    feed = await odoo.planner.catalog();
  } catch {
    feed = null;
  }

  let payload: PlannerCatalogPayload;
  if (feed) {
    payload = { ...(await enrichWithVariants(odoo, feed)), calendar, source: "odoo" };
  } else if (opts.allowFixture) {
    payload = { ...FIXTURE_CATALOG, calendar, source: "fixture" };
  } else {
    return null;
  }
  memo = { at: now(), payload };
  return payload;
}
