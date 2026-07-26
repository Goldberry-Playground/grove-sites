# Publish Pipeline — "Publish Once in Odoo" Design Spec (v2)

**Date:** 2026-07-24 · **Amended:** 2026-07-26 (v2 — Odoo becomes the single source of truth for ALL product content; Ghost removed from the product path) · **Status:** Approved (grill-me session 07-24 + one-source-of-truth ruling 07-26, Josh) · **Relates to:** `2026-07-13-nursery-product-pages-design.md` (its "narrative in Ghost" decision #3/#6 is **superseded** by this v2; everything else stands), `docs/STOREFRONT-SPEC.md` (cart/checkout — untouched). Canonical decision record also in the vault: `Software/Grove Publish Pipeline`.

## v2 amendment summary

v1 kept guide prose in Ghost (one post per species, slug join, `#guide-approved` tag, gated auto-publish, HMAC source allowlist for the QA-Odoo→prod-Ghost cross). Josh's 07-26 ruling: **one source of truth unless there are a lot of negatives** — and there aren't. The eCommerce Media gallery already flows through `grove_headless` (`_serialize_images` reads `product_template_image_ids` — this is the live photo pipeline), so the only gap was prose. v2 moves guide prose into Odoo's **eCommerce Description** field and deletes the entire cross-system synchronization layer: no Ghost leg, no publish coupling, no slug join, no blogs-apply dependency for product content. Ghost keeps its real job: `/blog` journal content, newsletters, memberships.

Honest negatives accepted with mitigations: Odoo's backend editor is weaker than Ghost's (mitigated: agent drafts first, Wes only polishes); no field revision history (agent drafts are regenerable); the prose gate collapses into publish (mitigated: `grove_guide_ready` boolean below); in-prose images become Odoo attachments (fine — durable filestore applied 07-23).

## The flow

```
Author creates product in Odoo (Published OFF = the draft state)
  Price, photos (eCommerce Media), variants, facts — all on the template
  └─ "Draft guide" button → validates website category, hero photo, price, facts
       └─ HMAC webhook → Paperclip routine drafts guide from facts fields
            → writes Odoo eCommerce Description (least-privilege Odoo user)
            → pings Wes
Wes polishes prose in the Odoo product form → checks grove_guide_ready
Reviewer flips Odoo Published
  └─ product live on tenant shop + hub marketplace (live catalog API read)
     product page renders the guide if grove_guide_ready, else "coming soon"
```

One system. One login. One toggle. Nothing to reconcile.

## Locked decisions (07-24 grilling, amended 07-26)

| # | Decision | Choice |
|---|---|---|
| 1 | Source of truth | **v2: Odoo owns ALL product content** — facts, price, photos (eCommerce Media), and guide prose (eCommerce Description, `website_description` — confirm exact field name at build). Ghost is removed from the product path entirely; supersedes 07-13 "narrative does NOT live in Odoo" |
| 2 | Authoring | Agent drafts first from the facts fields into the Odoo description; Wes polishes in the Odoo product form. No Google Doc, no Ghost |
| 3 | Prose gate | **v2: `grove_guide_ready` boolean on the template.** Frontend renders the description only when checked; "coming soon" otherwise. Wes's checkbox = the prose gate. Commerce never blocks on content; unreviewed prose never renders |
| 4 | Draft trigger | Explicit **"Draft guide" button** with pre-flight validation (website category, hero photo, price > 0, facts non-empty). Never auto-fire on template create (bulk imports / taxonomy runs would spam — seed-duplication precedent) |
| 5 | Tenant scope | Nursery-first v1; enabling other tenants = config (button visibility per website), no credential map needed anymore |
| 6 | Hub marketplace | Unchanged from v1: hub lists **all published products from all three tenants automatically** (single Odoo, query across `website_id`s). v1 = link-out to tenant product page; **cross-site cart injection EOY 2026**; unified cart permanently ruled out. Client-side search until ~40+ SKUs |
| 7 | Unpublish/archive | **v2: automatic** — single system means unpublishing the product removes everything with it; prose + `grove_guide_ready` persist on the template, so republish (incl. seasonal toggles) restores instantly. Never delete prose |
| 8 | Idempotency | Button is **create-only**: refuses if the description is non-empty (never overwrites human-touched prose). Regeneration = deliberately clear the field first |
| 9 | Environments | **v2: no cross-environment write path remains.** The button webhook (Odoo → routine) stays HMAC-signed with a per-instance key; key moves to prod Odoo at Phase-6 cutover |
| 10 | Failures | Draft-request webhook: retry + backoff + Discord alert + idempotent event log (`grove.stripe.event` pattern). A failed draft never blocks anything — the button can be pressed again |
| 11 | Placement | **`grove_headless` code** (versioned migration, regression tests — WV-tax hook precedent), NOT UI `base_automation` rules |

## grove_headless changes (grove-odoo-modules)

- Expose the eCommerce Description + `grove_guide_ready` (new boolean) in `PRODUCT_DETAIL_FIELDS` / the detail serializer.
- **"Draft guide" server action + button** (nursery-website products, v1): pre-flight validation → HMAC-signed webhook `{event: draft_guide, product_id, website_id, grove_slug}` to the routine. Test-SKU convention never fires.
- `grove.publish.event` idempotent log for draft requests; retry + backoff; unresolved-event query = health check.
- Migration + tests (validation refusals, guide_ready gating in serializer, create-only refusal).

## Paperclip routine (AgenticOS)

- Webhook-triggered (HMAC-verified — same pattern as QA-smoke → Dev Agent). **No longer gated on the blogs apply — build and fire now.**
- `draft_guide`: fetch facts via catalog API → draft species guide → write the product's eCommerce Description via a dedicated least-privilege Odoo user → ping Wes (Discord). Refuse if description non-empty.
- One credential (Odoo user). No Ghost Admin API, no tenant→Ghost map.

## grove-sites changes

- **Product page guide block**: render the sanitized Odoo description when `grove_guide_ready`, else "coming soon" — replaces the planned Ghost-guide fetch. Sanitize/prose-style the HTML (Odoo editor output).
- **Hub marketplace page** (`apps/hub`): unchanged from v1 — aggregated catalog across `website_id`s, link-out cards, client-side filter.
- EOY 2026 fast-follow (separate spec): cross-site cart injection with CSRF/abuse guards.

## Build order

1. **Everything is now unblocked** — no blogs-apply dependency: grove_headless fields + button + event log · routine · product-page guide block · hub marketplace page.
2. Plan 4 (~19 species guides) executes through this pipeline as soon as the field is exposed + routine is live.
3. **Phase-6 cutover runbook:** move the button-webhook HMAC key QA→prod Odoo; revoke QA key.
4. **EOY 2026:** cart injection.

## Open items

- Wes's ping channel (Discord routine/channel TBD)
- Odoo access-rights group enforcing who may flip Published
- Least-privilege Odoo user for the routine (write scope: product description only)
