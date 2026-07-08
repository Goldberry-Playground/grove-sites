#!/usr/bin/env bash
# Build all four brand design-bundles into dist-bundles/<brand>/.
# Reproducible + offline: installs the committed converter via npm ci, builds the
# kit once, then runs the converter per brand. Used by the qa-portal Docker build
# and CI. Run from the monorepo root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANDS=(goldberry ggg nursery hub)

echo "» installing converter deps (npm ci in .ds-sync)…"
( cd .ds-sync && npm ci --no-audit --no-fund )

echo "» building @grove/ui-kit (tsup)…"
pnpm -F @grove/ui-kit build >/dev/null

rm -rf dist-bundles
for BRAND in "${BRANDS[@]}"; do
  echo "» bundling ${BRAND}…"
  # Reuse the single-brand dev helper's converter invocation, but redirect output
  # to dist-bundles/<brand>. ds-build.sh regenerates ds-theme.<brand>.css first.
  ./scripts/ds-build.sh "$BRAND" >/dev/null
  mkdir -p "dist-bundles/${BRAND}"
  cp -R ds-bundle/. "dist-bundles/${BRAND}/"
done

echo "✓ built ${#BRANDS[@]} brand bundles → dist-bundles/"
