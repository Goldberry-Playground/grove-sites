#!/usr/bin/env bash
#
# Generate packages/grove-ui/ds-theme.<brand>.css — the flattened, themed CSS
# bundle each Claude Design project consumes.
#
# This is the SINGLE definition of how that artifact is derived. Both
# ds-build.sh (full sync pipeline) and the ds-theme-drift CI job call it, so a
# regenerate and a drift check can never disagree about what "correct" means.
#
# Usage:
#   ./scripts/ds-theme-gen.sh <brand>   # goldberry | ggg | nursery | hub
#   ./scripts/ds-theme-gen.sh --all
#
# Unlike ds-build.sh this needs no .ds-sync staging and no node_modules — it is
# pure concatenation, which is what lets CI verify it on a bare checkout.
set -euo pipefail

# Byte-stable glob ordering. Without this the component-CSS glob expands in the
# runner's locale collation and CI would diff against a differently-ordered
# local regen.
export LC_ALL=C

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BRANDS=(goldberry ggg nursery hub)

FONTS='@import url("https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=IBM+Plex+Mono:wght@400;500;600&display=swap");'

gen_brand() {
  local brand="$1"
  local theme="packages/grove-tokens/src/themes/${brand}.css"
  [ -f "$theme" ] || { echo "✗ no theme at $theme (brands: ${BRANDS[*]})" >&2; exit 1; }

  # Order is load-bearing: Google-Fonts @import must lead the file (CSS requires
  # @import first), then the token contract defaults, then the brand theme
  # overriding those roles, then every lifted component's CSS — components last
  # so their var() references resolve against an already-assigned theme.
  local files=(packages/grove-tokens/src/contract.css "$theme")
  # Optional per-brand self-hosted @font-face (e.g. goldberry's licensed
  # Baskerville Classico). Concatenated only when that brand has one.
  [ -f "packages/grove-ui/brand-fonts/${brand}.css" ] && files+=("packages/grove-ui/brand-fonts/${brand}.css")
  files+=(packages/grove-ui/src/*/*.css)

  { echo "$FONTS"; cat "${files[@]}"; } > "packages/grove-ui/ds-theme.${brand}.css"
}

if [ "${1:?usage: ds-theme-gen.sh <brand>|--all}" = "--all" ]; then
  for b in "${BRANDS[@]}"; do gen_brand "$b"; echo "✓ regenerated packages/grove-ui/ds-theme.${b}.css"; done
else
  gen_brand "$1"
  echo "✓ regenerated packages/grove-ui/ds-theme.${1}.css"
fi
