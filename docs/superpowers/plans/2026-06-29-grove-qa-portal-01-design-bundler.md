# Grove QA Portal — Plan 01: Design-Bundler (committed, reproducible) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the gitignored, skill-staged design-sync converter (`.ds-sync/`) into a committed, dependency-pinned workspace tool so a **clean checkout can reproducibly build all four brand bundles** with one command — the prerequisite for `apps/qa-portal` building bundles at deploy.

**Architecture:** Commit the existing converter (minus `node_modules`) into the repo, pin its install with its own lockfile, and add a single committed entrypoint script `scripts/build-design-bundles.sh` that builds `@grove/ui-kit` then runs the converter for all four brands into a deterministic output directory (`dist-bundles/<brand>/`). No converter *logic* changes — this is "commit + wire + prove reproducible," not a rewrite. The existing `scripts/ds-build.sh` (single-brand dev helper) keeps working unchanged.

**Tech Stack:** Node 22, pnpm 9 (workspace), the existing converter `.ds-sync/*.mjs` (esbuild 0.28, ts-morph 28, playwright 1.61), bash, Vitest (for the reproducibility assertion via a Node test script).

## Global Constraints

- Node `>=22.0.0 <24.0.0`; pnpm `>=9.15.0` (copy from `apps/ggg/package.json` engines).
- TypeScript strict, no `any` (repo convention) — applies to any new `.ts`.
- The converter must run with **no claude.ai / network auth** — bundle *building* is deterministic and offline (only *uploading* to Claude Design needs auth, which is NOT in this plan).
- Output is deterministic: `dist-bundles/<brand>/` for `brand ∈ {goldberry, ggg, nursery, hub}`, each containing at minimum `_ds_bundle.js`, `styles.css`, and `components/general/<Name>/<Name>.html` for the 11 components.
- Do not commit any `node_modules/`. Do not commit `ds-bundle/` or `dist-bundles/` (build outputs).
- Branch: work on `feat/grove-design-system` (the active worktree `grove-sites-ds`).

---

### Task 1: Commit the converter as a tracked tool directory

**Files:**
- Modify: `.gitignore` (ensure `.ds-sync/node_modules/` ignored; ensure `.ds-sync/` itself is NOT ignored)
- Track (git add): `.ds-sync/package.json`, `.ds-sync/package-lock.json`, `.ds-sync/*.mjs`, `.ds-sync/lib/**`, `.ds-sync/storybook/**`
- Create: `.ds-sync/README.md`

**Interfaces:**
- Produces: a committed `.ds-sync/` tool dir whose deps install reproducibly via `npm ci` (it ships an npm `package-lock.json`, separate from the pnpm workspace).

- [ ] **Step 1: Confirm what's currently ignored/untracked**

Run: `cd grove-sites-ds && git status --porcelain .ds-sync | head` and `git check-ignore .ds-sync .ds-sync/node_modules .ds-sync/package-build.mjs`
Expected: `.ds-sync/node_modules` is ignored; the scripts are either untracked or ignored. Note which.

- [ ] **Step 2: Make the ignore rule precise**

Edit `.gitignore` — ensure these two lines exist (add if missing), and remove any blanket `.ds-sync/` ignore if present:

```gitignore
# design-sync converter is a committed build tool; only its installed deps are ignored
.ds-sync/node_modules/
dist-bundles/
```

- [ ] **Step 3: Add a README documenting the tool**

Create `.ds-sync/README.md`:

```markdown
# design-sync converter (committed build tool)

Builds the Next-free `@grove/ui-kit` library into a self-contained, browser-renderable
bundle per brand (vendored React + component IIFE + previews + themed CSS). The exact
artifact consumed by both claude.ai/design and the self-hosted Grove QA Portal.

- Self-contained: ships its own `package.json` + `package-lock.json` (npm, NOT the pnpm
  workspace). Install with `npm ci` inside this dir.
- Entry: `package-build.mjs` (build) / `package-validate.mjs` (checks). Driven by
  `../scripts/build-design-bundles.sh` (all brands) and `../scripts/ds-build.sh` (one brand).
- Offline + auth-free: building a bundle needs no network/claude.ai auth.
```

- [ ] **Step 4: Stage and verify the tool is tracked without node_modules**

Run:
```bash
git add .gitignore .ds-sync/README.md .ds-sync/package.json .ds-sync/package-lock.json .ds-sync/*.mjs .ds-sync/lib .ds-sync/storybook
git status --porcelain .ds-sync | grep -c node_modules
```
Expected: the `grep -c` prints `0` (no node_modules staged); `git status` shows the scripts staged.

- [ ] **Step 5: Commit**

```bash
git commit -m "chore(design-bundler): commit the design-sync converter as a tracked build tool"
```

---

### Task 2: Reproducible clean install of the converter

