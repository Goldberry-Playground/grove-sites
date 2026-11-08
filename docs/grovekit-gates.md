# GroveKit gates: token lint + mobile viewport matrix

Two CI gates that enforce the design system in the place it actually lives: the
shipped CSS and the rendered page. They complement the [performance budget](perf-budget.md)
(bytes, Core Web Vitals) with **consistency** (every `@grove/ui` value flows through
a `--grove-*` role) and **responsiveness** (every key route fits a phone).

| Gate | Check name | What it measures | Where | Required? |
|---|---|---|---|---|
| Token lint | `GroveKit token lint` | `packages/grove-ui/src/**/*.css`: no raw colors, no bespoke `var(--x)`, no `var(--grove-*)` the contract never defines | `scripts/grove-token-lint.mjs`, job in `ci.yml` | yes (add to the ruleset) |
| Mobile matrix | `Mobile viewport matrix` | each brand's key routes at 375 / 768 / 1440 px: overflow, tap targets, text size, viewport meta, pinned chrome | `scripts/mobile-matrix.mjs`, `mobile-matrix.yml` | advisory for now |

## 1. GroveKit token lint

[`TOKEN-MAP.md`](../packages/grove-tokens/TOKEN-MAP.md) has one hard rule: *never
leave a raw hex or a bespoke token in a lifted component's CSS; every value comes
through a `--grove-*` role.* The lint makes the three ways to break it red:

| Rule | Fails on | Fix |
|---|---|---|
| `raw-color` | `#hex`, `rgb()`, `rgba()`, `hsl()`, `hsla()` in a declaration value, including inside a `var(--x, #fff)` fallback | a `--grove-color-*` role, or `color-mix(in srgb, var(--grove-color-ink) N%, transparent)` for a tint |
| `foreign-var` | `var(--x)` where `--x` is not `--grove-*` and the component does not declare it itself | map it via TOKEN-MAP; component-local props declared in the same folder (CSS `--x:` or a TSX `"--x"` style key, like `--vendor-card-accent`) are allowed |
| `phantom` | `var(--grove-x)` where `--grove-x` is not in `packages/grove-tokens/src/contract.css` | pick an existing role. A fallback does not excuse it: the fallback is what hides the bug |

Comments are ignored. To keep a genuinely non-themeable value, append
`/* grove-lint: allow — <reason> */` to that line.

**Why the phantom rule matters.** When this landed, `CaptureForm` and
`PrivacyNotice` referenced `--grove-color-foreground`, `--grove-color-background`
and `--grove-color-danger`, none of which exist. Hex fallbacks made them render,
so the newsletter form was white-on-default on every brand and nobody noticed.

```bash
pnpm lint:tokens                                  # or: node scripts/grove-token-lint.mjs
node scripts/grove-token-lint.mjs --json          # machine-readable
node --test scripts/test/grove-token-lint.test.mjs
```

Exit codes: `0` clean, `1` violation(s), `2` the check could not run (contract
or scope missing). A broken check is red, never a silent green.

Scope is deliberately the component layer only. `contract.css` defines the hexes,
the brand themes assign them, app `globals.css` and the generated
`ds-theme.<brand>.css` are not per-component. Same boundary the CSS component
budget draws.

## 2. Mobile viewport matrix

Renders deployed pages in headless Chromium (Playwright, a root devDependency) and
fails on the responsive defects that have cost us orders. The motivating case is
the 2026-10-26 WV checkout dead-end: on a phone the pickup refusal rendered under
a sticky bar and off-screen, so shoppers saw "can't check out" with no reason.
Lighthouse cannot catch that; a 375 px render can.

Thresholds and routes live in **`mobile-matrix.config.json`**. Edit the budget there.

| Check | Viewports | Error | Warn |
|---|---|---|---|
| `viewportMeta` | all | no `<meta name=viewport>` with `width=device-width` | |
| `overflow` | all | `scrollWidth > innerWidth + 1px`; lists the elements crossing the edge | |
| `tapTargets` | mobile | a control's smaller side `< 24px` (WCAG 2.5.8 floor). Inline links in running text are exempt; a checkbox is measured by its label | `< 44px` |
| `textSize` | mobile | less than `60%` of visible text (by characters) is `≥ 12px` (Lighthouse's legibility rule) | any element `< 12px` is listed |
| `fixedChrome` | mobile | `position: fixed/sticky` elements at least half the viewport wide pin `> 35%` of the screen height | |

Every cell also saves a full-page screenshot to `mobile-matrix-artifacts/`
(uploaded as the workflow artifact). Evidence only. There is no pixel diffing.

```bash
# one brand at a deployed URL
node scripts/mobile-matrix.mjs --target goldberry=https://goldberrygrove.farm

# several tenants (the shape the preview-up PR comment produces)
node scripts/mobile-matrix.mjs --targets-json '{"nursery":"https://…","hub":"https://…"}'

# narrow it while iterating
node scripts/mobile-matrix.mjs --target hub=https://gatheringatthegrove.com --routes / --viewports mobile

# first run on a machine: fetch Chromium
pnpm exec playwright install chromium
```

Exit codes: `0` no errors, `1` an error in any cell, `2` the check could not run
(Chromium failed to launch, or every page was unreachable).

The storefronts need Odoo and Ghost behind them, so the matrix targets a
**deployed** page rather than a dev server: the per-PR preview (via
`workflow_run` on `preview-up`, same URL recovery as Lighthouse), QA, or prod
with `workflow_dispatch`. Checkout and cart routes are excluded here; they need
cart state and are covered by `apps/nursery/e2e`.

### Promoting it to required

It ships advisory. Promote once (a) the prod baseline recorded in the introducing
PR is clean or the remaining findings are accepted with threshold changes in
`mobile-matrix.config.json`, and (b) it has run green on a few `qa`-labeled PRs.
Then mirror the Lighthouse gate-shim pattern in `lighthouse-ci.yml` so non-`qa`
PRs are not blocked by a check that cannot run for them.
