# PDP Pickup / Shipped Selector Hotfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop every nursery listing from offering "Potted" as a shipped format by putting a Farm pickup / Shipped choice ahead of Format, and lock a potted line to farm pickup in the cart.

**Architecture:** Storefront only (grove-sites). A new pure helper `apps/nursery/lib/fulfillment-method.ts` decides which Format values a shopper sees for the chosen method and date. `product-view.tsx` renders the method selector, filters Format cards through the helper, relabels by method, and marks a pickup-chosen potted line `pickupOnly: true` so the existing GOL-2588 checkout lock forces pickup. No backend, charge, or deposit change (those are the Train 3 follow-up).

**Tech Stack:** Next.js (App Router) + React, TypeScript, vitest (root `pnpm test`), turbo lint/type-check.

**Spec:** Josh's rulings 2026-10-07 (this session; memory `nursery-format-gate-pickup-vs-shipped`), vault `Software/Grove Peat and Bagged Shipping.md` (ratified 2026-09-01). Hotfix scope approved 2026-10-07: "remove the Potted card from Shipped and add the Pickup / Shipped selector. Nothing about charges changes."

## Global Constraints

- Shipped never offers a format labelled "Potted". A potted-tier variant shown under Shipped is labelled "Peat & bagged".
- Farm pickup shows "Potted" during the potted season and a bareroot option otherwise.
- Potted season = feed `calendar.leafed_window` inclusive (prod: May 1 to Oct 15); fallback `[[5, 1], [10, 15]]` when the feed has no calendar.
- Month/day comparisons use UTC (`monthDayOf` in `lib/fulfillment-mode.ts`), matching every other calendar check.
- No charge, deposit, or backend request change. Checkout request shape is untouched.
- Copy rules: no em dashes, sentence case, plain factual tone (listing-copy-style-rules).
- Ignore iCloud duplicate files whose names contain " 2".
- Never `git stash` (shared across worktrees).

## File map

| File | Change |
|---|---|
| `apps/nursery/lib/fulfillment-method.ts` | **Create.** `FulfillmentMethod`, `isPottedSeason`, `formatsForMethod`, `methodFormatLabel` |
| `apps/nursery/lib/fulfillment-method.test.ts` | **Create.** Unit tests |
| `apps/nursery/app/shop/[id]/product-view.tsx` | **Modify.** Method state + selector, filtered formats, labels, cart `pickupOnly` |
| `apps/nursery/app/shop/[id]/product-view.copy.test.ts` | **Modify.** Source-text assertions for the selector copy |

---

### Task 1: `fulfillment-method` pure helper

**Files:**
- Create: `apps/nursery/lib/fulfillment-method.ts`
- Test: `apps/nursery/lib/fulfillment-method.test.ts`

**Interfaces:**
- Consumes: `ShippingCalendar`, `MonthDay`, `ShippingTier` from `@grove/odoo-client`; `monthDayOf` from `./fulfillment-mode`; `FulfillmentPref` from `./fulfillment-pref`.
- Produces:
  - `type FulfillmentMethod = FulfillmentPref` (`"ship" | "pickup"`)
  - `POTTED_SEASON_FALLBACK: [MonthDay, MonthDay]`
  - `isPottedSeason(date: Date, calendar?: ShippingCalendar | null): boolean`
  - `formatsForMethod(formats: string[], method: FulfillmentMethod, tierOf: (format: string) => ShippingTier, opts: { pottedSeason: boolean; isPurchasable: (format: string) => boolean }): string[]`
  - `methodFormatLabel(method: FulfillmentMethod, tier: ShippingTier, computedLabel: string): string`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect } from "vitest";
import type { ShippingCalendar, ShippingTier } from "@grove/odoo-client";
import {
  formatsForMethod,
  isPottedSeason,
  methodFormatLabel,
  POTTED_SEASON_FALLBACK,
} from "./fulfillment-method";

const utc = (m: number, d: number) => new Date(Date.UTC(2026, m - 1, d, 12));
const cal = { leafed_window: [[5, 1], [10, 15]] } as unknown as ShippingCalendar;
const tierOf = (f: string): ShippingTier => (/bare\s*-?\s*root/i.test(f) ? "bareroot" : "potted");
const all = () => true;

