# @grove/brand

Canonical brand asset taxonomy + the typed brand-entry path for **ADR-009 Tier 4** (logo-class assets).

## Why this exists

The AgenticOS `#assets` ingest lane (GOL-92) drops an image in Discord, optimizes and
uploads it (Tier 3, grove-sites `upload-asset.ts`), and then:

- **logo class → Tier 4:** opens a PR that records a typed entry in this package's
  brand registry and replies with the **PR URL**.
- **every other class → Tier 3:** just replies with the **CDN URL**.

This package owns the Tier-4 half: the vocabulary, the typed entry model, and the
`AssetBrand` seam the ingest job injects.

## Exports

- **Taxonomy** (`taxonomy.ts`) — `KNOWN_BRANDS`, `KNOWN_CLASSES`, `LOGO_CLASS`,
  `Brand`, `AssetClass`, and guards. This is the source of truth; AgenticOS
  `packages/discord-plugin/src/assets/caption.ts` mirrors it, and
  `taxonomy.test.ts` pins the two together.
- **Model** (`model.ts`) — `BrandEntry`, `BrandAssetRegistry`, and pure
  `registryPath` / `emptyRegistry` / `upsertBrandEntry` / `renderRegistry` /
  `parseRegistry`. One JSON file per brand at `packages/brand/registry/<brand>.json`.
- **Seam** (`asset-brand.ts`) — `createAssetBrand({ repo, pr })` returns an
  `AssetBrand` whose `proposeBrandEntry({ brand, slug, cdnUrl, key, caption })`
  upserts the entry and opens a PR, returning `{ prUrl }`.

## Wiring (runtime)

`createAssetBrand` injects the two side-effecting parts so this package stays
dependency-free and unit-testable:

```ts
import { createAssetBrand } from "@grove/brand";

const assetBrand = createAssetBrand({
  repo: { readRegistry: async (path) => /* read file at main HEAD, or null */ },
  pr: { openPullRequest: async ({ branch, title, body, commitMessage, changes }) =>
        /* create branch + commit changes + open PR */ ({ prUrl }) },
});
// hand `assetBrand` to the AgenticOS ingest job as its `brand` dependency.
```

The real `repo`/`pr` implementations (Octokit / `gh`) live in the AgenticOS runtime
that wires the Discord plugin — not here.
