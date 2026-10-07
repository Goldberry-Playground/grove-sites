# Nursery Shop Departments, Guilds and Cross-Department Search — Design Spec

**Date:** 2026-09-30 · **Status:** Approved (brainstorming session with Josh, 2026-09-30) · **Target:** Phase 1 in **Release Train #3** (QA up Mon 2026-10-19 → promote Wed 10-21 → teardown Thu 10-22) · **Amends:** `docs/STOREFRONT-SPEC.md` ("Category nav driven by real Odoo categories") and the category/facet sections of `docs/superpowers/specs/2026-07-13-nursery-product-pages-design.md`.

**Prototype (approved):** the clickable "Nursery Shop Departments" artifact from the 2026-09-30 session (desktop + phone). Sample data only; this spec is authoritative where they differ.

## Purpose

The nursery is growing beyond orchard stock into three product families that are sold, filtered and grown differently:

- **Mycoforestry**: host trees inoculated with truffle and porcini fungi (coming soon; Odoo category 7 already exists with 3 unpublished products).
- **Forest farming**: medicinal and edible woodland crops such as goldenseal, ginseng and ramps (coming soon).
- **Seed & scion**: dormant scion wood, seed and rootstock for grafters and propagators (coming soon).

Adding them as more category pills would put 8–9 pills in the bar, force orchard facets (layer, sun) onto products they don't describe, and leave empty grids. This spec introduces **departments** (one quiet tab row, each with its own categories and facets), a cross-cutting **Guilds** collection, **deals as badges**, and **search across everything**, without changing the orchard browsing people use today.

## Decisions (settled with Josh, 2026-09-30)

| # | Decision | Rationale |
|---|---|---|
| 1 | **Departments** (approach A), not more pills (B) or a "beyond the orchard" strip (C) | Keeps the orchard nav unchanged; each family gets filters that fit it; scales when families go live |
| 2 | **Coming-soon departments are visible now**, with a teaser and a notify-me capture | Builds a per-family waitlist and signals where the nursery is going |
| 3 | **Each department is its own page**: `/shop`, `/shop/mycoforestry`, `/shop/forest-farming`, `/shop/seed-and-scion` | Indexable; teaser pages collect search traffic for goldenseal/ginseng/scion before launch |
| 4 | Cross-department curated sets are called **Guilds**, subtitled "Plants that grow better together" | Permaculture-accurate and on-brand; product names keep "bundle" so search still matches |
| 5 | **Deals are badges, not a place** (e.g. "5+ save"), plus an optional "On offer" facet that appears only when something is on offer | Avoids a discount-driven feel and an empty "Deals" page between promos |
| 6 | **Odoo is the source of truth** for the department tree, status and per-department facets; the storefront stops hardcoding categories | Launching a family is a data change (`coming_soon` → `live`), not a code deploy |

## Information architecture

```
Orchard & food forest     /shop                     live
  ├ Fruit trees · Nut trees · Fruit & nut shrubs · Vines · Native
Mycoforestry              /shop/mycoforestry        coming soon
  └ Truffle trees · Porcini trees
Forest farming            /shop/forest-farming      coming soon
  └ Medicinal roots · Woodland edibles
Seed & scion              /shop/seed-and-scion      coming soon
  └ Scion wood · Seed · Rootstock

Guilds (collection)       /shop/guilds              live (products may come from any department)
Deals                     badges + "On offer" facet (no page)
```

- `/shop` stays the Orchard department so existing links, SEO and the current category pills keep working.
- Category pill URLs keep today's shape inside a department (`/shop?cat=fruit-trees`).
- A department tab is shown when its status is `live` **and** it has ≥1 published product, or when its status is `coming_soon`. `hidden` departments never render.
- Guilds is a separate right-aligned link, not a tab, because a guild can hold products from several departments.

## Odoo data model (grove-odoo-modules / grove_headless)

### Category tree (`product.public.category`)

| Today | After |
|---|---|
| 1 Fruit Trees, 2 Native, 3 Nut Trees, 4 Berry & Nut Shrubs, 5 Fruiting Vines (top level) | Children of a new top-level **Orchard & food forest** department |
| 6 Food Forest Packages (5 products) | Becomes the **Guilds** collection root (display name "Guilds"; `grove_node_kind = collection`) |
| 7 Mycoforestry (3 unpublished products) | Top-level **department**, `coming_soon`; children Truffle trees, Porcini trees |
| (none) | New top-level departments **Forest farming** and **Seed & scion**, `coming_soon`, with their child categories |

