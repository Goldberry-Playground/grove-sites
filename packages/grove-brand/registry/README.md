# Brand entry registry

Typed brand-entry manifests, one JSON file per brand (`<brand>.json`), recording
logo-class assets uploaded through the AgenticOS `#assets` lane (ADR-009 Tier 4).

These files are **written by PRs** that `@grove/brand/ingest`'s
`proposeBrandEntry` opens — do not hand-edit unless you are fixing a bad entry.
Each file is canonical JSON (stable field order, sorted by `assetClass` + `slug`)
so the PRs produce clean, reviewable diffs.

See `../src/ingest/` for the model and the `AssetBrand` seam.
