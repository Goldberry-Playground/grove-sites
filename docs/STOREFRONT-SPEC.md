# Storefront Experience Spec — Variants, Gallery, Preorders

> **⚠️ Partially amended 2026-07-13:** the **product-page layout and API-additions sections** of this spec are superseded by
> [`docs/superpowers/specs/2026-07-13-nursery-product-pages-design.md`](./superpowers/specs/2026-07-13-nursery-product-pages-design.md)
> (adds growing-facts/spec block, facets, Ghost guides, companions, shipping transparency; restructures the API changes into one batched PR).
> Everything about **cart, checkout, preorders, deposits, mixed orders, pickup, and Discord alerts** (decisions 1, 3–8b below) remains canonical here.

Status: agreed 2026-07-07 (grill session with Josh) — implementation phased below.
Scope: nursery storefront first (only tenant with a catalog); all components
shared so goldberry/ggg light up when they have products.

## Decisions (settled, with owner rationale)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Bareroot before October | **Visible + preorderable** (not hidden/disabled) |
| 2 | Per-format pricing | **Supported** — `price_extra` on Format attribute values; bareroot typically cheaper; numbers entered in Odoo per product (default $0 delta until set) |
| 3 | Fulfillment | **Both formats ship** (weight/zone rates; variant weights to fill in Odoo) AND **local pickup is always offered for everything**. Pickup at checkout shows business hours -- Tuesday-Saturday, 10am-7pm -- plus "can't make those hours? call us after placing your order" |
| 4 | Payment phasing | **UI first, Stripe next phase.** Until Stripe lands, preorders create orders and the $10 deposit is collected manually (Square/emailed invoice) |
| 5 | Deposit model | **$10 flat per order** containing preorders, **applied toward the total** (not a fee). Balance captured off-session at confirmed shipping (Stripe phase) |
| 6 | Preorder caps | **Per bareroot variant** — the forecasted quantity set in Odoo IS the cap; 0 = preorders closed for that cultivar. Opening preorders = typing a number |
| 7 | Stock display | **Exact counts** ("2 in stock"); sold-out variants stay visible as "Sold out" — a sold-out potted cultivar still cross-sells its bareroot preorder |
| 8b | Order alerts | **Discord notification on every storefront order** (ship-now and preorder), fired server-side at order creation -- webhook URL via droplet env, non-blocking so checkout never fails on Discord |
| 8 | Mixed carts | **One cart, one checkout, one confirmation** for the customer; the order-create API splits server-side into an in-stock order + a Preorder-tagged order (deterministic at creation — never a cleanup script) |

## Customer experience

### Shop list page (per tenant)
- One card per product template: hero image, name, "N varieties",
  "from $X" (min variant price). No variant spam.
- Category nav driven by real Odoo categories (Apple, Mulberry, Plum, Fig, …)
  replacing the mock SHOP_CATEGORIES source.

### Product detail page
- **Gallery**: hero = product main image; slideshow strip = eCommerce Media
  (`product.image` records) in Odoo order. When the selected cultivar variant
  has its own image, it replaces the hero for that selection.
- **Cultivar dropdown** (only when the product has cultivars): full list,
  each entry shows availability state. Selecting updates price, SKU, stock
  line, and images.
- **Format selector**: Potted / Bareroot.
  - Potted + stock>0 → "N in stock — ships now" + Add to Cart
  - Potted + stock 0 → "Sold out" (unselectable for purchase, visible)
  - Bareroot + cap>0 remaining → "Preorder for fall — $10 deposit applies
    to your total" + Preorder button; show expected window (global setting,
    initially "Expected October 2026")
  - Bareroot cap 0/exhausted → "Preorder sold out" / "Preorders open soon"
- Price displays the exact variant price (template + cultivar extra + format
  extra).

### Cart + checkout
- Mixed carts allowed; cart groups lines visually: "Shipping now" /
  "Fall preorder ($10 deposit applies)".
- Order summary shows: pay-today total = in-stock items (+ shipping) + $10
  deposit if any preorder lines; "due at shipping" = preorder balance.
- Confirmation page/email: one confirmation, two sections, both Odoo order
  references.
- **Fulfillment choice** (per order): Ship or Local pickup. Pickup shows
  "Pickup hours: Tuesday-Saturday, 10am-7pm" and "Can't make those hours?
  Call us after placing your order." Pickup skips shipping cost.

## Backend (grove_headless)

### API additions
- `GET /grove/api/v1/products` (list): add `variant_count`, `price_min`,
  hero `image_url` (exists).
- `GET /grove/api/v1/products/<slug>` (detail): add
  - `images[]`: hero first, then eCommerce Media; each `{id, url}` sized
    URLs (`image_1024` detail, `image_256` thumbs)
  - `variants[]`: `{id, sku, cultivar, format, price, qty_available,
    preorder_cap_remaining, image_url|null}`
- `POST /grove/api/v1/orders`: accepts mixed lines; splits into
  in-stock order + preorder order (tag `Preorder`, `origin` cross-links);
  deposit line ($10, "Preorder deposit — applied to balance") on the
  preorder order.

### Odoo data conventions (Josh + Wesley workflow)
- Photos: product form → main image (hero) + Sales tab → eCommerce Media
  (gallery). Optional per-variant image on the variant record.
- New cultivar: product → Attributes & Variants → add value on the Cultivar
  line (generates Potted+Bareroot variants + SKUs need setting or re-run
  importer).
- Open bareroot preorders: set the forecasted quantity on the `-BR` variant.
- Bareroot pricing: Format attribute value `price_extra` per product.
- Saved filters to ship with the module data: Sales "Preorders (Fall)",
  and preorder orders use a no-auto-delivery route so Inventory→Deliveries
  only shows real ship-now work; October release = batch-create deliveries
  from the preorder list (one action; MCP-assistable).

## Phases

1. **Phase A — Catalog UX** (no payment dependency): API additions, list
   page, detail page (gallery, dropdowns, stock states), preorder button
   creating split orders (deposit collected manually until Stripe).
   Prereq: grove-sites PR #33 (image URL resolver) merged.
2. **Phase B — Stripe**: $10 charged at checkout w/ saved payment method
   (off-session enabled); in-stock items paid in full same transaction;
   balance captured on preorder delivery confirmation; refund path =
   refund deposit + cancel order.
3. **Phase C — Fall ops**: preorder release tooling (batch delivery
   creation + balance capture + customer notify) — sized when quantities
   are real.

## Non-goals (now)
- Per-cultivar landing pages/SEO beyond the product page (later).
- Waitlists beyond cap ("notify me") — candidate for Phase C.
- Ghost/blog content integration on product pages.