**Files:**
- Create: `scripts/build-design-bundles.sh`
- Test: `scripts/test/design-bundles.reproducible.mjs`

**Interfaces:**
- Produces: `scripts/build-design-bundles.sh` — builds `@grove/ui-kit` (tsup) once, then runs the converter for all 4 brands into `dist-bundles/<brand>/`. Exit non-zero on any brand failure.
- Consumes (from Task 1): the committed `.ds-sync/` installed via `npm ci`.

- [ ] **Step 1: Write the failing reproducibility test**

Create `scripts/test/design-bundles.reproducible.mjs` (a plain Node test runnable via `node --test`):

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";

const BRANDS = ["goldberry", "ggg", "nursery", "hub"];
const COMPONENTS = [
  "Button", "SiblingStrip", "NavLink", "CartNavLink", "ProductCard",
  "VendorCard", "BuyAtVendorForm", "JournalProductEmbed",
  "HeroSlideshow", "ShopSubHeader", "CategoryBar",
];
const ROOT = join(import.meta.dirname, "..", "..");

test("build-design-bundles produced all 4 brand bundles with all components", () => {
  for (const brand of BRANDS) {
    const dir = join(ROOT, "dist-bundles", brand);
    assert.ok(existsSync(join(dir, "_ds_bundle.js")), `${brand}: _ds_bundle.js missing`);
    assert.ok(existsSync(join(dir, "styles.css")), `${brand}: styles.css missing`);
    for (const c of COMPONENTS) {
      const html = join(dir, "components", "general", c, `${c}.html`);
      assert.ok(existsSync(html), `${brand}: ${c}.html missing`);
    }
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/test/design-bundles.reproducible.mjs`
Expected: FAIL — `dist-bundles/` doesn't exist yet (`_ds_bundle.js missing`).

- [ ] **Step 3: Write the build script**

Create `scripts/build-design-bundles.sh`:

```bash
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
```

- [ ] **Step 4: Make it executable and run it**

Run:
```bash
chmod +x scripts/build-design-bundles.sh
eval "$(fnm env)" && fnm use 22
./scripts/build-design-bundles.sh
```
Expected: prints "✓ built 4 brand bundles → dist-bundles/" with no error.

- [ ] **Step 5: Run the reproducibility test to verify it passes**

Run: `node --test scripts/test/design-bundles.reproducible.mjs`
Expected: PASS (all 4 brands × 11 components + bundle + styles present).

- [ ] **Step 6: Commit**

```bash
git add scripts/build-design-bundles.sh scripts/test/design-bundles.reproducible.mjs
git commit -m "feat(design-bundler): one-command reproducible 4-brand bundle build + test"
```

---

### Task 3: Wire a workspace script + prove a clean-clone build

**Files:**
- Modify: root `package.json` (add a `build:design-bundles` script)

**Interfaces:**
- Produces: `pnpm build:design-bundles` at the repo root — the canonical entrypoint Plan 02's Dockerfile and CI call.

- [ ] **Step 1: Add the root script**

In root `package.json` `"scripts"`, add:

```json
"build:design-bundles": "bash scripts/build-design-bundles.sh"
```

- [ ] **Step 2: Run via the workspace script**

Run: `pnpm build:design-bundles && node --test scripts/test/design-bundles.reproducible.mjs`
Expected: build succeeds; test PASSES.

- [ ] **Step 3: Prove reproducibility from a clean tree (the real assertion)**

Run (simulates a fresh CI checkout — wipes only build outputs + the converter's installed deps, not the committed source):
```bash
rm -rf dist-bundles ds-bundle .ds-sync/node_modules
pnpm build:design-bundles
node --test scripts/test/design-bundles.reproducible.mjs
```
Expected: PASS — proves a clean checkout (no pre-installed converter deps, no prior outputs) reproduces all 4 bundles. **This is the plan's core deliverable.**

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "feat(design-bundler): expose pnpm build:design-bundles workspace entrypoint"
```

---

## Self-Review

**Spec coverage (§4 "build at deploy + productionize the converter", §12 prereq):** Task 1 commits the converter; Tasks 2–3 give a reproducible one-command build proven from a clean tree → satisfies the "productionize the converter" prerequisite that Plan 02's deploy-time build depends on. ✅

**Placeholder scan:** No TBD/TODO; every step has exact commands + full file contents. ✅

**Type/name consistency:** `dist-bundles/<brand>/`, the 11 component names, and `pnpm build:design-bundles` are used identically across Tasks 2–3 and will be consumed verbatim by Plan 02. ✅

**Known follow-ups (not gaps — deferred by design):** ds-build.sh currently writes to `ds-bundle/` then we copy to `dist-bundles/<brand>/`; if a future cleanup wants ds-build to target dist-bundles directly, that's a Plan-02-era optimization, not required here. The converter ships an npm lockfile (separate from pnpm) — intentional (it's a self-contained tool); documented in the README.
