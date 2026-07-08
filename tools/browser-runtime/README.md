# browser-runtime — rootless Chromium for the agent runtime

A Playwright Chromium install that runs **without root/sudo** in the Debian-13 agent image,
which ships `node`/`npm`/`curl`/`dpkg` but is missing the browser system libraries
(`libglib-2.0.so.0`, `libnss3`, `libgbm1`, …) and gives agents uid 1000 with no sudo.

Built and owned by **DevOps-Terra** to unblock **GOL-106** visual verification (consumer:
Frontend-Iris). Tracking issue: **GOL-110**.

## Use it (zero setup if this dir is on the shared `/paperclip` volume)

```bash
source /paperclip/work/.browser-runtime/activate.sh
node /paperclip/work/.browser-runtime/smoke.mjs        # sanity check
```

`activate.sh` exports `PLAYWRIGHT_BROWSERS_PATH`, `LD_LIBRARY_PATH`, and `NODE_PATH` so
`require('playwright')` / `import 'playwright'` resolves and Chromium launches. In a
container you **must** pass these launch args (also exported as `$PW_CHROMIUM_ARGS`):

```js
const b = await chromium.launch({ args: ['--no-sandbox','--disable-dev-shm-usage','--disable-gpu'] });
```

## Verifying the goldberry app (the GOL-106 recipe)

```bash
cd /paperclip/work/grove-sites
pnpm install --frozen-lockfile                 # once per workspace
pnpm --filter goldberry dev &                  # serves http://localhost:3001
# wait for "ready", then in a node script with activate.sh sourced:
#   await page.setViewportSize({width:1440,height:900}); await page.goto('http://localhost:3001'); await page.screenshot(...)
#   await page.setViewportSize({width:390, height:844}); await page.screenshot(...)
```

No public egress is needed to drive the browser — the dev server and Chromium are both local.

## Rebuild from scratch (any workspace, e.g. a non-shared FS)

```bash
bash bootstrap.sh [PREFIX_DIR]     # idempotent; downloads playwright+chromium, resolves libs, smoke-tests
```

Egress to `deb.debian.org` (HTTPS) is required **only during build**. We bypass `apt` (its
stale index causes the `libc6` version mismatch Iris hit) by curling exact `.deb` URLs from
the trixie pool and `dpkg -x`-extracting them into `libs/`.

## Files

| file | purpose |
|---|---|
| `activate.sh` | source to set env; relocatable (derives its own path) |
| `bootstrap.sh` | idempotent full build from scratch |
| `resolve-libs.sh` | iterative `ldd`-closure lib resolver (self-healing across point releases) |
| `smoke.mjs` | launch + screenshot sanity check |
| `ms-playwright/` | Chromium 149 browser binaries (~646M) |
| `libs/` | extracted Debian system libs (~294M) |
| `idx/` | trixie Packages+Contents indexes; **deletable** after build (~215M) |

## This directory is the source of truth

These scripts are the **canonical source**; the deployed prefix on the shared volume
(`/paperclip/work/.browser-runtime/`) is *generated* from them by `bootstrap.sh`. The heavy
build artifacts (`ms-playwright/`, `libs/`, `idx/`, `debs/`, `node_modules/`) are `.gitignore`d
— they are reproducible outputs, not source. To rehydrate a fresh checkout into a runnable
prefix, run `bash bootstrap.sh` (see "Rebuild from scratch" above).

## Durable follow-up — permanent fix

The rootless prefix exists only because the *current* agent base image ships no browser libs
and gives agents uid 1000 with no sudo. The permanent fix is to bake the Playwright dep set
into the base image so no per-workspace prefix is needed at all. That evaluation — with the
exact Dockerfile snippet for each image and a recommendation — lives in
[`BASE-IMAGE-BAKE.md`](./BASE-IMAGE-BAKE.md). Tracking: GOL-119 (follow-up to GOL-110).
