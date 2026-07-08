# design-sync converter (committed build tool)

Builds the Next-free `@grove/ui-kit` library into a self-contained, browser-renderable
bundle per brand (vendored React + component IIFE + previews + themed CSS). The exact
artifact consumed by both claude.ai/design and the self-hosted Grove QA Portal.

- Self-contained: ships its own `package.json` + `package-lock.json` (npm, NOT the pnpm
  workspace). Install with `npm ci` inside this dir.
- Entry: `package-build.mjs` (build) / `package-validate.mjs` (checks). Driven by
  `../scripts/build-design-bundles.sh` (all brands) and `../scripts/ds-build.sh` (one brand).
- Offline + auth-free: building a bundle needs no network/claude.ai auth.
