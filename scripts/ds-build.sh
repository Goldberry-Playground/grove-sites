#!/usr/bin/env bash
#
# Build the @grove/ui-kit design-sync bundle for ONE brand.
# Collapses the regen-theme → tsup build → converter build → validate sequence
# into one command, so re-syncs don't re-derive it each time.
#
# Usage:
#   ./scripts/ds-build.sh <brand> [--render]
#     <brand>   goldberry | ggg | nursery | hub
#     --render  run the playwright/chromium render check (default: skip it)
#
# Prereqs: .ds-sync/ staged (see .design-sync/NOTES.md) and Node 22 (fnm).
set -euo pipefail

BRAND="${1:?usage: ds-build.sh <brand> [--render]}"
MODE="${2:-}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Pin Node 22 (the repo's .nvmrc) if fnm is around — pnpm/tsup reject Node >=24.
if command -v fnm >/dev/null 2>&1; then eval "$(fnm env)"; fnm use 22 >/dev/null 2>&1 || true; fi

THEME="packages/grove-tokens/src/themes/${BRAND}.css"
[ -f "$THEME" ] || { echo "✗ no theme at $THEME (brands: goldberry ggg nursery hub)"; exit 1; }
CFG=".design-sync/config.${BRAND}.json"
[ -f "$CFG" ] || { echo "✗ no config at $CFG"; exit 1; }
[ -d .ds-sync ] || { echo "✗ .ds-sync not staged — see .design-sync/NOTES.md (the cp -r line)"; exit 1; }

# Regenerate the themed CSS bundle. The concatenation recipe lives in
# ds-theme-gen.sh so the ds-theme-drift CI job checks the artifact against the
# exact same derivation this build uses.
./scripts/ds-theme-gen.sh "$BRAND"

echo "» building @grove/ui-kit (tsup)…"
pnpm -F @grove/ui-kit build >/dev/null

echo "» converter build → ds-bundle ($BRAND theme)…"
node .ds-sync/package-build.mjs --config "$CFG" \
  --node-modules packages/grove-ui/node_modules \
  --entry ./packages/grove-ui/dist/index.js --out ./ds-bundle

if [ "$MODE" = "--render" ]; then
  node .ds-sync/package-validate.mjs ./ds-bundle
else
  node .ds-sync/package-validate.mjs ./ds-bundle --no-render-check
fi
echo "✓ ds-bundle ready for $BRAND (project: $(node -e "process.stdout.write(require('./$CFG').projectId||'unpinned')"))"
