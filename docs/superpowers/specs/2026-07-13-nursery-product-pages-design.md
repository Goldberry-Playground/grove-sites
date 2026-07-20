# Nursery Product Pages — Design Spec

**Date:** 2026-07-13 · **Status:** Approved (brainstorming session with Josh) · **Amends:** `docs/STOREFRONT-SPEC.md` product-page + API sections (PR #34; nothing from those sections was built yet, so this supersedes them without migration cost). Cart/checkout/preorder mechanics from STOREFRONT-SPEC are **unchanged** and incorporated by reference.

> **Update 2026-07-20:** the $10-deposit / off-session balance-capture flow referenced below is **deferred to August** — the end-of-July QA deploy ships full-payment hosted Checkout only (S1+S2) on all three storefronts. Species guides (~19, authored from 2026-07-24) live on the prod Ghost at `blog.atthegrovenursery.com` (Ghost leaves the apexes 2026-07-22), read by QA via read-only Content API keys. See the "Decisions 2026-07-20" block in `docs/STOREFRONT-SPEC.md`.

## Purpose

Design the nursery product/shop pages balancing Odoo's data-model limits against the headless API's flexibility, for the goals: customer experience, ease of purchase, promoting food-forest/silvopasture add-ons, reducing shipping costs, and informative growing content (zones etc.).

**Primary buyers (ranked):** (1) food-forest / homestead designers buying guilds of 5–20 plants; (2) conservation / silvopasture bulk buyers. Retail homeowners are served but not optimized for. Function data (layers, zones, guilds, spacing) beats lifestyle storytelling.

## Competitive teardown (2026-07-13)

- **Raintree Nursery** (steal): botanical name under title; zone in prose; sold-out → "Notify me"; Q&A; cross-sell; site-wide seasonal "Bareroot pre-orders live" banner.
- **Tennessee Wholesale** (steal): facet sidebar — Planting Zone / Exposure / **Usage** (≈ our tags); SEO longform below the grid. (Avoid: un-edited AI copy at scale.)
- **Cold Stream Farm** (steal): structured spec block (Latin / Zones / Mature size / Soil / Wildlife); size × quantity-tier price matrix; seasonal availability flags; per-size out-of-stock; honest inventory-estimate disclaimer.

These are three points on our scaling curve: premium low-SKU storytelling (now) → facet catalog (~50 SKUs) → qty-tier wholesale (if bulk orders become real).

## Locked decisions (from the grilling)

| # | Decision | Choice |
|---|---|---|
| 1 | Primary buyers | Food-forest designers + silvopasture/conservation bulk (b+c) |
| 2 | Add-on promotion | Companion strip v1 (tag-inferred) → purchasable guild kits v3 (Odoo kit BOMs — existing backlog task) |
| 3 | Content split | **Facts in Odoo** (filterable via API), **narrative in Ghost** (not MDX — see Ghost contract) |
| 4 | Shipping-cost lever | Radical transparency v1 (potted-vs-bareroot landed-cost delta on page, static "from $X" hints) → consolidation nudges later from real order data |
| 5 | Spec integration | One unified product-page spec (this doc), one batched grove_headless API PR |
| 6 | Narrative CMS | Ghost (nursery tenant, **prod instance shared by QA+prod**), because the editorial persona is non-dev (Wesley) + agent-mediated |
| 7 | Wesley Discord pipeline | Separate track/spec; THIS spec bakes in its contracts (keying, tags, gate tiers) |
| 8 | First guides | Claude drafts ~19 species guides as Ghost drafts for one-click publish |

## Live-catalog facts this design is grounded in (pulled 2026-07-13)

QA Odoo (nursery tenant) holds **22 published products** — species-level templates with **Cultivar × Format (Potted/Bareroot)** variant axes, per-variant SKUs (`PEAR-IK-PT`) and per-variant stock, built by the Square importer. The species-page + cultivar-dropdown model is already the live data shape. ~19 plant species need guides; non-plant items (Pot, Sticker, "Royal") must be excluded from plant browsing via category.

**Discovered modeling bug (this spec fixes it):** Bareroot is a *Format variant* on the same template, but `grove_shipping_tier` (drives 4 lb vs ~25 lb zone rates) is **template-level** — bareroot variants currently ship at potted rates. See Data Model.

**Open pricing questions (Josh to decide; blocks nothing):** existing Pear base $37 vs quoted $35; Service Berry base $12 vs grafted $35; Persimmon base $12 vs IKKJ $40. Resolve via base-price alignment or `price_extra` when the seed rework lands.

## Page anatomy (species detail page, nursery app first)

Breadcrumb (Shop › Trees › Pear) → hero gallery (thumbs; per-variant image swap) → title + *botanical name* + tag badges → **buy box**: Cultivar dropdown (updates price/SKU/stock/image) · Format selector Potted/Bareroot with **landed-cost delta** ("Potted — $35 · ships now · shipping from ~$28" / "Bareroot — $33 · reserve for October · from ~$12") · exact stock ("2 in stock") · qty + add-to-cart · "Free local pickup Tue–Sat 10–7" → **spec block** (Odoo facts: Zones · Mature size · Spacing · Sun · Soil · Layer) → **growing guide** (Ghost) → **guild companions** strip → same-category cross-sell. Bareroot = preorder with $10 deposit per STOREFRONT-SPEC.

Shop/list page: facet sidebar + product grid (card: image, name, "N varieties", "from $X", stock, tags) + SEO longform below grid.

## Data model (grove_headless — one batched PR)

New `product.template` fields: `grove_botanical_name` (char) · `grove_zone_min`/`grove_zone_max` (int, **facet**) · `grove_layer` (selection: canopy/understory/shrub/ground/vine, **facet**) · `grove_sun` (selection: full/partial/shade, **facet**) · `grove_mature_size` (char) · `grove_spacing` (char) · `grove_soil` (char).

**Shipping-tier fix:** effective tier computed on `product.product` — Format attribute value "Bareroot" → `bareroot`, else template `grove_shipping_tier` fallback. Backward compatible; rates endpoint quotes bareroot variants at the bareroot tier.

**Tags:** populate `product_tag_ids` in list + detail serializers (fixes the `tags: []` normalizer TODO in odoo-client too).

## API changes (same PR)

- **List:** add `tags`, `variant_count`, `price_min`; filters `tag_id`, `zone` (`zone_min ≤ z ≤ zone_max`); existing `category_id`/`featured`/`slug` unchanged.
- **Detail:** add facts block, `images[]` ({id,url}, image_1024/256 per STOREFRONT-SPEC), structured `variants[]` — `{sku, cultivar, format, price, qty_available, shipping_tier}` parsed from attribute axes (not display-name strings).
- **New:** ZIP→zone endpoint backed by the existing `zip_usda_zone.csv` (powers the "Will this grow for me?" widget).
- Facet counts compute client-side at current scale; a `/facets` endpoint is the documented scaling path (v3).

## Ghost contract (guides)

- One post per species on the **nursery tenant's prod Ghost** (shared by QA + prod pages — content is environment-agnostic, like the assets CDN).
- **Join key:** Ghost post slug **==** product `grove_slug`, always derived from the Odoo product programmatically (never hand-typed).
- Internal tag `#product-guide` excludes guides from /blog feeds; product pages fetch by slug via Content API (`ghost_content_key_nursery`, 1Password).
- Freshness: Ghost publish/update webhook → grove-sites `/api/revalidate` (existing `GROVE_REVALIDATE_SECRET` plumbing).
- Commerce never blocks on content: Ghost down / no post → "Growing guide coming soon" collapse.

## Wesley pipeline contracts (pipeline itself = separate spec/track)

Discord channel → agent (Paperclip-routine pattern) → stages Odoo writes + Ghost draft → **reply-keyword approval in thread** (v1; buttons v2) against a Discord-user-ID allowlist with **tiered gates**: new products & price changes → Josh; stock & prose → Wesley or Josh. Staged changes expire after 72 h (one reminder, then abandoned with a note). Agent echoes applied state ("✅ Live: …") after every apply. Agent writes Odoo via a dedicated least-privilege `res.users`, never a personal admin login.

## Mechanics & states

- **Facets:** URL-param-driven (`?type=&zone=&layer=&sun=&tag=`), shareable/indexable. Filter events → **Plausible custom events** (`filter_applied {facet, value}`) — satisfies "Odoo should log these" with zero new infra; OpenObserve join available later.
- **Companions:** v1 inference = shared tags ∩ overlapping zone range, cap 4, exclude self. v3: `grove_companion_ids` m2m curation override, shipped together with guild kits.
- **States:** image missing → branded placeholder; variant OOS → visible/disabled + notify or preorder; all OOS → page stays live (SEO) + notify CTA; Ghost unreachable → guide section collapses.

## Phasing

- **v1 — Catalog UX (no payments; supersedes STOREFRONT-SPEC Phase A):** grove_headless API PR · odoo-client normalizer/type updates · reworked seed PR (grove-odoo-modules #22 — add new cultivars as Variety values on *existing* templates, per-variant SKUs `PEAR-MAG-PT`; only Aronia is a new template) · page anatomy · facets + Plausible events · tag-inferred companions · static shipping hints · ZIP-zone widget · ~19 Ghost guide drafts.
- **v2 — Commerce (= STOREFRONT-SPEC Phase B, unchanged):** Stripe hosted checkout, deposits, mixed-cart preorders.
- **v3 — Scale:** guild kits (kit BOMs) + curated companions · consolidation nudges from order data · quantity tiers via native Odoo **pricelists** (zero schema change) · `/facets` endpoint. Wesley pipeline lands on its own track whenever ready.

## Testing

Unit: odoo-client normalizers (tags, structured variants, facts). E2E (Playwright, nursery QA): facet filter → product page → cultivar+format swap → price/stock correctness → add to cart. Contract/drift guard in CI: every published plant product has non-empty facts fields; every product slug either has a `#product-guide` post or renders the coming-soon state.

## Non-goals (v1)

Per-cultivar SEO pages · free-text search · waitlists · qty-tier UI · Ghost on non-nursery tenants' product pages.
