# ISR revalidation under multiple App Platform instances

**Status:** verified 2026-10-19 (GOL-3446) · applies to every storefront app in this monorepo

## Why this exists

The storefronts are fed by **on-demand ISR revalidation**: Odoo POSTs a signed
`publish` webhook (`guide.publish` / `product.availability`) to each app's
`/api/webhooks/publish`, which calls `revalidatePath('/shop')` +
`revalidatePath('/shop/<id>')` (see `packages/checkout/src/api/createPublishWebhookRoute.ts`).

DigitalOcean App Platform load-balances across instances with **no shared ISR
cache and no sticky routing**. So once an app runs on >1 instance, a single
webhook POST reaches **only one instance**. The others keep serving their cached
pages until their own time-based `revalidate` window fires.

`odoocker-goldberrygrove#914` scaled `grove-nursery-prod` 1 → 2 to survive
single-container replacements. This doc records the audit that confirmed that is
safe, and the rule to apply before scaling the others.

## The rule

**Every storefront read must be either per-request-fresh (`force-dynamic` with
an uncached fetch) or carry a bounded time-based `revalidate`. Never rely on the
publish webhook alone — it is a fast-path optimization, not a correctness
guarantee, and it is a no-op on every instance it does not happen to hit.**

Concretely: no `fetch(..., { next: { revalidate: false } })` and no
`export const revalidate = false` on a page that renders volatile
availability/pricing. (A repo-wide grep for `revalidate: false` must stay empty.)

## Current state — staleness ceiling on the instance that MISSED the webhook

| Surface | Mechanism | Worst-case stale |
|---|---|---|
| nursery `/shop/[id]` PDP — availability, price, variants | `force-dynamic`, `odoo.products.get` sets no `next.revalidate` → opted out of the Data Cache | **0s (fresh per request)** |
| nursery `/shop` listing — availability, price, nav | `odoo.products.list()` / `catalog.nav()` → `next.revalidate: 30` | **≤30s** |
| nursery PDP shipping rate table | `SHIPPING_RATES_REVALIDATE_SECONDS = 3600` (time-based only; no webhook feeds it) | **≤1h** (same at any instance count) |
| goldberry `/shop` + `/shop/[id]` | `force-dynamic`, uncached | **0s** |
| ggg `/shop` | static coming-soon page, no Odoo call | n/a |
| ggg `/shop/[id]` | `force-dynamic`, uncached | **0s** |
| hub marketplace / journal / home | `export const revalidate` 60–3600s | **≤ that window** |

### Why this is acceptable as-is (no hardening required)

- **The page shoppers buy from is fresh.** Add-to-Cart lives on the PDP
  (`/shop/[id]`), which is `force-dynamic` with an uncached product fetch, so it
  shows true availability/pricing on **every** instance regardless of which one
  the webhook hit. The `/shop` grid can advertise stale "In stock" for ≤30s on
  the non-webhook instance, but clicking through to the PDP shows truth, and
  checkout validates stock server-side against Odoo. Overselling risk is **not**
  materially raised by running 2 instances.
- **The bound is the floor, not the fast path.** `createPublishWebhookRoute`'s
  own docstring calls the webhook "the fast path" and the ISR window "the safety
  net that catches any missed or failed delivery." A webhook reaching only 1 of
  N instances is exactly a per-instance missed delivery — the 30s TTL is the
  floor that holds everywhere. Scaling 1 → N lowers the *fast-path hit rate*
  (fewer instances see the ~5s refresh), it does not raise the staleness
  *ceiling*.

## Before scaling goldberry / ggg / hub past 1 instance

1. Re-run the grep: `rg -n "revalidate:\s*false|export const revalidate\s*=\s*false" apps packages` must return nothing.
2. For each page that renders volatile data, confirm it is in the table above —
   `force-dynamic`+uncached, or a bounded `next.revalidate` / `export const revalidate`.
   A new page added since this audit must be added to the table with its bound.
3. If a surface ever needs **webhook-timely propagation on every instance**
   (bound too loose to tolerate, e.g. a flash sellout that must clear in seconds
   fleet-wide), the fix is a **shared Next.js cache handler backed by KeyDB/Redis**
   so on-demand `revalidateTag`/`revalidatePath` propagates across instances —
   not a per-instance tightening of the TTL (which just hammers the single Odoo
   droplet N× harder). That is the larger, correct option; it was **not** needed
   for the nursery 1 → 2 scale and is deferred until a surface actually requires it.
