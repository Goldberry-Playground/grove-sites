# Goldberry Grove — Brand accessibility rules

Living companion to the brand palette in `app/globals.css`. Follow-up from the
Grove Design & Brand Baseline (GOL-103). These rules are enforced, not
advisory — see the guard script below.

## 1. Focus indicators (WCAG 2.4.11 / 1.4.11 — 3:1 non-text)

Focus is drawn with **one tokenized ring**, never a per-component color:

```css
--focus-ring: var(--chestnut-reserve); /* #7F4F1D */
--focus-ring-width: 2px;
--focus-ring-offset: 2px;

:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}
```

Chestnut Reserve clears the 3:1 non-text minimum on every surface a ring lands
on in this app:

| Ring on…                | Ratio   | Pass (≥3:1) |
| ----------------------- | ------- | ----------- |
| Ivory Mist `#FFF7E6`    | 6.48:1  | ✓           |
| Harvest Gold `#EDD682`  | 4.79:1  | ✓           |
| Harvest Gold-deep       | 3.29:1  | ✓           |

**Harvest Gold must never be a focus ring.** As a ring on ivory it is 1.35:1 —
effectively invisible. This was the pre-fix state at `.come-see-us__card`,
`.grows-card`, and the `.nav-dropdown a` focus treatment (GOL-108 / GOL-111).

Focus is signalled by outline **shape**, so it is color-blind-safe across
deuteranopia / protanopia / tritanopia and in grayscale.

## 2. Never-as-text tokens

These brand tokens are light-on-light and **must never carry meaning as text or
icon foreground on a light (ivory/cream) surface.** They fail WCAG 1.4.3:

| Token                             | Hex       | On ivory | Verdict as text on light |
| --------------------------------- | --------- | -------- | ------------------------ |
| `--harvest-gold` (alias `--gold`) | `#EDD682` | 1.35:1   | ✗ never                  |
| `--harvest-gold-deep` (`--gold-deep`) | `#C9B25C` | 1.97:1 | ✗ never                  |
| `--midnight-bark`                 | `#CCA75C` | 2.13:1   | ✗ never                  |

**Allowed uses:** backgrounds, borders, dividers/rules, decorative fills, and
text **on a dark surface** (e.g. gold text inside a Forest Command or Chestnut
Reserve band, where contrast is verified ≥4.5:1). For body text and icons on
light surfaces use `--chestnut-reserve`, `--forest-command`, or `--ink`.

## 3. Enforcement — drift guard

`scripts/check-never-as-text.mjs` snapshots every existing `color:` / `fill:`
use of a never-as-text token into `scripts/never-as-text.allowlist.json`. It is
a **drift guard**: any *new* foreground use that isn't in the baseline fails
`pnpm lint` (it runs before ESLint).

```bash
pnpm --filter @grove/goldberry lint       # runs the guard, then eslint
pnpm --filter @grove/goldberry lint:a11y  # guard only
node scripts/check-never-as-text.mjs --update  # re-snapshot after an intentional add
```

If you add a new gold/tan foreground use, the guard forces a conscious step:
you must confirm it sits on a **dark** surface (verified ≥4.5:1) and re-run
`--update` to record it. The baseline can't distinguish light vs dark
backgrounds, so the existing entries are the render-time audit backlog folded
into **GOL-106** — that ticket confirms each is genuinely on a dark surface.
