# grove-ui migration worklist (Phase 0 audit — 2026-06-26)

Source: audit of `packages/` + `apps/*` `.tsx` (excl. pages/layouts/route files). Buckets drive the lift order **A → B → C**. "server" = no `'use client'` directive (most are presentational and liftable by adding the directive; only genuine data-fetchers are true bucket C).

## Consolidation wins (lift once, theme per brand)

These exist **duplicated across multiple apps** → become ONE `@grove/ui` component, themed by `--grove-*`:
- `sibling-strip.tsx` — **all 4 apps** → `SiblingStrip`
- `nav-link.tsx` — ggg, nursery → `NavLink`
- `cart-nav-link.tsx` — goldberry, ggg, nursery → `CartNavLink` (or use checkout's)
- `add-to-cart-button.tsx` (per-app server wrapper) — goldberry, ggg, nursery → thin app wrapper over `@grove/ui` `AddToCartButton`

## Bucket A — portable now (no `next/*`)

- [ ] `packages/ui/src/button.tsx` → `Button` (Phase 3)
- [ ] `packages/checkout/.../AddToCartButton.tsx` → `AddToCartButton` (Phase 3)
- [ ] `packages/checkout/.../StickyAddToCartBar.tsx` → `StickyAddToCartBar` (Phase 3)
- [ ] `apps/ggg/app/hero-slideshow.tsx` → `HeroSlideshow` (client, no next — portable; theme it)
- [ ] `apps/hub/components/BuyAtVendorForm.tsx` → `BuyAtVendorForm` (server, no next — add `'use client'` or keep RSC-safe; form posts to a prop'd endpoint)
- [ ] `apps/hub/components/JournalProductEmbed.tsx` → `JournalProductEmbed` (server, no next)
- [ ] `cart-nav-link.tsx` ×3 (server, no next) — consolidate

## Bucket B — needs Next injection (`useGroveLink` / `useGroveImage`)

- [ ] `sibling-strip.tsx` ×4 (`next/link`) → `SiblingStrip` — inject Link
- [ ] `nav-link.tsx` ×2 (`next/link` + `next/navigation` `usePathname`) → `NavLink` — inject Link + an `isActive`/`pathname` prop (don't import `usePathname`)
- [ ] `apps/goldberry/app/shop/shop-sub-header.tsx` (`next/link`+nav) → `ShopSubHeader`
- [ ] `apps/nursery/app/category-bar.tsx` (`next/link`) → `CategoryBar`
- [ ] `packages/checkout/.../CartNavLink.tsx` (`next/link`) → inject Link
- [ ] `packages/checkout/.../MiniCartDrawer.tsx` (`next/link`) → inject Link

## Bucket C — server/data split (server + `next/*` and/or data)

- [ ] `apps/hub/components/ProductCard.tsx` (server + `next/link`) → presentational `ProductCard` (props) + Link injection
- [ ] `apps/hub/components/VendorCard.tsx` (server + `next/link`) → presentational `VendorCard` (accent via prop) + Link injection
- [ ] `packages/checkout/.../CartPage.tsx` (`next/image`+`next/link`) → inject Link + Image; data via props
- [ ] `packages/checkout/.../CheckoutPage.tsx` (`next/link`+nav) → inject Link; navigation via callback prop (not `useRouter`)
- [ ] `packages/checkout/.../createOrderSuccessPage.tsx` (server + `next/link`+nav) → presentational + injection
- [ ] `apps/*/app/shop/[id]/add-to-cart-button.tsx` ×3 (server wrappers) → keep as thin app wrappers over `@grove/ui AddToCartButton`

## Notes

- `packages/checkout/src/cart-store.tsx` is a **store (zustand-style), not a visual component** — stays in `@grove/checkout` (or moves to a `@grove/ui` `/state` subpath), not a design-sync card.
- The per-app `add-to-cart-button.tsx` are thin tenant wrappers — they stay in the apps; only the shared `AddToCartButton` lifts.
- True bucket-C data fetching lives in the excluded `page.tsx` files — the lifted components take data as props; apps keep the BFF fetch.
