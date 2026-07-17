# design-sync notes

Four Claude Design projects, one per brand — SAME @grove/ui-kit bundle, different theme.

| Brand | projectId | config |
|---|---|---|
| Goldberry Grove | 937e8bd2-8fdb-4e4f-8181-b69e91b067f2 | config.goldberry.json |
| GGG Woodworking | 5fb4ebf9-3865-4679-bd67-9bdbcb09525b | config.ggg.json |
| At the Grove Nursery | 3fde251b-68f7-4b88-b4eb-4ebb6eb2e767 | config.nursery.json |
| Gather at the Grove | 49cf4144-c527-4831-a446-dbfc30a452ef | config.hub.json |

## Per-brand themed CSS
`packages/grove-ui/ds-theme.<brand>.css` = Google-Fonts @import + grove-tokens contract + that brand's theme, concatenated. REGENERATE if grove-tokens change (see the loop in the commit that added these).

## Build per brand (Node 22 — `fnm use 22`)
Use the reusable script (guard + regen theme + tsup + converter + validate in one):
    ./scripts/ds-build.sh <brand>            # goldberry | ggg | nursery | hub
    ./scripts/ds-build.sh <brand> --render   # also playwright/chromium render-check

## ⚠ The pre-push guard (GOL-402) — read before you push

`.design-sync` is one-way outbound and the far side has **no version history**. An
outbound push can overwrite a retheme a brand owner made in the Claude Design app,
and because the push makes repo and published agree again — *by clobber* — no drift
check would ever notice. The work would just be gone.

`ds-build.sh` therefore refuses to build a pushable bundle until it has READ what is
live. It needs a fresh snapshot (< 60 min, `DS_GUARD_MAX_AGE_MIN` to override) at:

    .ds-sync/published/<brand>/_ds_bundle.css   (gitignored)

Fetch it yourself — DesignSync holds the auth and has no CLI; ds-build.sh prints the
exact call. Then `scripts/ds-guard.mjs` diffs the published **token values** against
`.design-sync/baseline.<brand>.json` and aborts with a named diff if they moved.

**The anchor is the baseline, not the repo.** "Abort if published != repo" is
unusable — you only push *because* the repo changed, so it would fire every time and
train everyone to `--force`. The baseline records what was live as of our last push,
so the guard fires only when a *human* changed something.

- `--adopt-baseline` — re-anchor to what is live now. Run it after every push you
  make, or the next build reports your own push as drift. It prints the values the
  next push will overwrite: **read that list.** Adopting is what arms a clobber.
- `--force` — build over a divergence. Only with the brand owner's sign-off; what it
  overwrites is unrecoverable.

Tokens, not bytes: the converter rewrites the CSS on the way out (e.g. an unresolvable
`@font-face` becomes `/* @ds-font-face-dropped */`), so published is never
byte-identical to its source even when nothing drifted.

### Baseline status (2026-07-15)
| Brand | Baseline | State |
|---|---|---|
| goldberry | ✅ adopted | published == our own last push, verified against git |
| hub | ✅ adopted | published == our own last push, byte-identical to the pre-GOL-380 artifact |
| ggg | ❌ **withheld** | published carries a **live in-app retheme** — see below |
| nursery | ❌ **withheld** | published carries a **live in-app retheme** — see below |

**ggg and nursery are deliberately baseline-less, so the guard blocks their pushes.**
Their published `:root` contract-defaults block carries brand palettes (ggg:
walnut/cherry/amber/bone · nursery: forest/leaf) that exist in **no commit** —
`contract.css` has never held them. That is the 2026-07-08 in-app retheme, still live
and never written back. It was **not** clobbered by the 07-09/10 push; it survives.
Pushing either brand today *would* destroy it. Adopting a baseline for them would tell
the guard to allow exactly that — so don't, until the values are ported into
`packages/grove-tokens/src/themes/<brand>.css` (that is GOL-114's parked write-back).
All four brands' published bundles are also ~47 tokens behind: the GOL-109 scales
(`--grove-text-*`, `--grove-space-1..8`) landed in the repo and were never pushed.

## Known-benign render warnings
- **ProductCard / VendorCard → `[RENDER_THIN]` (0px height):** false positive. Both
  pass the per-vendor accent down via a `display:contents` wrapper (since the injected
  Link seam takes no `style`), which generates no box → measured height 0. Screenshots
  confirm both render fully (`ds-bundle/_screenshots/general__{ProductCard,VendorCard}.png`).
  Benign — not a layout bug.

## Status (path A — done)
- 11 components authored + render-verified (chromium): Button + SiblingStrip, NavLink,
  CartNavLink, ProductCard, VendorCard, BuyAtVendorForm, JournalProductEmbed,
  HeroSlideshow, ShopSubHeader, CategoryBar. All previews render cleanly.
- Component CSS is token-mapped (`packages/grove-tokens/TOKEN-MAP.md`) and concatenated
  into `ds-theme.<brand>.css` by `ds-build.sh` (also @imported in `src/styles.css`).

## Remaining / TODO
- Fonts load at runtime via Google-Fonts @import ([FONT_REMOTE]); brand serif "Baskerville
  Classico" is paid → web fallback Libre Baskerville is used.
- ds-theme.<brand>.css duplicates grove-tokens content — regenerate on token change (ds-build.sh does this).
- **App-swaps NOT done** — apps still use their local component copies. Swapping them to
  `@grove/ui-kit` (with GroveLinkProvider + prop-supplied data) is a separate step; the
  per-component call sites are listed in the fleet commit message.
- Checkout components (cart-coupled: AddToCartButton, StickyAddToCartBar, MiniCartDrawer,
  CartPage, CheckoutPage) **LIFTED (GOL-115)** — decoupled from the cart store via a
  props/callbacks contract (`packages/grove-ui/src/cart-contract.ts`: `GroveCartLineItem`,
  `onAddToCart`/`onSetQuantity`/`onRemove`/`onPlaceOrder`, `open`/`loading`). Token-mapped
  to `--grove-*` incl. the status roles (`--grove-color-error-*`) for checkout/validation.
  `@grove/checkout` keeps the store + ships thin connected wrappers (same public API), so
  app call sites are unchanged. Previews: `.design-sync/previews/{AddToCartButton,
  StickyAddToCartBar,MiniCartDrawer,CartPage,CheckoutPage}.tsx`. Stacked on the GOL-109
  token-scale branch (needs the status tokens); merge after GOL-109 lands on main.
