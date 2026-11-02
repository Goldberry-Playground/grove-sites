# @grove/qa-portal

Internal component-QA gallery. It shows each brand's built design bundle (the
shared `@grove/ui-kit` components rendered with that brand's theme) so
reviewers can check components per brand and per viewport without running a
storefront.

- **Port:** 3005 (`pnpm --filter @grove/qa-portal dev`)
- **Routes:** `/` (brand list), `/[brand]` (component gallery for `goldberry`,
  `ggg`, `nursery` or `hub`)
- **Status:** slice 1, read-only preview. Feedback capture, the `qa_portal`
  store, triage and the DO deploy are later plans. Not deployed.

## How it works

1. `pnpm build:design-bundles` builds `dist-bundles/<brand>/` (local only,
   gitignored, needs Chromium).
2. The `predev`/`prebuild` hook runs `scripts/sync-bundles.mjs`, which copies
   each brand's bundle into `public/bundles/<brand>/`. Locally it fails if
   `dist-bundles/` is missing. In CI it warns and builds an empty gallery.
3. `app/lib/bundle.ts` lists the components of a brand from the directory
   listing of `public/bundles/<brand>/components/general/`. There is no
   manifest.
4. `PreviewFrame` renders each component in an iframe. Viewport presets live in
   `app/lib/viewport.ts`. Per-component checks register through
   `app/checks/registry.ts`.

## Docs

- Design: `docs/superpowers/specs/2026-06-29-grove-qa-portal-slice1-design.md`
- Plans: `docs/superpowers/plans/2026-06-29-grove-qa-portal-0*.md`
