# Printify T-shirts: farm storefront Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** goldberrygrove.farm/shop shows only Odoo products (the Printify shirts), lets a shopper pick Color and Size, shows Printify's live shipping on the checkout page with clear 503 / 409 / 400 messages, and tells them the shirt is printed to order.

**Architecture:** All data comes from Odoo (`grove_headless`, plan `gom: docs/superpowers/plans/2026-10-13-printify-merch-odoo.md`). The odoo-client gains the new payload fields; the shared checkout quote hook and BFF route gain an opt-in relay of 409/503 and a shipping amount; `apps/goldberry` drops its mock catalog and gets a small pure variant-axis helper plus a client picker. Nursery behavior is unchanged: every new option defaults off.

**Tech Stack:** Next.js (App Router), React, TypeScript, Vitest 4 + Testing Library (happy-dom), pnpm + turbo.

**Spec:** gom `docs/superpowers/specs/2026-10-13-printify-merch-design.md` (gom#340), section "Storefront".

## Global Constraints

- Nursery and woodworking behavior unchanged; new props/options default to today's behavior.
- Backend contract (from the gom plan): product `fulfillment_route` (`"printify"` | `"in_house"`), `lead_time` (string | null); variant `color`, `size` (string, `""` when absent); `/checkout/quote` request `shipping: {state, zip}`, response `fulfillment_route`, `shipping_amount` (number | null); status 409 `"Shirts check out separately from trees."`, 400 `"Shirts ship to the 50 US states and DC."`, 503 `"Shipping is temporarily unavailable. Try again in a few minutes."`
- Shipping is quoted on the checkout page (it needs the address). The cart page keeps "At checkout".
- Never show a guessed shipping price for a Printify cart. While the quote is unavailable, submit stays blocked.
- No em dashes in customer-facing goldberry copy (GOL-589). No typed arrows or glyphs outside the loaded fonts (GOL-3117, GOL-3123).
- Commands: `pnpm vitest run <path>`, `pnpm lint`, `pnpm type-check`, `pnpm test`.

## Review Focus

1. **Shopper picks a Color/Size combination that is archived in Odoo** (disabled in Printify). Expect: that size is not offered for that color; add to cart never sends an inactive variant. Test in Task 3.
2. **Shopper fills state but not ZIP, or ZIP but not state.** Expect: no quote request, shipping row says "Enter your address", submit stays blocked for a Printify cart. Test in Task 4.
3. **Printify down mid-checkout (503).** Expect: the unavailable message and blocked submit, not the catalog estimate fallback. Test in Task 4.
4. **Odoo down or returns zero products on /shop.** Expect: "The shop is restocking. Check back soon." and no fake products. Test in Task 2.
5. **Product with a single variant (one size, one color).** Expect: pickers hidden, add to cart uses that variant. Test in Task 3.

---

### Task 1: odoo-client fields

**Files:**
- Modify: `packages/odoo-client/src/types.ts` (`ApiProductListItem` after `consult_built?` ~L161; `Product` after `consultBuilt?` ~L905; `ApiVariant` L216-244; `ProductVariant` L977-1010; `CheckoutQuoteInput` L1243-1251; `ApiCheckoutQuoteResponse` L1254-1275; `CheckoutQuote` L1280-1304)
- Modify: `packages/odoo-client/src/normalizers.ts` (`normalizeProductListItem` ~L166, `normalizeProductDetail` ~L239, `normalizeVariant` L279-304, `normalizeCheckoutQuote` L453-471)
- Modify: `packages/odoo-client/src/client.ts:428-447` (`checkout.quote` body)
- Test: `packages/odoo-client/src/normalizers.test.ts`, `packages/odoo-client/src/client.test.ts`

**Interfaces:**
- Produces:
  - `Product.fulfillmentRoute?: "printify" | "in_house"`, `Product.leadTime?: string | null`
  - `ProductVariant.color?: string`, `ProductVariant.size?: string`
  - `CheckoutQuoteInput.state?: string`
  - `CheckoutQuote.fulfillmentRoute?: "printify" | "in_house"`, `CheckoutQuote.shippingAmount?: number | null`

- [ ] **Step 1: Write the failing tests** (append to `normalizers.test.ts`; reuse its existing raw-fixture helpers, e.g. spread an existing list item fixture from `src/__fixtures__/api-responses.ts`)

```ts
describe("printify fields", () => {
  it("maps fulfillment_route and lead_time on list and detail", () => {
    const list = normalizeProductListItem({ ...rawListItem, fulfillment_route: "printify", lead_time: "3 to 7 business days" });
    expect(list.fulfillmentRoute).toBe("printify");
    expect(list.leadTime).toBe("3 to 7 business days");
    const detail = normalizeProductDetail({ ...rawDetail, fulfillment_route: "printify", lead_time: "3 to 7 business days" });
    expect(detail.fulfillmentRoute).toBe("printify");
  });

  it("defaults to in_house and null lead time when absent", () => {
    const list = normalizeProductListItem(rawListItem);
    expect(list.fulfillmentRoute).toBe("in_house");
    expect(list.leadTime).toBeNull();
  });

  it("maps variant color and size", () => {
    const v = normalizeVariant({ ...rawVariant, color: "Natural", size: "M" });
    expect([v.color, v.size]).toEqual(["Natural", "M"]);
    expect(normalizeVariant(rawVariant).color).toBe("");
  });

  it("maps quote shipping_amount and fulfillment_route", () => {
    const q = normalizeCheckoutQuote({ ...rawQuote, fulfillment_route: "printify", shipping_amount: 4.75 });
    expect(q.shippingAmount).toBe(4.75);
    expect(q.fulfillmentRoute).toBe("printify");
    expect(normalizeCheckoutQuote(rawQuote).shippingAmount).toBeNull();
  });
});
```

(`rawListItem`, `rawDetail`, `rawVariant`, `rawQuote`: use the fixture names already in `__fixtures__/api-responses.ts`; if a quote fixture does not exist, add one copied from `ApiCheckoutQuoteResponse`.)

In `client.test.ts`, assert the quote body carries state:

```ts
it("sends shipping state and zip on checkout.quote", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify(rawQuote), { status: 200, headers: { "Content-Type": "application/json" } }),
  );
  await client.checkout.quote({ items: [{ variantId: 1, quantity: 1 }], fulfillment: "ship", zip: "90001", state: "CA" });
  const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
  expect(body.shipping).toEqual({ zip: "90001", state: "CA" });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run packages/odoo-client`
Expected: new tests FAIL.

- [ ] **Step 3: Implement types**

`ApiProductListItem` (after `consult_built?`):

```ts
  /** Printify merch (gom printify spec §4). Absent on older pins = in_house. */
  fulfillment_route?: "printify" | "in_house";
  lead_time?: string | null;
```

`Product` (after `consultBuilt?`):

```ts
  /** "printify" = printed and shipped by Printify; skips plant UI. */
  fulfillmentRoute?: "printify" | "in_house";
  /** Printify production time, e.g. "3 to 7 business days". */
  leadTime?: string | null;
```

`ApiVariant`: `color?: string; size?: string;` — `ProductVariant`: `color?: string; size?: string;`

`CheckoutQuoteInput`: `/** Two-letter ship-to state; with zip, lets Odoo quote Printify shipping. */ state?: string;`

`ApiCheckoutQuoteResponse`: `fulfillment_route?: "printify" | "in_house"; shipping_amount?: number | null;`

`CheckoutQuote`: `fulfillmentRoute?: "printify" | "in_house"; shippingAmount?: number | null;`

- [ ] **Step 4: Implement normalizers and client**

`normalizeProductListItem` and `normalizeProductDetail` (beside `consultBuilt`):

```ts
    fulfillmentRoute: raw.fulfillment_route ?? "in_house",
    leadTime: raw.lead_time ?? null,
```

`normalizeVariant`: `color: raw.color ?? "", size: raw.size ?? "",`

`normalizeCheckoutQuote`: `fulfillmentRoute: raw.fulfillment_route ?? "in_house", shippingAmount: raw.shipping_amount ?? null,`

`client.ts` quote body, replace the `shipping` spread:

```ts
              ...(input.zip || input.state
                ? { shipping: { ...(input.zip ? { zip: input.zip } : {}), ...(input.state ? { state: input.state } : {}) } }
                : {}),
```

- [ ] **Step 5: Run tests, type-check, commit**

Run: `pnpm vitest run packages/odoo-client && pnpm --filter @grove/odoo-client type-check`
Expected: PASS.

```bash
git add packages/odoo-client
git commit -m "feat(odoo-client): Printify fields (fulfillmentRoute, leadTime, variant color/size, quote shippingAmount, shipping.state)"
```

---

### Task 2: Farm shop reads Odoo only

**Files:**
- Delete: `apps/goldberry/data/mock-products.ts`
- Create: `apps/goldberry/lib/is-data-uri.ts`
- Modify: `apps/goldberry/app/shop/page.tsx`, `apps/goldberry/app/shop/[id]/page.tsx:7,27-33`, `apps/goldberry/app/shop/shop-sub-header.tsx`
- Test: `apps/goldberry/app/shop/page.test.tsx`, `apps/goldberry/app/goldberry-copy.test.ts`

**Interfaces:**
- Produces: `isDataUri(url: string | null | undefined): boolean` in `apps/goldberry/lib/is-data-uri.ts`.

- [ ] **Step 1: Write the failing page test** (`apps/goldberry/app/shop/page.test.tsx`, same pattern as `app/blog/page.test.tsx`)

```tsx
// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const list = vi.fn();
vi.mock("../../lib/clients", () => ({ odoo: { products: { list } } }));

async function render() {
  const { default: ShopPage } = await import("./page");
  return renderToStaticMarkup((await ShopPage({ searchParams: Promise.resolve({}) })) as never);
}

const shirt = {
  id: 7, slug: "grove-tee", name: "Grove Tee", sku: "", description: "", seoDescription: "", price: 28,
  currency: "USD", imageUrl: "", categoryId: 1, categoryName: "Shirts", available: true, featured: false,
  variants: [], fulfillmentRoute: "printify", leadTime: "3 to 7 business days",
};

describe("goldberry shop", () => {
  beforeEach(() => list.mockReset());

  it("renders Odoo products and no demo banner", async () => {
    list.mockResolvedValue({ products: [shirt] });
    const html = await render();
    expect(html).toContain("Grove Tee");
    expect(html).not.toContain("Demo catalog");
    expect(html).not.toContain("Chestnut Flour");
  });

  it("shows the restocking state when Odoo is down", async () => {
    list.mockRejectedValue(new Error("down"));
    const html = await render();
    expect(html).toContain("The shop is restocking. Check back soon.");
    expect(html).not.toContain("Chestnut Flour");
  });

  it("shows the restocking state when Odoo returns nothing", async () => {
    list.mockResolvedValue({ products: [] });
    expect(await render()).toContain("The shop is restocking. Check back soon.");
  });

  it("has no category tabs", async () => {
    list.mockResolvedValue({ products: [shirt] });
    expect(await render()).not.toContain("Freeze-Dried");
  });
});
```

Copy guard (`apps/goldberry/app/goldberry-copy.test.ts`, modeled on `apps/nursery/app/shop/shop-copy.test.ts`):

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SOURCES = [
  "shop/page.tsx",
  "shop/shop-sub-header.tsx",
  "shop/[id]/page.tsx",
  "shop/[id]/variant-picker.tsx",
  "checkout/success/page.tsx",
  "checkout/success/[id]/page.tsx",
];

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("goldberry customer copy", () => {
  it.each(SOURCES)("%s has no em dash", (rel) => {
    const src = stripComments(readFileSync(join(__dirname, rel), "utf8"));
    expect(src.split("\n").filter((line) => line.includes("—"))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run apps/goldberry/app/shop/page.test.tsx apps/goldberry/app/goldberry-copy.test.ts`
Expected: FAIL (mock fallback renders; em dashes present; `variant-picker.tsx` missing until Task 3, so temporarily the copy test fails on that file too).

- [ ] **Step 3: Implement**

`apps/goldberry/lib/is-data-uri.ts` (move the body of `isDataUri` from `data/mock-products.ts:95-97` verbatim):

```ts
/** True for an inline `data:` image URL, which next/image cannot optimize. */
export function isDataUri(url: string | null | undefined): boolean {
  return typeof url === "string" && url.startsWith("data:");
}
```

(If the original body differs, keep the original body; only the location changes.)

`app/shop/page.tsx`:
- Remove the `mockProducts`, `SHOP_CATEGORIES` imports and `filterByCategory`; import `isDataUri` from `../../lib/is-data-uri`.
- Drop the `searchParams`/`activeCat` category logic; keep the signature accepting `searchParams` so the route type is unchanged.
- Replace the fetch block with:

```tsx
  let products: Product[] = [];
  try {
    products = (await odoo.products.list({ limit: 40 })).products;
  } catch {
    products = [];
  }
```

- Delete the `usingMockData` banner. Replace the empty-category paragraph with:

```tsx
      {products.length === 0 && <p className="shop-empty">The shop is restocking. Check back soon.</p>}
```

- Render the grid from `products` (not `visible`).

`app/shop/[id]/page.tsx`: replace the `getMockProductById` fallback in the catch with `notFound()` (from `next/navigation`), and import `isDataUri` from `../../../lib/is-data-uri`.

`app/shop/shop-sub-header.tsx`: remove the `SHOP_CATEGORIES` import and pass `categories={[]}` (or drop the prop if `ShopSubHeader` makes it optional; check `packages/grove-ui/src/ShopSubHeader/index.tsx`). Replace the lede with: `"Shirts printed to order and shipped to you."`

Delete `apps/goldberry/data/mock-products.ts`, then run `git grep -n mock-products -- apps/goldberry` and confirm it prints nothing.

- [ ] **Step 4: Run tests, lint, type-check**

Run: `pnpm vitest run apps/goldberry/app/shop/page.test.tsx && pnpm --filter goldberry lint && pnpm --filter goldberry type-check`
Expected: page tests PASS (the copy test passes once Task 3 adds `variant-picker.tsx`; until then mark that one SOURCES entry and re-add it in Task 3 Step 5).

- [ ] **Step 5: Commit**

```bash
git add -A apps/goldberry
git commit -m "feat(goldberry): shop reads Odoo only; remove demo catalog and category tabs; restocking state"
```

---

### Task 3: Color and Size picker on the farm PDP

**Files:**
- Create: `apps/goldberry/lib/variant-axes.ts`
- Create: `apps/goldberry/app/shop/[id]/variant-picker.tsx` (client component)
- Modify: `apps/goldberry/app/shop/[id]/page.tsx:144-218` (replace the read-only options list and both add-to-cart call sites)
- Test: `apps/goldberry/lib/variant-axes.test.ts`, `apps/goldberry/app/shop/[id]/variant-picker.test.tsx`

**Interfaces:**
- Consumes: `ProductVariant.color`, `.size` (Task 1); `AddToCartButton` from `@grove/checkout` (existing props: `variantId`, `templateId`, `name`, `price`, `imageUrl`, `disabled`; read `app/shop/[id]/page.tsx:177-199` for the full prop list and pass the same ones).
- Produces:
  - `colorOptions(variants): string[]`
  - `sizeOptions(variants, color: string | null): string[]` (sizes available for that color, in input order)
  - `matchVariant(variants, sel: {color: string | null; size: string | null}): ProductVariant | null` (strict)
  - `<VariantPicker product={Product} imageUrl={string} />`

- [ ] **Step 1: Write the failing pure tests**

```ts
import { describe, expect, it } from "vitest";
import { colorOptions, matchVariant, sizeOptions } from "./variant-axes";

const v = (id: number, color: string, size: string) => ({ id, name: `${color} / ${size}`, price: 28, color, size, available: true }) as never;
const variants = [v(1, "Natural", "M"), v(2, "Natural", "2XL"), v(3, "Sage", "M")];

describe("variant axes", () => {
  it("lists distinct colors in order", () => {
    expect(colorOptions(variants)).toEqual(["Natural", "Sage"]);
  });
  it("lists sizes available for a color only", () => {
    expect(sizeOptions(variants, "Sage")).toEqual(["M"]);
    expect(sizeOptions(variants, "Natural")).toEqual(["M", "2XL"]);
  });
  it("matches strictly", () => {
    expect(matchVariant(variants, { color: "Natural", size: "2XL" })?.id).toBe(2);
    expect(matchVariant(variants, { color: "Sage", size: "2XL" })).toBeNull();
    expect(matchVariant(variants, { color: null, size: "M" })).toBeNull();
  });
  it("matches a single-axis product", () => {
    const sizesOnly = [v(5, "", "M"), v(6, "", "L")];
    expect(colorOptions(sizesOnly)).toEqual([]);
    expect(matchVariant(sizesOnly, { color: null, size: "L" })?.id).toBe(6);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run apps/goldberry/lib/variant-axes.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement `variant-axes.ts`**

```ts
import type { ProductVariant } from "@grove/odoo-client";

function distinct(values: string[]): string[] {
  return values.filter((value, i) => value !== "" && values.indexOf(value) === i);
}

export function colorOptions(variants: readonly ProductVariant[]): string[] {
  return distinct(variants.map((v) => v.color ?? ""));
}

export function sizeOptions(variants: readonly ProductVariant[], color: string | null): string[] {
  const hasColor = colorOptions(variants).length > 0;
  return distinct(variants.filter((v) => !hasColor || (v.color ?? "") === color).map((v) => v.size ?? ""));
}

/** Strict: the exact variant for the chosen axes, or null (never a silent fallback). */
export function matchVariant(
  variants: readonly ProductVariant[],
  sel: { color: string | null; size: string | null },
): ProductVariant | null {
  const needColor = colorOptions(variants).length > 0;
  const needSize = variants.some((v) => (v.size ?? "") !== "");
  if ((needColor && !sel.color) || (needSize && !sel.size)) return null;
  return (
    variants.find(
      (v) => (!needColor || (v.color ?? "") === sel.color) && (!needSize || (v.size ?? "") === sel.size),
    ) ?? null
  );
}
```

- [ ] **Step 4: Run pure tests to verify pass**

Run: `pnpm vitest run apps/goldberry/lib/variant-axes.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Write the failing picker test** (`variant-picker.test.tsx`)

```tsx
// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const added = vi.fn();
vi.mock("@grove/checkout", () => ({
  AddToCartButton: (props: { variantId: number; disabled?: boolean }) => (
    <button type="button" disabled={props.disabled} onClick={() => added(props.variantId)}>
      Add to cart
    </button>
  ),
}));

import { VariantPicker } from "./variant-picker";

const v = (id: number, color: string, size: string) => ({ id, name: `${color} / ${size}`, price: 28, color, size, available: true });
const product = {
  id: 7, name: "Grove Tee", price: 28, available: true, leadTime: "3 to 7 business days",
  variants: [v(1, "Natural", "M"), v(2, "Natural", "2XL"), v(3, "Sage", "M")],
} as never;

describe("VariantPicker", () => {
  it("adds the exact chosen variant", async () => {
    render(<VariantPicker product={product} imageUrl="" />);
    await userEvent.click(screen.getByRole("button", { name: "Natural" }));
    await userEvent.click(screen.getByRole("button", { name: "2XL" }));
    await userEvent.click(screen.getByRole("button", { name: "Add to cart" }));
    expect(added).toHaveBeenCalledWith(2);
  });

  it("does not offer a size missing for the chosen color", async () => {
    render(<VariantPicker product={product} imageUrl="" />);
    await userEvent.click(screen.getByRole("button", { name: "Sage" }));
    expect(screen.queryByRole("button", { name: "2XL" })).toBeNull();
  });

  it("blocks add to cart until a size is chosen", async () => {
    render(<VariantPicker product={product} imageUrl="" />);
    await userEvent.click(screen.getByRole("button", { name: "Natural" }));
    expect((screen.getByRole("button", { name: "Add to cart" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("hides pickers for a single-variant product", () => {
    const single = { ...(product as object), variants: [v(9, "Natural", "M")] } as never;
    render(<VariantPicker product={single} imageUrl="" />);
    expect(screen.queryByRole("group", { name: "Color" })).toBeNull();
  });

  it("shows the printed-to-order line", () => {
    render(<VariantPicker product={product} imageUrl="" />);
    expect(screen.getByText("Printed to order, ships in 3 to 7 business days.")).toBeTruthy();
  });
});
```

- [ ] **Step 6: Implement `variant-picker.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { Product } from "@grove/odoo-client";
import { AddToCartButton } from "@grove/checkout";
import { colorOptions, matchVariant, sizeOptions } from "../../../lib/variant-axes";

function AxisGroup({ label, options, value, onChange }: {
  label: string; options: string[]; value: string | null; onChange: (v: string) => void;
}) {
  if (options.length === 0) return null;
  const id = `axis-${label.toLowerCase()}`;
  return (
    <div className="shop-axis">
      <p id={id} className="shop-axis__label">{label}</p>
      <div role="group" aria-labelledby={id} className="shop-axis__options">
        {options.map((option) => (
          <button key={option} type="button" aria-pressed={value === option}
            className={value === option ? "shop-axis__option is-active" : "shop-axis__option"}
            onClick={() => onChange(option)}>
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function VariantPicker({ product, imageUrl }: { product: Product; imageUrl: string }) {
  const variants = product.variants ?? [];
  const single = variants.length <= 1;
  const colors = colorOptions(variants);
  const [color, setColor] = useState<string | null>(colors.length === 1 ? colors[0] : null);
  const sizes = sizeOptions(variants, color);
  const [size, setSize] = useState<string | null>(null);
  const chosen = single ? (variants[0] ?? null) : matchVariant(variants, { color, size: sizes.includes(size ?? "") ? size : null });

  return (
    <div className="shop-variant-picker">
      {!single && (
        <>
          <AxisGroup label="Color" options={colors} value={color} onChange={(c) => { setColor(c); setSize(null); }} />
          <AxisGroup label="Size" options={sizes} value={size} onChange={setSize} />
        </>
      )}
      {product.leadTime && <p className="shop-lead-time">Printed to order, ships in {product.leadTime}.</p>}
      <AddToCartButton
        variantId={chosen ? chosen.id : product.id}
        templateId={product.id}
        name={chosen && !single ? `${product.name} (${chosen.name})` : product.name}
        price={chosen?.price ?? product.price}
        imageUrl={imageUrl}
        disabled={!product.available || !chosen}
      />
    </div>
  );
}
```

Match `AddToCartButton`'s real prop names from the current `page.tsx:177-199` call (pass any extra props it uses there, e.g. `slug`). Size-chart: add one line under the pickers, `<p className="shop-size-chart">Unisex sizing. If you're between sizes, size up.</p>`, unless Josh supplies a chart.

In `app/shop/[id]/page.tsx`, replace the "Available Options" list (L144-175) and the `AddToCartButton` block (L177-199) with `<VariantPicker product={product} imageUrl={usePlainImg ? "" : fullImageUrl} />`. For `StickyAddToCartBar` (L205-218): render it only when `product.variants.length <= 1`, since it cannot know the picker's selection.

Add CSS for `.shop-axis*`, `.shop-lead-time` to the goldberry stylesheet using existing tokens (see `apps/goldberry/BRAND-A11Y.md` for focus ring and contrast).

Re-add `"shop/[id]/variant-picker.tsx"` to the copy-guard SOURCES if you removed it in Task 2.

- [ ] **Step 7: Run tests to verify pass**

Run: `pnpm vitest run apps/goldberry && pnpm --filter goldberry lint && pnpm --filter goldberry type-check`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/goldberry
git commit -m "feat(goldberry): Color and Size picker on the PDP with printed-to-order line"
```

---

### Task 4: Live Printify shipping on checkout

**Files:**
- Modify: `packages/checkout/src/api/createCartQuoteRoute.ts` (options L22-43; relay L215-239; pass `state`)
- Modify: `packages/checkout/src/hooks/useCartDepositQuote.ts` (add `state` arg, `shippingAmount`, relay statuses)
- Modify: `packages/checkout/src/components/CheckoutPage.tsx` (state tracking ~L170-186, shipping row, blocking)
- Modify: `packages/grove-ui/src/CheckoutPage/index.tsx` (props ~L242, state field ~L775, summary row L887-890)
- Create: `apps/goldberry/app/api/cart/quote/route.ts`
- Modify: `apps/goldberry/app/cart/page.tsx`, `apps/goldberry/app/checkout/page.tsx` (pass `depositQuoteHref="/api/cart/quote"`)
- Test: `packages/checkout/src/api/createCartQuoteRoute.test.ts`, `packages/checkout/src/hooks/useCartDepositQuote.test.ts` (or the existing hook test file), `packages/checkout/src/components/CheckoutPage.printify.test.tsx`

**Interfaces:**
- Consumes: `CheckoutQuote.shippingAmount`, `.fulfillmentRoute`, `CheckoutQuoteInput.state` (Task 1).
- Produces:
  - `CartQuoteRouteOptions.relayStatuses?: number[]` (default `[400]`)
  - `useCartDepositQuote(href, items, fulfillment?, shipWave?, zip?, state?)`; `CartDepositQuote.shippingAmount?: number | null`, `CartDepositQuote.fulfillmentRoute?: "printify" | "in_house"`
  - ui-kit `CheckoutPageProps.onShippingStateChange?: (state: string) => void`, `CheckoutPageProps.shippingValue?: string`

- [ ] **Step 1: Write the failing route tests** (append to `createCartQuoteRoute.test.ts`, reusing its odoo mock and request builder)

```ts
describe("relayStatuses", () => {
  it("relays a 503 when opted in instead of estimating", async () => {
    odoo.checkout.quote.mockRejectedValue(new OdooApiError("Shipping is temporarily unavailable. Try again in a few minutes.", 503));
    const route = createCartQuoteRoute(odoo, { allowedOrigins, resolve, relayStatuses: [400, 409, 503] });
    const res = await route(request({ items, fulfillment: "ship", zip: "90001", state: "CA" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("Shipping is temporarily unavailable. Try again in a few minutes.");
    expect(resolve).not.toHaveBeenCalled();
  });

  it("relays a 409 when opted in", async () => {
    odoo.checkout.quote.mockRejectedValue(new OdooApiError("Shirts check out separately from trees.", 409));
    const route = createCartQuoteRoute(odoo, { allowedOrigins, resolve, relayStatuses: [400, 409, 503] });
    expect((await route(request({ items, fulfillment: "ship" }))).status).toBe(409);
  });

  it("still falls back on a 503 by default (nursery unchanged)", async () => {
    odoo.checkout.quote.mockRejectedValue(new OdooApiError("down", 503));
    const route = createCartQuoteRoute(odoo, { allowedOrigins, resolve });
    await route(request({ items, fulfillment: "ship" }));
    expect(resolve).toHaveBeenCalled();
  });

  it("passes state through to the backend quote", async () => {
    odoo.checkout.quote.mockResolvedValue({ depositNow: false, shippingAmount: 4.75 });
    const route = createCartQuoteRoute(odoo, { allowedOrigins, resolve });
    await route(request({ items, fulfillment: "ship", zip: "90001", state: "ca" }));
    expect(odoo.checkout.quote.mock.calls[0][0]).toMatchObject({ zip: "90001", state: "CA" });
  });
});
```

Match the existing test file's helper names (`request`, `odoo`, `resolve`, `allowedOrigins`, `items`) and how it constructs `OdooApiError` (constructor argument order).

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run packages/checkout/src/api/createCartQuoteRoute.test.ts`
Expected: new tests FAIL.

- [ ] **Step 3: Implement the route**

Options interface:

```ts
  /** Backend statuses relayed to the browser instead of estimating (default [400]).
   *  The farm passes [400, 409, 503] so a Printify outage or mixed cart is shown,
   *  never papered over with a catalog estimate (gom printify spec §5). */
  relayStatuses?: number[];
```

Destructure `relayStatuses = [400]`. Read `state` from the body next to `zip`:

```ts
    const destinationState =
      typeof state === "string" && fulfillmentChoice !== "pickup" ? state.trim().slice(0, 2).toUpperCase() : undefined;
```

and add `...(destinationState ? { state: destinationState } : {})` to both `odoo.checkout.quote` calls. Change the relay condition from `e.status === 400` to `relayStatuses.includes(e.status)`, keeping the fall/spring probe under `e.status === 400` only:

```ts
        if (e instanceof OdooApiError && relayStatuses.includes(e.status)) {
          const forwarded = forwardCheckoutError(e);
          if (forwarded) {
            if (e.status === 400 && waveChoice === "fall") {
              // existing spring probe, unchanged
            }
            return forwarded;
          }
        }
```

- [ ] **Step 4: Run route tests to verify pass**

Run: `pnpm vitest run packages/checkout/src/api`
Expected: PASS, existing route tests unchanged.

- [ ] **Step 5: Write the failing hook test**

```ts
// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCartDepositQuote } from "./useCartDepositQuote";

const items = [{ variantId: 1, templateId: 7, name: "Grove Tee", price: 28, imageUrl: "", quantity: 1 }];
const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

afterEach(() => vi.restoreAllMocks());

describe("useCartDepositQuote printify", () => {
  it("sends state and exposes shippingAmount", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply(200, { depositNow: false, depositReason: null, amountDueToday: null, shippingAmount: 4.75, fulfillmentRoute: "printify" }),
    );
    const { result } = renderHook(() => useCartDepositQuote("/api/cart/quote", items as never, "ship", null, "90001", "CA"));
    await waitFor(() => expect(result.current.quote?.shippingAmount).toBe(4.75));
    expect(JSON.parse(String(spy.mock.calls[0][1]?.body))).toMatchObject({ zip: "90001", state: "CA" });
  });

  it.each([409, 503])("surfaces a %i message as error", async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(status, { error: "Shipping is temporarily unavailable. Try again in a few minutes." }));
    const { result } = renderHook(() => useCartDepositQuote("/api/cart/quote", items as never, "ship", null, "90001", "CA"));
    await waitFor(() => expect(result.current.error).toBe("Shipping is temporarily unavailable. Try again in a few minutes."));
  });

  it("does not send a partial state", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(200, { depositNow: false, depositReason: null, amountDueToday: null }));
    renderHook(() => useCartDepositQuote("/api/cart/quote", items as never, "ship", null, "90001", "C"));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(JSON.parse(String(spy.mock.calls[0][1]?.body)).state).toBeUndefined();
  });
});
```

- [ ] **Step 6: Implement the hook**

- `CartDepositQuote` gains `shippingAmount?: number | null; fulfillmentRoute?: "printify" | "in_house";`
- New sixth param `state?: string | null`. Derive `const destinationState = fulfillment === "pickup" ? null : (/^[A-Za-z]{2}$/.test((state ?? "").trim()) ? (state ?? "").trim().toUpperCase() : null);`, add `state: destinationState` to `key`, and `...(destinationState ? { state: destinationState } : {})` to the POST body.
- Error branch: treat 409 and 503 like 400 when the body carries an `error` string:

```ts
          if (res.status === 400 || res.status === 409 || res.status === 503) {
            // 409/503 only reach the browser when the storefront opted into relaying
            // them (the farm's Printify carts); the nursery route still estimates.
            try {
              const body = (await res.json()) as { error?: unknown; alternateWave?: unknown };
              const message = typeof body.error === "string" && body.error ? body.error : null;
              if (res.status !== 400 && !message) {
                setError(null);
                setAlternateWave(null);
                setFailed(true);
                return;
              }
              setError(message ?? QUOTE_REFUSED_FALLBACK);
              // existing alternateWave logic, only when res.status === 400
            } catch { ... existing ... }
          }
```

Run: `pnpm vitest run packages/checkout/src/hooks` → PASS, existing hook tests unchanged.

- [ ] **Step 7: Checkout shipping row, failing DOM test first** (`CheckoutPage.printify.test.tsx`, modeled on `CartPage.deposit.test.tsx`)

```tsx
// @vitest-environment happy-dom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CartProvider } from "../CartProvider";
import { CheckoutPage } from "./CheckoutPage";

const reply = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

beforeEach(() => {
  window.localStorage.setItem("grove-cart-v1", JSON.stringify([{ variantId: 1, templateId: 7, name: "Grove Tee", price: 28, imageUrl: "", quantity: 1 }]));
});
afterEach(() => { vi.restoreAllMocks(); window.localStorage.clear(); });

async function fillAddress() {
  await userEvent.type(screen.getByLabelText(/state/i), "CA");
  await userEvent.type(screen.getByLabelText(/zip/i), "90001");
}

describe("CheckoutPage printify shipping", () => {
  it("shows the live Printify amount", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply(200, { depositNow: false, depositReason: null, amountDueToday: null, shippingAmount: 4.75, fulfillmentRoute: "printify" }),
    );
    render(<CartProvider><CheckoutPage brand="goldberry" depositQuoteHref="/api/cart/quote" /></CartProvider>);
    await fillAddress();
    expect(await screen.findByText("$4.75")).toBeTruthy();
  });

  it("asks for the address before quoting", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      reply(200, { depositNow: false, depositReason: null, amountDueToday: null, shippingAmount: null, fulfillmentRoute: "printify" }),
    );
    render(<CartProvider><CheckoutPage brand="goldberry" depositQuoteHref="/api/cart/quote" /></CartProvider>);
    expect(await screen.findByText("Enter your address")).toBeTruthy();
  });

  it("blocks submit with the 503 message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(reply(503, { error: "Shipping is temporarily unavailable. Try again in a few minutes." }));
    render(<CartProvider><CheckoutPage brand="goldberry" depositQuoteHref="/api/cart/quote" /></CartProvider>);
    await fillAddress();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Shipping is temporarily unavailable. Try again in a few minutes.");
  });
});
```

Match the real label text of the state and ZIP fields in `packages/grove-ui/src/CheckoutPage/index.tsx` (~L770-800) and the real cart-item shape in `CartPage.deposit.test.tsx:13`.

- [ ] **Step 8: Implement**

ui-kit `CheckoutPage/index.tsx`:
- Props (beside `onShippingZipChange?` L242): `onShippingStateChange?: (state: string) => void;` and `/** Overrides the "On the next step" shipping value (the farm's live Printify quote). */ shippingValue?: string;`
- State field onChange (~L775): after `setShipping({ ...shipping, state: v.toUpperCase() })` add `onShippingStateChange?.(v.toUpperCase());`
- Summary row (L887-890): `<dd>{isPickup ? "Free (pickup)" : (shippingValue ?? "On the next step")}</dd>`

`packages/checkout/src/components/CheckoutPage.tsx`:
- `const [shippingState, setShippingState] = useState("");` beside `shippingZip` (L170).
- Pass `shippingState` as the sixth arg at L186.
- Compute:

```tsx
  const isPrintifyQuote = quote?.fulfillmentRoute === "printify";
  const shippingValue = isPrintifyQuote
    ? quote?.shippingAmount != null
      ? formatPrice(quote.shippingAmount)
      : "Enter your address"
    : undefined;
```

- Pass `onShippingStateChange={setShippingState}` and `shippingValue={shippingValue}` to the ui-kit `CheckoutPage` (next to `onShippingZipChange` at L472).
- Block submit for a Printify cart without an amount: extend `blocked` (L226-227) with `|| (isPrintifyQuote && quote?.shippingAmount == null)`.
- The 409/503 message already reaches `quoteError`, which feeds `blockingMessage` and `blocked`.

Farm wiring:
- `apps/goldberry/app/api/cart/quote/route.ts` (copy the shape of `apps/nursery/app/api/cart/quote/route.ts`, with the farm's origins and a resolve that returns no deposit):

```ts
import { createCartQuoteRoute } from "@grove/checkout/server";
import { odoo } from "../../../../lib/clients";
import { tenantConfig } from "../../../../tenant.config";

export const POST = createCartQuoteRoute(odoo, {
  allowedOrigins: [`https://${tenantConfig.domain}`, "http://localhost:3000"],
  // The farm has no deposit rule; when the backend is unreachable, say "no deposit"
  // and let the relayed status (503) drive the shipping message.
  resolve: async () => null,
  relayStatuses: [400, 409, 503],
});
```

Match how the nursery route builds `allowedOrigins` and the `resolve` signature (`CartQuoteRouteOptions<Quote>`); if `resolve` must return a quote object, return the same "no deposit" shape the nursery uses for a no-rule cart.
- `app/cart/page.tsx`: `<CartPage brand="goldberry" depositQuoteHref="/api/cart/quote" />`
- `app/checkout/page.tsx`: `<CheckoutPage brand="goldberry" depositQuoteHref="/api/cart/quote" />`

- [ ] **Step 9: Run tests to verify pass**

Run: `pnpm vitest run packages/checkout packages/grove-ui apps/goldberry && pnpm lint && pnpm type-check`
Expected: all pass, including every existing nursery CheckoutPage and CartPage test.

- [ ] **Step 10: Commit**

```bash
git add packages/checkout packages/grove-ui apps/goldberry
git commit -m "feat(checkout): live Printify shipping on farm checkout; relay 409/503 for opted-in storefronts"
```

---

### Task 5: Confirmation copy and farm em-dash cleanup

**Files:**
- Modify: `packages/checkout/src/components/createCheckoutSuccessPage.tsx` (options; body L90-101)
- Modify: `apps/goldberry/app/checkout/success/page.tsx`, `apps/goldberry/app/checkout/success/[id]/page.tsx` (metadata titles)
- Modify: `packages/checkout/src/brand-trust.ts` (~L117-133 goldberry checkout trust item)
- Test: `packages/checkout/src/components/createCheckoutSuccessPage.test.tsx` (existing or new), copy guard from Task 2

**Interfaces:**
- Produces: `createCheckoutSuccessPage({ odoo, fulfillmentNote?: string })`

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createCheckoutSuccessPage } from "./createCheckoutSuccessPage";

describe("createCheckoutSuccessPage fulfillmentNote", () => {
  it("renders the note when given", async () => {
    const odoo = { orders: { get: vi.fn().mockRejectedValue(new Error("no")) } } as never;
    const Page = createCheckoutSuccessPage({
      odoo,
      fulfillmentNote: "Your shirt is printed to order and usually ships in 3 to 7 business days. We'll email tracking when it's on the way.",
    });
    const html = renderToStaticMarkup((await Page({ searchParams: Promise.resolve({}) })) as never);
    expect(html).toContain("Your shirt is printed to order");
  });

  it("omits it by default", async () => {
    const odoo = { orders: { get: vi.fn().mockRejectedValue(new Error("no")) } } as never;
    const html = renderToStaticMarkup((await createCheckoutSuccessPage({ odoo })({ searchParams: Promise.resolve({}) })) as never);
    expect(html).not.toContain("printed to order");
  });
});
```

Match the factory's real page props (`searchParams` keys like `session_id` / `order`) and the odoo method it calls, from `createCheckoutSuccessPage.tsx`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run packages/checkout/src/components/createCheckoutSuccessPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add `fulfillmentNote?: string` to the factory options and render, right after the confirmation paragraph (both the with-order L90-95 and without-order L98-101 branches):

```tsx
        {fulfillmentNote && <p className="grove-checkout-success__note">{fulfillmentNote}</p>}
```

`apps/goldberry/app/checkout/success/page.tsx`:

```tsx
export default createCheckoutSuccessPage({
  odoo,
  fulfillmentNote:
    "Your shirt is printed to order and usually ships in 3 to 7 business days. We'll email tracking when it's on the way.",
});
```

Em-dash cleanup (farm only):
- success page titles: `` `Payment Received — ${tenantConfig.name}` `` → `` `Payment received | ${tenantConfig.name}` ``; `[id]` page: `"Order Confirmed — ..."` → `"Order confirmed | ..."`.
- `brand-trust.ts` goldberry checkout item: `"Card entered on Stripe — never stored by us"` → `"Card entered on Stripe, never stored by us"`.
- Goldberry cart trust copy (`"Grown and made on our land"`, `"Packed fresh, sealed for the trip"`) describes farm food, not shirts: change the goldberry `cart` list to `"Printed to order for you"`, `"Ships from our print partner"`, `"No payment until you review your total"`, and the goldberry `checkout` list's `"Packed fresh, sealed for the trip"` to `"Printed to order for you"`. Check `brand-trust.test.ts` (if present) and update expected goldberry strings only.

- [ ] **Step 4: Full verification**

Run: `pnpm lint && pnpm type-check && pnpm test`
Expected: all green, including the goldberry copy guard.

- [ ] **Step 5: Commit and open the PR**

```bash
git add packages/checkout apps/goldberry
git commit -m "feat(goldberry): printed-to-order confirmation note; farm copy without em dashes"
```

PR title: `feat(goldberry): sell Printify T-shirts on the farm shop (Train #3)`. Body links the gom spec (gom#340), this plan and the gom backend PR. Note that it depends on the gom backend for real data: until that ships, the farm shop shows the restocking state (by design, no fake products).

---

## QA gate (Train #3, with the gom QA gate)

On the QA farm site against QA Odoo (`PRINTIFY_DRY_RUN=1`):
1. `/shop` shows only published shirts; no demo catalog; no category tabs.
2. PDP: Color then Size; an unavailable combination is not offered; add to cart adds the exact variant.
3. Checkout: type state and ZIP; shipping shows Printify's amount; total includes Stripe Tax on the Stripe page.
4. Temporarily set a bad `PRINTIFY_API_TOKEN` on QA Odoo: checkout shows "Shipping is temporarily unavailable. Try again in a few minutes." and cannot submit.
5. Pay with a Stripe test card; the confirmation shows the printed-to-order note.
