# @grove/brand

Canonical brand-asset manifest — **ADR-009 Tier 4** (`odoocker/docs/ADR/`, vault `Software/Grove Asset Storage`).

## What lives here

- `assets/gather/*.svg` — Gather at the Grove logo system (first draft 2026-07-05, vault `Marketing/Gathering at the Grove`). SVGs are small, stable, structural → they belong in git. Type is outlined (Fraunces converted to paths), so no font dependency.
- `src/index.ts` — typed getters. A missing/renamed asset is a type error, not a 404.

Raster renders (1600px PNG) are **not** committed — they live on DO Spaces + CDN and resolve via `NEXT_PUBLIC_ASSET_BASE` (per-env, via the Grove Secrets Pipeline / Infisical).

## Usage

```ts
import { gatherLogoSvg, gatherLogoPng } from "@grove/brand";

<img src={gatherLogoSvg("horizontal")} alt="Gather at the Grove" />
// → "/brand/gather/gather-logo-horizontal.svg" locally
// → "https://<cdn>/brand/gather/gather-logo-horizontal.svg" when NEXT_PUBLIC_ASSET_BASE is set
```

Next apps consuming the TS source directly need the package in `transpilePackages`.

The hub app also carries git-tracked copies at `apps/hub/public/brand/gather/` so the app-local fallback works with zero config.

## Uploading renders to DO Spaces

```sh
infisical run -- ./scripts/upload-brand-assets.sh
```

See `scripts/upload-brand-assets.sh` for required env (`SPACES_BUCKET`, `SPACES_REGION`, AWS-style creds).

## Variants

| Variant | Use |
|---|---|
| `primary` | Stacked lockup — hero, social, print |
| `horizontal` | Header / nav |
| `logomark` | Favicon, small squares, watermark |
| `*-reversed` | Parchment-on-dark for deep-earth surfaces; never dark logo on dark bg |

## Adding assets for the other brands

Follow the same shape: `assets/<brand>/…` + typed getters in `src/index.ts`. Goldberry's wreath/fox logo set (Canva Brand Kit / Drive "Brand Kit" folder) is the next candidate.
