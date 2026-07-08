# Source this to make Playwright's Chromium runnable in the rootless agent runtime.
#   source /paperclip/work/.browser-runtime/activate.sh
# Then: `node your-script.mjs` (playwright resolved from this prefix) just works.
# Relocatable: derives its own path, so a copy in any workspace works unchanged.

_BR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
export PLAYWRIGHT_BROWSERS_PATH="$_BR_DIR/ms-playwright"
export LD_LIBRARY_PATH="$_BR_DIR/libs/usr/lib/x86_64-linux-gnu:$_BR_DIR/libs/lib/x86_64-linux-gnu${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
# Resolve `playwright` from this prefix's node_modules regardless of caller cwd.
export NODE_PATH="$_BR_DIR/node_modules${NODE_PATH:+:$NODE_PATH}"
# Chromium in a container needs these flags; callers should pass them to launch():
#   chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'] })
export PW_CHROMIUM_ARGS="--no-sandbox --disable-dev-shm-usage --disable-gpu"
echo "[browser-runtime] activated: PLAYWRIGHT_BROWSERS_PATH=$PLAYWRIGHT_BROWSERS_PATH"