describe("isPottedSeason", () => {
  it("is inclusive of both leafed_window endpoints", () => {
    expect(isPottedSeason(utc(5, 1), cal)).toBe(true);
    expect(isPottedSeason(utc(10, 15), cal)).toBe(true);
  });
  it("is false outside the window", () => {
    expect(isPottedSeason(utc(10, 16), cal)).toBe(false);
    expect(isPottedSeason(utc(4, 30), cal)).toBe(false);
    expect(isPottedSeason(utc(1, 10), cal)).toBe(false);
  });
  it("falls back to May 1 to Oct 15 with no calendar", () => {
    expect(POTTED_SEASON_FALLBACK).toEqual([[5, 1], [10, 15]]);
    expect(isPottedSeason(utc(10, 7), null)).toBe(true);
    expect(isPottedSeason(utc(10, 16), undefined)).toBe(false);
  });
});

describe("formatsForMethod", () => {
  const both = ["Bareroot", "Potted"];

  it("ship never returns a potted format when a bareroot one exists", () => {
    expect(formatsForMethod(both, "ship", tierOf, { pottedSeason: true, isPurchasable: all })).toEqual(["Bareroot"]);
    expect(formatsForMethod(both, "ship", tierOf, { pottedSeason: false, isPurchasable: all })).toEqual(["Bareroot"]);
  });

  it("ship keeps a potted-only product in season (shown as peat and bagged)", () => {
    expect(formatsForMethod(["Potted"], "ship", tierOf, { pottedSeason: true, isPurchasable: all })).toEqual(["Potted"]);
  });

  it("ship offers nothing for a potted-only product out of season", () => {
    expect(formatsForMethod(["Potted"], "ship", tierOf, { pottedSeason: false, isPurchasable: all })).toEqual([]);
  });

  it("pickup shows only potted in season when potted is purchasable", () => {
    expect(formatsForMethod(both, "pickup", tierOf, { pottedSeason: true, isPurchasable: all })).toEqual(["Potted"]);
  });

  it("pickup falls back to bareroot when potted is sold out in season", () => {
    const pottedSoldOut = (f: string) => tierOf(f) !== "potted";
    expect(formatsForMethod(both, "pickup", tierOf, { pottedSeason: true, isPurchasable: pottedSoldOut })).toEqual(["Bareroot"]);
  });

  it("pickup shows bareroot out of season", () => {
    expect(formatsForMethod(both, "pickup", tierOf, { pottedSeason: false, isPurchasable: all })).toEqual(["Bareroot"]);
  });

  it("pickup keeps a potted-only product so the card can show sold out", () => {
    expect(formatsForMethod(["Potted"], "pickup", tierOf, { pottedSeason: false, isPurchasable: () => false })).toEqual(["Potted"]);
  });

  it("formatless products (single variant) pass through by tier", () => {
    expect(formatsForMethod([], "ship", tierOf, { pottedSeason: true, isPurchasable: all })).toEqual([]);
  });
});

