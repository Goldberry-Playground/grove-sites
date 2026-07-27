# Performance budget (CI gate)

The Grove performance budget from **GOL-864 §1** (doc:
`frontend-performance-a11y-standards`) is enforced in CI on every PR. It is our
Next.js/React translation of Angular's `budgets` block: when a page gets too
heavy, the build fails, so weight regressions can't land silently. GOL-866.

All thresholds live in one place: **`perf-budget.config.json`** at the repo root.
Edit the budget there — the scripts and Lighthouse config read from it (keep
`lighthouserc.json` in sync with the `lighthouse` block; it can't `require` JSON).

## The three gates

| Gate | Check name | What it measures | Where |
|---|---|---|---|
| Per-route byte budget (§1b) | `Route byte budget` | first-load **JS** ≤ 150 KB (warn) / 400 KB (error) gz, **CSS** ≤ 60 KB gz per route | `scripts/perf-budget.mjs`, run after `pnpm build` |
| Per-component CSS ceiling (§1c) | `Component CSS budget` | bespoke `@grove/ui` component CSS: warn 2 KB / error 6 KB uncompressed | `scripts/css-component-budget.mjs` |
| Core Web Vitals + total weight (§1a/§1b) | `Lighthouse CI` | LCP ≤ 2.0s, CLS ≤ 0.05, TBT ≤ 200ms (INP lab proxy), total ≤ 540 KB | `lighthouserc.json` against a preview URL |

The first two run on every PR from the build output (`perf-budget.yml`). The
Lighthouse gate needs a running page, so it targets a per-PR **preview URL** and
only applies to `qa`-labeled PRs that have a preview (`lighthouse-ci.yml`).

## Run it locally

```bash
# Component CSS ceiling — no build needed
node scripts/css-component-budget.mjs

# Per-route byte budget — build first
pnpm build
node scripts/perf-budget.mjs               # all apps
node scripts/perf-budget.mjs --app nursery # one app
```

Both accept `--json` for a machine-readable report. Exit code `1` = a budget was
exceeded; `2` = the check couldn't run (nothing built / bad config) — a broken
check is red, never a silent green.

## Fixing a violation

- **Route JS over budget** — route-split, `next/dynamic` the heavy client bits,
  or move work into a Server Component. Check what a chunk pulls in with
  `ANALYZE=1` bundle analysis or the `--json` report.
- **Route CSS over 60 KB** — almost always un-purged or one-off CSS. Confirm
  Tailwind content globs cover the route; move bespoke rules to tokens (§3).
- **Component CSS over 6 KB** — extract shared patterns into `@grove/ui` or
  replace one-off values with `--grove-*` tokens. Don't inline a new one-off.

### The CSS ratchet baseline

Four component stylesheets (`CheckoutPage`, `CartPage`, `MiniCartDrawer`,
`CheckoutReview`) were already over 6 KB when this gate landed. Rather than fail
the PR that introduces the gate, they're grandfathered in
`perf-budget.config.json → componentCss.baseline` at their current size: each may
only **shrink**, never grow, and every other/new file gets the strict 6 KB
ceiling. Refactoring them under budget is a tracked GOL-866 follow-up. After an
intentional, budget-respecting change to a baselined file:

```bash
node scripts/css-component-budget.mjs --update-baseline
```

## Ownership (GOL-866)

- **Iris** — the gates: config, both scripts + tests, `lighthouserc.json`, and
  the `perf-budget.yml` / `lighthouse-ci.yml` workflows.
- **Ada** — CI wiring: making these required checks in the grove-sites ruleset
  (GOL-392 currently requires only Lint/Type/Test), and the preview-URL
  auto-trigger for Lighthouse (see the header comment in `lighthouse-ci.yml`).
  Require `Lighthouse CI` only on `qa`-labeled PRs — a PR without a preview has
  nothing for it to audit.
