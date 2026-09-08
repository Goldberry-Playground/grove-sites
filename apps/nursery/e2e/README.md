# Nursery checkout E2E acceptance suite (GOL-1074)

Playwright acceptance suite for the itemized review-and-pay checkout
(parent GOL-1057). Runs against a **deployed** nursery instance — normally the
per-PR preview droplet — not a Playwright-bundled dev server.

## Ownership

- **Runner / preview / CI infra** — DevOps (Terra). `playwright.config.ts`,
  `smoke.spec.ts`, the `e2e-nursery.yml` workflow, and the preview-URL plumbing.
- **The 6 acceptance specs** — Ada. Author them in this directory as
  `*.spec.ts`; the config already discovers `e2e/**/*.spec.ts`.

## Run contract

```bash
# Against a preview droplet (or any deployed nursery):
E2E_NURSERY_BASE_URL=https://<nursery-preview-url> pnpm --filter @grove/nursery test:e2e

# Against a local `next dev` on :3003 (spins the server up for you):
E2E_LOCAL=1 pnpm --filter @grove/nursery test:e2e
```

First run needs browsers: `pnpm --filter @grove/nursery exec playwright install --with-deps chromium`.

In CI use `.github/workflows/e2e-nursery.yml` (manual `workflow_dispatch` with a
`base_url` input today; see "Automation" below for the post-unblock hook).

## Blockers (must be green before the suite can pass end-to-end)

1. **Preview + QA Odoo backend up** — the target `E2E_NURSERY_BASE_URL` must
   resolve to a running nursery + its BFF/Odoo. In CI that's a `qa`-labelled PR
   preview droplet (`preview-up.yml`). Owner: Terra.
