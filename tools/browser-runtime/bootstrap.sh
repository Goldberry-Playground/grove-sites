#!/usr/bin/env bash
# Idempotent rootless build of a Chromium-capable Playwright runtime — no sudo/root needed.
# Works on Debian 13 (trixie) agent images that ship node/npm/curl/dpkg but lack browser libs.
# Safe to re-run; converges to a known-good state.
#
#   bash bootstrap.sh [PREFIX_DIR]      # default PREFIX_DIR = this script's dir
#
# Rationale: the agent image has apt-get + dpkg but uid 1000 with no sudo and a stale apt
# index (which is why `apt-get download` fails with a libc6 mismatch). We bypass apt entirely:
# curl the exact .deb URLs from the trixie pool and `dpkg -x` extract them into a userspace
# prefix, then point LD_LIBRARY_PATH at it. Egress to deb.debian.org (HTTPS) is required
# ONLY for this build step — once built, the runtime needs no network.
set -euo pipefail
ROOT="${1:-$(cd "$(dirname "$0")" && pwd)}"
mkdir -p "$ROOT"/{ms-playwright,idx,debs,libs}
cd "$ROOT"
export npm_config_cache="$ROOT/.npm"
export PLAYWRIGHT_BROWSERS_PATH="$ROOT/ms-playwright"

echo "== 1/4 playwright + chromium binary =="
[ -f package.json ] || echo '{"name":"browser-runtime","private":true,"version":"1.0.0"}' > package.json
[ -d node_modules/playwright ] || npm install --no-audit --no-fund playwright@latest
npx playwright install chromium

echo "== 2/4 trixie indexes (only for lib resolution) =="
BASE=https://deb.debian.org/debian/dists/trixie/main
[ -f idx/Packages ] || { curl -fsS "$BASE/binary-amd64/Packages.gz" -o idx/Packages.gz && gunzip -f idx/Packages.gz; }
[ -f idx/Contents ] || { curl -fsS "$BASE/Contents-amd64.gz"        -o idx/Contents.gz  && gunzip -f idx/Contents.gz;  }

echo "== 3/4 resolve system libs (iterative ldd closure) =="
CHROME="$(find "$ROOT/ms-playwright" -type f -name chrome | head -1)"
[ -n "$CHROME" ] || { echo "chromium binary not found"; exit 1; }
bash "$ROOT/resolve-libs.sh" "$CHROME" "$ROOT"

echo "== 4/4 smoke test =="
# shellcheck disable=SC1091
source "$ROOT/activate.sh"
node "$ROOT/smoke.mjs"
echo
echo "DONE. To use in any shell:  source $ROOT/activate.sh"
echo "Reclaim 215M once stable:   rm -rf $ROOT/idx   (only needed to re-resolve libs)"
