#!/usr/bin/env bash
#
# Build the @grove/ui-kit design-sync bundle for ONE brand.
# Collapses the guard → regen-theme → tsup build → converter build → validate
# sequence into one command, so re-syncs don't re-derive it each time.
#
# Usage:
#   ./scripts/ds-build.sh <brand> [--render] [--force] [--adopt-baseline]
#     <brand>           goldberry | ggg | nursery | hub
#     --render          run the playwright/chromium render check (default: skip it)
#     --force           build even though the guard says the published project
#                       has diverged. You are choosing to destroy whatever a
#                       human changed in-app. Get their sign-off first.
#     --adopt-baseline  record the CURRENT published state as the guard's
#                       baseline, then build. Use right after a push you made,
#                       or after consciously accepting an in-app change.
#
# Prereqs: .ds-sync/ staged (see .design-sync/NOTES.md) and Node 22 (fnm).
set -euo pipefail

BRAND=""
RENDER=0
FORCE=0
ADOPT=0
for arg in "$@"; do
  case "$arg" in
    --render)         RENDER=1 ;;
    --force)          FORCE=1 ;;
    --adopt-baseline) ADOPT=1 ;;
    --*)              echo "✗ unknown flag $arg"; exit 2 ;;
    *)                [ -z "$BRAND" ] && BRAND="$arg" || { echo "✗ unexpected argument $arg"; exit 2; } ;;
  esac
done
[ -n "$BRAND" ] || { echo "usage: ds-build.sh <brand> [--render] [--force] [--adopt-baseline]"; exit 2; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Pin Node 22 (the repo's .nvmrc) if fnm is around — pnpm/tsup reject Node >=24.
if command -v fnm >/dev/null 2>&1; then eval "$(fnm env)"; fnm use 22 >/dev/null 2>&1 || true; fi

THEME="packages/grove-tokens/src/themes/${BRAND}.css"
[ -f "$THEME" ] || { echo "✗ no theme at $THEME (brands: goldberry ggg nursery hub)"; exit 1; }
CFG=".design-sync/config.${BRAND}.json"
[ -f "$CFG" ] || { echo "✗ no config at $CFG"; exit 1; }
[ -d .ds-sync ] || { echo "✗ .ds-sync not staged — see .design-sync/NOTES.md (the cp -r line)"; exit 1; }

PROJECT_ID="$(node -e "process.stdout.write(require('./$CFG').projectId||'')")"

# ── Pre-push guard (GOL-402) ──────────────────────────────────────────────
#
# .design-sync is one-way outbound with no version history on the far side, so
# an outbound push can silently overwrite a brand owner's in-app retheme — and
# the push makes repo and published agree again, so no drift detector would ever
# notice. This is the gate that fires BEFORE the damage.
#
# The gate lives here, at build time, rather than at the push call itself: the
# push is a DesignSync write_files invocation made by an agent, and there is no
# script to hook. Gating the BUILD is what makes it enforceable — no verified
# snapshot means no ds-bundle/ on disk, and a push has nothing to upload.
#
# The fetch is the agent's job: DesignSync is the only thing holding auth for
# the project and it has no CLI. Everything after the fetch is deterministic and
# lives in ds-guard.mjs (same agent-fetch/local-diff split as
# .ds-sync/lib/remote-diff.mjs already uses for its sidecar anchor).
SNAP_DIR=".ds-sync/published/${BRAND}"
SNAP="${SNAP_DIR}/_ds_bundle.css"
# A snapshot from last week can't attest to a retheme made yesterday, so a stale
# one is treated as no snapshot at all rather than quietly vouching for the push.
MAX_AGE_MIN="${DS_GUARD_MAX_AGE_MIN:-60}"

fetch_instructions() {
  cat <<EOF

  Fetch the live published bundle first (agent step — DesignSync holds the auth):

    DesignSync(method: "get_file",
               projectId: "${PROJECT_ID:-<see $CFG>}",
               path: "_ds_bundle.css")

  Save the returned content verbatim to:

    ${SNAP}

  then re-run this command. The snapshot is gitignored and must be < ${MAX_AGE_MIN} min old.
EOF
}

if [ ! -f "$SNAP" ]; then
  echo "✗ ds-guard [$BRAND]: no published snapshot at $SNAP"
  echo ""
  echo "  Refusing to build a pushable bundle without first reading what is live."
  echo "  Pushing blind is how a brand owner's in-app retheme gets destroyed."
  fetch_instructions
  if [ "$FORCE" = 1 ]; then
    echo ""
    echo "  (--force does NOT skip the fetch: with no snapshot there is nothing to"
    echo "   force past. --force overrides a DIVERGENCE VERDICT, not the absence of one.)"
  fi
  exit 1
fi

if [ -n "$(find "$SNAP" -mmin +"$MAX_AGE_MIN" 2>/dev/null)" ]; then
  echo "✗ ds-guard [$BRAND]: published snapshot is stale (older than ${MAX_AGE_MIN} min)"
  echo ""
  echo "  $SNAP"
  echo "  last fetched: $(date -r "$SNAP" '+%Y-%m-%d %H:%M:%S %Z')"
  echo ""
  echo "  A stale snapshot cannot rule out a retheme made since it was taken."
  fetch_instructions
  exit 1
fi

if [ "$ADOPT" = 1 ]; then
  echo "» ds-guard [$BRAND]: adopting the live published state as the baseline…"
  node ./scripts/ds-guard.mjs --brand "$BRAND" --published "$SNAP" --adopt
elif node ./scripts/ds-guard.mjs --brand "$BRAND" --published "$SNAP"; then
  :
elif [ "$FORCE" = 1 ]; then
  cat <<EOF

  ╔══════════════════════════════════════════════════════════════════════════╗
  ║  --force: BUILDING OVER A DIVERGED PROJECT                               ║
  ║                                                                          ║
  ║  The guard found changes in the published $BRAND project that are not
  ║  in our baseline. Pushing this bundle will overwrite them permanently —  ║
  ║  there is no version history on the Claude Design side to restore from.  ║
  ║                                                                          ║
  ║  Only proceed if the brand owner has explicitly agreed to lose them.     ║
  ╚══════════════════════════════════════════════════════════════════════════╝

EOF
  # Not a prompt: this runs non-interactively under agents. The pause is here so
  # the banner cannot scroll past unread in a log, and so a --force typed out of
  # reflex still costs its author a beat to notice what it says.
  sleep 5
  echo "  …proceeding under --force."
else
  # ds-guard.mjs has already printed the token diff and the remediation paths.
  exit 1
fi

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

if [ "$RENDER" = 1 ]; then
  node .ds-sync/package-validate.mjs ./ds-bundle
else
  node .ds-sync/package-validate.mjs ./ds-bundle --no-render-check
fi
echo "✓ ds-bundle ready for $BRAND (project: ${PROJECT_ID:-unpinned})"
echo ""
echo "  After the push lands, re-adopt the baseline so the guard's anchor tracks"
echo "  what is now live — otherwise the next build reports your own push as drift:"
echo "    (re-fetch $SNAP, then) ./scripts/ds-build.sh $BRAND --adopt-baseline"