describe("methodFormatLabel", () => {
  it("names a shipped potted variant peat and bagged", () => {
    expect(methodFormatLabel("ship", "potted", "Potted")).toBe("Peat & bagged");
  });
  it("names a pickup bareroot variant bareroot pre-order", () => {
    expect(methodFormatLabel("pickup", "bareroot", "Peat & bagged")).toBe("Bareroot pre-order");
  });
  it("leaves every other combination alone", () => {
    expect(methodFormatLabel("ship", "bareroot", "Peat & bagged")).toBe("Peat & bagged");
    expect(methodFormatLabel("ship", "bareroot", "Bareroot")).toBe("Bareroot");
    expect(methodFormatLabel("pickup", "potted", "Potted")).toBe("Potted");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run apps/nursery/lib/fulfillment-method.test.ts`
Expected: FAIL, cannot resolve `./fulfillment-method`.

- [ ] **Step 3: Implement**

```ts
import type { MonthDay, ShippingCalendar, ShippingTier } from "@grove/odoo-client";
import { monthDayOf } from "./fulfillment-mode";
import type { FulfillmentPref } from "./fulfillment-pref";

/**
 * Farm pickup vs Shipped, chosen BEFORE Format on the PDP (Josh 2026-10-07).
 *
 * Odoo holds one potted stock pool. Shipped, a potted tree leaves the pot at
 * packing and travels peat and bagged; picked up, it goes home in the pot. So
 * Shipped never offers a "Potted" card, and Farm pickup shows Potted only in the
 * potted season (feed `leafed_window`, prod May 1 to Oct 15). Outside it, both
 * methods fall to the bareroot variant, whose charge shape is still decided by
 * the GOL-2233 rule in `fulfillment-mode.ts`. Spec: vault "Grove Peat and Bagged
 * Shipping" + memory nursery-format-gate-pickup-vs-shipped.
 */
export type FulfillmentMethod = FulfillmentPref;

/** Prod `leafed_window`, used only when the feed carries no calendar. */
export const POTTED_SEASON_FALLBACK: [MonthDay, MonthDay] = [
  [5, 1],
  [10, 15],
];

const ord = (md: MonthDay) => md[0] * 100 + md[1];

/** Is `date` (UTC month/day) inside the potted season, endpoints inclusive? */
export function isPottedSeason(date: Date, calendar?: ShippingCalendar | null): boolean {
  const [start, end] = calendar?.leafed_window ?? POTTED_SEASON_FALLBACK;
  const d = ord(monthDayOf(date));
  return d >= ord(start) && d <= ord(end);
}

/**
 * The Format values to render for `method`. Display order is preserved.
 *  - ship: every non-potted format; a potted-only product keeps its potted
 *    format in season (labelled peat and bagged) and offers nothing out of it.
 *  - pickup: potted formats in season while one is purchasable; otherwise the
 *    non-potted formats; a potted-only product keeps its potted format so the
 *    card can still say sold out.
 */
export function formatsForMethod(
  formats: string[],
  method: FulfillmentMethod,
  tierOf: (format: string) => ShippingTier,
  opts: { pottedSeason: boolean; isPurchasable: (format: string) => boolean },
): string[] {
  const potted = formats.filter((f) => tierOf(f) === "potted");
  const other = formats.filter((f) => tierOf(f) !== "potted");
  if (method === "ship") {
    if (other.length > 0) return other;
    return opts.pottedSeason ? potted : [];
  }
  if (opts.pottedSeason && potted.some(opts.isPurchasable)) return potted;
  return other.length > 0 ? other : potted;
}

/** Card label for a format under the chosen method. */
export function methodFormatLabel(
  method: FulfillmentMethod,
  tier: ShippingTier,
  computedLabel: string,
): string {
  if (method === "ship" && tier === "potted") return "Peat & bagged";
  if (method === "pickup" && tier === "bareroot") return "Bareroot pre-order";
  return computedLabel;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run apps/nursery/lib/fulfillment-method.test.ts`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add apps/nursery/lib/fulfillment-method.ts apps/nursery/lib/fulfillment-method.test.ts
git commit -m "feat(nursery): fulfillment-method helper for the pickup/shipped format gate"
```

---

### Task 2: Wire the selector into the PDP

**Files:**
- Modify: `apps/nursery/app/shop/[id]/product-view.tsx` (imports; state block ~`:213-275`; `estimatorTiers` ~`:339-375`; `chooseCultivar`/`chooseFormat` ~`:385-420`; Format JSX `:546-651`; cart buttons `:814-825`, `:870-880`)
- Modify: `apps/nursery/app/shop/[id]/product-view.copy.test.ts`

**Interfaces:**
- Consumes: Task 1 exports; existing `formatOptions`, `defaultFormat`, `pickVariant`, `tierFor`, `isPickupOnly`, `readFulfillmentPref`, `writeFulfillmentPref`.
- Produces: no new exports.

- [ ] **Step 1: Write the failing source-text test**

Append to `product-view.copy.test.ts` (it already reads the component source with `readFileSync`; reuse its `src` variable name, check the file head for it):

```ts
describe("pickup / shipped gate (2026-10-07 hotfix)", () => {
  it("renders the method selector before Format", () => {
    expect(src).toContain("How do you want it?");
    expect(src).toContain("Farm pickup");
    expect(src).toContain("Shipped");
    expect(src.indexOf("How do you want it?")).toBeLessThan(src.indexOf(">Format<"));
  });
  it("filters formats through formatsForMethod and relabels by method", () => {
    expect(src).toContain("formatsForMethod(");
    expect(src).toContain("methodFormatLabel(");
  });
  it("locks a pickup-chosen potted line to pickup in the cart", () => {
    expect(src).toMatch(/method === "pickup" && selectedTier === "potted"/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run "apps/nursery/app/shop/[id]/product-view.copy.test.ts"`
Expected: FAIL on the new describe block.

- [ ] **Step 3: Add method state and filtered formats**

Imports (top of file):

```ts
import {
  formatsForMethod,
  isPottedSeason,
  methodFormatLabel,
  type FulfillmentMethod,
} from "@/lib/fulfillment-method";
```

(Match the file's existing import alias for `lib/`; if it imports `../../../lib/...` use that form.)

Replace the `formats` memo and `format` state (currently `const formats = useMemo(() => formatOptions(variants, cultivar), ...)` and the `useState` after it) with:

```ts
  // Farm pickup vs Shipped comes BEFORE Format (Josh 2026-10-07). SSR opens on
  // "ship"; the mount effect below restores the shopper's remembered intent.
  const [method, setMethod] = useState<FulfillmentMethod>("ship");
  const pottedSeason = isPottedSeason(new Date(), shippingFeed?.calendar ?? null);
  const tierOfFormat = (c: string | null, f: string) =>
    tierFor({ shippingTier: pickVariant(variants, { cultivar: c, format: f })?.shippingTier ?? null, format: f });
  const formatsFor = (m: FulfillmentMethod, c: string | null) =>
    formatsForMethod(formatOptions(variants, c), m, (f) => tierOfFormat(c, f), {
      pottedSeason,
      isPurchasable: (f) => isPurchasable(pickVariant(variants, { cultivar: c, format: f })),
    });
  const formats = useMemo(() => formatsFor(method, cultivar), [variants, cultivar, method, pottedSeason]);
  const [format, setFormat] = useState<string | null>(() =>
    defaultFormat(variants, formatsFor("ship", cultivar), cultivar, isPurchasable, isInStock),
  );
```

Replace the GOL-2089 mount effect (the `useEffect` that calls `readFulfillmentPref()` and `formatForPref`) with:

```ts
  // Restore the remembered ship-vs-pickup intent (GOL-2089) as the METHOD now,
  // not a format. Mount-only; an explicit click always wins afterwards.
  useEffect(() => {
    const pref = readFulfillmentPref();
    if (pref && pref !== method) chooseMethod(pref, { persist: false });
  }, []);
```

Add next to `chooseFormat`:

```ts
  function chooseMethod(next: FulfillmentMethod, opts: { persist?: boolean } = {}) {
    setMethod(next);
    const nextFormats = formatsFor(next, cultivar);
    setFormat(
      format && nextFormats.includes(format)
        ? format
        : defaultFormat(variants, nextFormats, cultivar, isPurchasable, isInStock),
    );
    setPinnedImage(null);
    if (opts.persist !== false) writeFulfillmentPref(next);
  }
```

In `chooseCultivar`, change `const nextFormats = formatOptions(variants, next);` to `const nextFormats = formatsFor(method, next);`.

In `chooseFormat`, delete the `writeFulfillmentPref(...)` line (the method owns the pref now). Remove the now-unused `formatForPref` import, and `formatPickupOnly`/`formatPurchasable` if nothing else references them (`git grep -n formatPickupOnly` in the file first).

- [ ] **Step 4: Render the selector and relabel cards**

Immediately before `{formats.length > 0 && (` add:

```tsx
          <div className="mb-5">
            <span className="block text-sm font-semibold text-foreground mb-2">How do you want it?</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Fulfillment">
              {(
                [
                  ["pickup", "Farm pickup", "Free · Tue to Sat"],
                  ["ship", "Shipped", "To 31 states and Washington, D.C."],
                ] as const
              ).map(([m, label, sub]) => {
                const empty = formatsFor(m, cultivar).length === 0;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => chooseMethod(m)}
                    aria-pressed={method === m}
                    disabled={empty}
                    className={`flex-1 rounded border px-4 py-2 text-left text-sm transition ${
                      method === m ? "border-primary bg-primary/5" : "border-primary/15 hover:border-primary/40"
                    } ${empty ? "opacity-60" : ""}`}
                  >
                    <span className="block font-medium text-foreground">{label}</span>
                    <span className="block text-xs text-ink-soft">{empty ? "Not available right now" : sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
```

Inside the Format card map, after the `tierFulfillment({...})` destructure, replace the rendered `{fLabel}` with `{methodFormatLabel(method, fTier, fLabel)}`. Also: under `method === "pickup"` the card must not quote a ship rate, so change the subline's last array element from `fPickupOnly ? null : shipText` to `fPickupOnly || method === "pickup" ? null : shipText`.

`estimatorTiers` already iterates `formats`, so it inherits the filter; render the estimator panel only when `method === "ship"` (wrap its JSX in `{method === "ship" && (...)}`).

- [ ] **Step 5: Lock a pickup potted line in the cart**

After `const selectedPickupOnly = isPickupOnly(selectedTier, shippingFeed, pickupOnly);` add:

```ts
  // A potted tree chosen for Farm pickup must never ship as potted: flag the
  // cart line pickupOnly so the GOL-2588 checkout lock forces pickup.
  const cartPickupOnly = selectedPickupOnly || (method === "pickup" && selectedTier === "potted");
```

Pass `pickupOnly={cartPickupOnly}` to both `<AddToCartButton>` and `<StickyAddToCartBar>` (replacing `pickupOnly={selectedPickupOnly}`). Leave `buyStateFor(... pickupOnly: selectedPickupOnly)` unchanged.

- [ ] **Step 6: Run unit tests, type-check, lint**

Run: `pnpm vitest run apps/nursery` then `pnpm turbo run type-check lint --filter=nursery`
Expected: all PASS. If an existing `fulfillment-pref` or `product-view.copy` assertion pinned the old format-pref effect, update it to the method behaviour and note it in the commit body.

- [ ] **Step 7: Commit**

```bash
git add "apps/nursery/app/shop/[id]/product-view.tsx" "apps/nursery/app/shop/[id]/product-view.copy.test.ts"
git commit -m "fix(nursery): Farm pickup / Shipped gate before Format; never ship Potted (hotfix)"
```

---

### Task 3: Verify in the browser and open the PR

- [ ] **Step 1: Run the nursery app against prod read APIs** via `preview_start` (add a `.claude/launch.json` entry for `pnpm --filter nursery dev` if missing). Visit `/shop/4` (Persimmon), `/shop/8` (Chestnut Hybrid, mismatched pools), `/shop/130` (White Oak, potted-only), `/shop/22` (bundle, bareroot-only).
- [ ] **Step 2: Check each listing:**
  - Shipped shows no "Potted" card; Persimmon shows "Peat & bagged" today (Oct 7).
  - Farm pickup shows "Potted", no ship-rate text, no estimator panel.
  - White Oak Shipped shows "Peat & bagged".
  - Adding Potted under Farm pickup, then opening checkout, shows only the pickup radio with the nursery pickup-only note.
  - Screenshot each for the PR.
- [ ] **Step 3: Run `pnpm test` at root**; all green.
- [ ] **Step 4: Push and open the PR** against `main` (title `fix(nursery): pickup/shipped gate, never ship Potted (hotfix)`). Body: summary, screenshots, "no charge/backend change; Train 3 follow-up plan `2026-10-07-pickup-shipped-preorder-waves.md`". Josh merges (protected `packages/checkout/**` is not touched, but confirm the required checks).

## Known limits (fixed in the Train 3 follow-up)

- Pickup outside the potted season shows the bareroot variant with today's GOL-2233 charge (in-stock before the cutover is charged in full), not yet the always-$10 pre-order.
- No Fall / Spring wave choice yet; bareroot still follows the auto-resolved calendar mode.
- The backend still accepts a potted variant on a ship order if called directly; the cart flag only guards the storefront path.
- Potted-only products (#93, #130) have no bareroot variant, so Shipped is unavailable for them after Oct 15.