**Existing category IDs are kept.** The restructure runs as a `grove_headless` **migration script** (shipped and applied by the Train #3 modules promote), never as hand edits on prod, so QA and prod converge identically and the change is rollback-aware.

### New fields on `product.public.category`

| Field | Type | Purpose |
|---|---|---|
| `grove_slug` | Char, unique, required on departments/collections | **Stable URL slug.** Today the API derives slugs with `slugify(name)`, so renaming a category silently changes its URL and breaks storefront filters. The API must prefer `grove_slug`, falling back to `slugify(name)` only when unset. Backfill existing categories with their current slugified names so nothing changes. |
| `grove_node_kind` | Selection `department` / `category` / `collection` | Distinguishes department roots, their categories and the Guilds collection |
| `grove_dept_status` | Selection `live` / `coming_soon` / `hidden` (departments only) | Drives tab visibility and whether the page shows a grid or a teaser |
| `grove_teaser` | Text | Department intro / coming-soon blurb (authored copy, not agent-generated) |
| `grove_facets` | Char (comma list) | Facets this department shows, from an allowlist: `zone, layer, sun, uses, on_offer, host_tree, fungus, shade_level, years_to_harvest, form, species, ships` |
| `grove_coming_list` | Text (one item per line: `Name | detail`) | "What's coming" list on teaser pages until real products exist |
| `sequence` | (existing) | Tab order |

### New product facts (Phase 2, not Train #3)

Added only when the first product of each family is being listed: `grove_shade_level` (forest farming), `grove_years_to_harvest` (forest farming, mycoforestry), `grove_form` = scion / seed / rootstock (seed & scion), `grove_fungus` and `grove_host_tree` (mycoforestry). They join the listing-content gate's facts for their department only (see `grove-odoo-modules/docs/superpowers/specs/2026-09-21-listing-content-gate-design.md`).

### API (`/grove/api/v1`)

- **New `GET /catalog/nav`**: the department tree with `slug`, `name`, `kind`, `status`, `teaser`, `facets`, `coming_list`, children (with product counts), and the Guilds collection. Cached like the product list and revalidated by the existing publish webhook.
- **Products** gain `department` (`{slug, name}`) derived from their category ancestry, and `categories[].slug` uses `grove_slug`.
- **`GET /products`** accepts `dept=<slug>` (server-side) in addition to today's `cat`, `zone`, `layer`, `sun`, `tag`.
- **Search** keeps the existing `q` filter but runs across **all live departments + Guilds**; coming-soon matches come from `coming_list` (no product records needed).
- **Notify-me** reuses `POST /grove/api/v1/newsletter/subscribe` with `interests: ["waitlist:<dept-slug>"]` and `source: "shop-coming-soon"`. The endpoint already turns these into Odoo contact tags (`_get_or_create_partner_categories`); extend `newsletter_tag_names` if the interest allowlist rejects the new value. Result in Odoo: a contact tagged e.g. `Waitlist: Mycoforestry`, filterable for the launch email.

## Storefront (grove-sites, `apps/nursery`)

### Components

- **`DepartmentNav`**: one tab row + the right-aligned **Guilds** link. The tab row scrolls horizontally on narrow screens (no wrapping); coming-soon tabs carry a "Soon" badge. Renders from `/catalog/nav`; replaces the hardcoded `NURSERY_CATEGORIES` in `data/categories.ts` (keep a mock fallback for local dev, like `mock-products`).
- **Department page** (`app/shop/[dept]/page.tsx`, with `/shop` as the Orchard department): live departments render today's category pills + facet sidebar, **limited to that department's `facets`**; coming-soon departments render the **teaser** (blurb, "What's coming" list, notify-me card, and "Filters when live: …" note).
- **`NotifyMe`**: email field + button; validates inline ("Enter an email address like you@example.com"); posts to the subscribe endpoint with the department interest; success copy "You're on the list. We'll email once when these are ready to order."
- **Guilds page** (`app/shop/guilds/page.tsx`): guild cards with name, one-line purpose, plant chips, "From: <departments>" line, price, and a button. Coming-soon guilds show "Notify me".
- **Search**: one search box on every shop page; results grouped by department ("Orchard & food forest", "Mycoforestry · Soon", …) with Guilds as its own group; a coming-soon match links to that department's notify-me.
- **Deal badge**: a small marigold badge on product cards (e.g. "5+ save") driven by the existing loyalty/volume-tier data (GOL-2431/2432); the "On offer" facet renders only when ≥1 product in view is on offer.

### Responsive behavior

| Width | Behavior |
|---|---|
| < 768px (phone) | Tabs scroll sideways in one row; Guilds link stays visible; category pills scroll sideways; the facet sidebar becomes a "Filters" button opening a panel; 2 product cards per row; teaser stacks (what's coming, then notify-me); guild cards one per row |
| ≥ 768px | Facet sidebar + 3–4 product cards per row; teaser in two columns; guild cards two per row |

Tap targets ≥ 44px (GOL-2440 standard); no horizontal page overflow at 390px; design-system tokens only (design-sync gate); stays within the Route byte, Component CSS and Lighthouse budgets.

### Copy

Department names: **Orchard & food forest**, **Mycoforestry**, **Forest farming**, **Seed & scion**. Collection: **Guilds** — "Plants that grow better together." Teaser blurbs and "What's coming" lists are authored in Odoo (`grove_teaser`, `grove_coming_list`); first drafts by Sora (CMO), approved by Josh before promote. House rules apply (e.g. the juglone stance).

## Phasing

**Phase 1 — Release Train #3 (this spec):**
1. Odoo: new category fields, `grove_slug` backfill + API preference, migration restructuring the tree (IDs kept), `/catalog/nav`, `department` on products, `dept=` filter, cross-department search, notify-me interest tag.
2. Storefront: `DepartmentNav`, department pages (live + teaser), `NotifyMe`, Guilds page, grouped search, deal badge + conditional "On offer" facet, responsive behavior above.
3. Content: teaser blurbs + coming lists for the three families; Guild descriptions for the 5 existing packages.

**Phase 2 — when each family's first product is ready (not Train #3):** the family's product facts and department facets; flip `grove_dept_status` to `live`.

**Non-goals (now):** server-side full-text search engine; personalised recommendations; a Deals page; per-department checkout rules (shipping restrictions for live plants vs seed/scion are handled by the existing compliance gate when those products exist).

## Train #3 feasibility and sequencing

- **Critical path is the Odoo side** (Ada; heavy queue). Target: grove-odoo-modules PR merged by **Mon 2026-10-12** so the storefront can integrate against QA-equivalent data for a week.
- **Storefront starts immediately against mock data** (the `mock-products` pattern) behind the same API shape, so it doesn't wait on Odoo.
- **Freeze** for Train #3: Fri 2026-10-16 EOD ET (same freeze rule as Train #2: Friday before the Monday bring-up).
- **Fallback:** if the Odoo PR isn't merged by 10-12, ship only the storefront pieces that don't need new data (Guilds page from category 6 via today's API, grouped search over live products, deal badge) and move departments/teasers to Train #4.

## Testing and acceptance

- **grove_headless:** migration test (tree restructured, IDs unchanged, `grove_slug` backfilled equal to today's slugified names); `/catalog/nav` shape; `dept=` filter; `categories[].slug` stable across a category rename; notify-me writes the waitlist tag; Odoo 19 install/upgrade smoke green.
- **grove-sites unit:** nav rendering from `/catalog/nav` (live, coming_soon, hidden, live-with-zero-products hidden); facet allowlist per department; search grouping; NotifyMe validation.
- **e2e (QA, Train #3):** desktop + mobile lanes: `/shop` unchanged for orchard browsing (category pills + existing facets); each coming-soon page renders teaser + notify-me and a submission lands a tagged contact in QA Odoo; `/shop/guilds` lists the 5 packages; searching "ginseng" returns the Forest farming group with a notify-me link; no horizontal overflow at 390px.
- **Promote gate:** prod nav renders the same tree as QA; existing `/shop?cat=…` URLs still resolve.

## Open questions (non-blocking)

- Final teaser copy and "What's coming" lists per family (Sora drafts; Josh approves).
- Whether Guild cards should link to each included plant's PDP (likely yes, Phase 1 if cheap).
