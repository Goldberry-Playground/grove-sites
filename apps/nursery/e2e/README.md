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
   21-state message (server 400 surfaced in the UI).
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

## Automation (follow-up, gated on GOL-899)

Today the CI job is manual (`workflow_dispatch`) so it never blocks unrelated
PRs while Stripe is unavailable — the suite is intentionally **not** a required
check. Once GOL-899 lands, wire `e2e-nursery.yml` to `workflow_run` after a
successful `preview-up` and read the `nursery` URL from the uploaded
`preview-urls` artifact (already emitted by `preview-up.yml`).