2. **Stripe TEST keys on the QA droplet** — the Stripe-session specs (#1, #2, #5)
   drive `/api/checkout/session`, which **503s without test keys**. Tracked by
   **GOL-899** (currently blocked). Until it lands, those specs are expected-red
   and should be run with `--grep-invert @stripe` for a partial signal.

## The 6 specs (scope — Ada authors)

Tag Stripe-dependent specs with `@stripe` so they can be excluded while GOL-899
is blocked.

1. **Happy path** `@stripe` — all-in-stock cart → review shows itemized
   goods + shipping + tax → Stripe test card `4242 4242 4242 4242` succeeds →
   `/checkout/success` → cart empty.
2. **Mixed cart** `@stripe` — in-stock + reserve items → review shows goods +
   per-unit **Deposit** lines with **Ships now** / **Reserve** badges; the
   due-today vs due-later split reconciles against the session `line_items`
   (each tagged by `kind`, summing to `amount_due_today`).
3. **Unsupported ship-to state** — a non-green-list state is blocked with the
   31-state message (server 400 surfaced in the UI).
4. **Unparseable / missing state** — with the state `<select>` this is now
   un-submittable; assert the guard (submit disabled / no session call).
5. **Declined card** `@stripe` — Stripe decline card `4000 0000 0000 0002` →
   error surfaced, order **not** marked paid, cart **retained**.
6. **Cart-cleared-after-success** `@stripe` — validates GOL-1039 item 1 in a
   real browser across **both** success routes: `/checkout/success` and
   `/checkout/success/[id]`.

Selector source of truth is `packages/checkout/src/components/CheckoutPage.tsx`
and `CartPage.tsx`. Prefer role/text selectors; add `data-testid`s in the
component (coordinate with Alice) rather than brittle CSS where a stable hook is
missing.

## QA release gate (2026-09-07) — `qa-*.spec.ts` + the new-feature specs

Run against the **deployed QA nursery** before a build is promoted to prod:

```bash
# Everything, including Stripe TEST-mode payments (QA has test keys — GOL-899 is unblocked):
E2E_NURSERY_BASE_URL=https://nursery.qa.gatheringatthegrove.com pnpm --filter @grove/nursery test:e2e

# Read-only-ish pass (no Stripe sessions; still submits the checkout form):
E2E_NURSERY_BASE_URL=https://nursery.qa.gatheringatthegrove.com pnpm --filter @grove/nursery test:e2e:no-stripe
```

Or dispatch `.github/workflows/e2e-nursery.yml` — `base_url` now defaults to the
QA nursery and `skip_stripe` defaults to **false**.

| Spec | Gate | What it proves |
| --- | --- | --- |
| `qa-photos.spec.ts` | accurate photos | every catalog card + a PDP sample renders a *real* product photo (`img.product-photo`, decoded, ≥ 20 KB, from that product's Odoo image record) — never the "Photo coming soon" fallback and never Odoo's silent HTTP-200 gray placeholder |
| `qa-perf.spec.ts` | no major slowdowns | live-path smoke budget per route (TTFB / DCL / LCP / HTML weight) + hero images served through the Next optimizer; the *lab* budget stays in `lighthouse-ci.yml` / `perf-budget.yml` |
| `qa-backend-health.spec.ts` | backend has no major errors | zero 5xx / page errors / console errors across the shopper journey; `grove_headless` health + product feed; checkout answers the JSON contract, never an edge error page (the 2026-09-06 incident signature) |
| `checkout-promo-code.spec.ts` | #700 / GOL-2088 | promo input offered + upper-cased; ineligible code (deposit cart) rejected server-side and surfaced; eligible code itemizes a `discount` line that reconciles (`@stripe @promo`) |
| `shop-buy-state-arbitration.spec.ts` | #719 / GOL-2178 | grid stock line ↔ PDP buy box agree; one-CTA-per-page: restock capture on unavailable products suppresses the footer newsletter, and only there |
| `checkout-ship-to-states.spec.ts` | #705 / GOL-2128 | checkout State select offers **exactly** the 31-state green list; PDP estimator prices a green state and captures a non-green one |

**Known-issue tag.** A spec that documents a confirmed product bug awaiting a
fix carries `{ tag: "@known-issue" }` and a comment naming the bug. The CI gate
runs `test:e2e:gate` / `test:e2e:gate:no-stripe`, which exclude that tag, so a
known red can never mask a new one; run plain `test:e2e` to see them. Removing
the tag is how the fix is proven. Current: the sold-out arbitration spec
(GOL-2171 cap — the `/shop` grid says "Sold out" on cap-reached products the PDP
still sells; first caught on QA 2026-09-08).

Shared helpers for these live in `qa-helpers.ts` (`readShopGrid`, `probeImage`,
`collectFailures`, `navTiming`, `lcpMs`, `fillPromoCode`); keep checkout/Stripe
helpers in `helpers.ts`.

**Guardrail (docs/QA-AGENT-GUARDRAILS.md §1):** QA Odoo is system-of-record. Every
checkout-submitting spec creates a draft `sale.order` on QA (and `@stripe` specs a
Stripe TEST session). Tear them down afterwards with odoocker's
`make qa-test-data-cleanup` (dry-run) → `make qa-test-data-cleanup-apply`; the
fixtures are `AAA QA E2E …` (seeded by grove-odoo-modules
`scripts/seed_e2e_test_inventory.py`) and are excluded from photo assertions.

**Selector note:** GOL-2178 (#719) changed the shop card from a single `a.var-card`
to `div.var-card > a.var-card__link`; `collectProductHrefs` was updated to match.
Any build before #719 (e.g. prod on `e3ae053`) fails specs 3/4 at that helper —
that is the expected signal, not a checkout regression.

## Automation (follow-up, gated on GOL-899)

Today the CI job is manual (`workflow_dispatch`) so it never blocks unrelated
PRs while Stripe is unavailable — the suite is intentionally **not** a required
check. Once GOL-899 lands, wire `e2e-nursery.yml` to `workflow_run` after a
successful `preview-up` and read the `nursery` URL from the uploaded
`preview-urls` artifact (already emitted by `preview-up.yml`).
