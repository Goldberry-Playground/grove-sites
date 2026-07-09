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
Use the reusable script (regen theme + tsup + converter + validate in one):
    ./scripts/ds-build.sh <brand>            # goldberry | ggg | nursery | hub
    ./scripts/ds-build.sh <brand> --render   # also playwright/chromium render-check

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
