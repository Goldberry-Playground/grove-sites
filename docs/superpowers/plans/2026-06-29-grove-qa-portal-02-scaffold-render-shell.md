# Grove QA Portal — Plan 02: App Scaffold + Render Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `apps/qa-portal` (Next 15, standalone) that serves each brand's built design bundle as a component gallery — brand-in-route with a brand switcher, an iframe-per-preview gallery, and a **pluggable checks registry** shipping exactly one check (viewport switching) — consuming the `dist-bundles/<brand>/` output Plan 01 made reproducible.

**Architecture:** The portal is a pure render shell over static bytes. A `predev`/`prebuild` hook copies `dist-bundles/<brand>/` into `apps/qa-portal/public/bundles/<brand>/`, preserving the tree so each component preview's **relative** asset loads (`../../../_vendor/react.js`, `../../../_ds_bundle.js`, `../../../styles.css`) resolve when served at `/bundles/<brand>/...`. A Server Component lists components by reading the bundle directory (no manifest — the dir listing *is* the component list). Viewport switching is implemented as the single registered check, so the checks rail and viewport control are the same extension point that axe/contrast/vision-sim plug into later with no shell changes.

**Tech Stack:** Next 15 App Router (standalone output), React 19, TypeScript strict, Vitest 4 (co-located `*.test.ts`, the repo's existing pattern), Node 22 `fs`/`cpSync` for bundle sync. No Tailwind (plain global CSS for the internal-tool chrome — minimal scaffold surface). No new test deps.

## Global Constraints

- Node `>=22.0.0 <24.0.0`; pnpm `>=9.15.0` (copy engines from `apps/goldberry/package.json`).
- TypeScript **strict, no `any`** (repo convention).
- Server Components by default; `'use client'` only where interactivity requires it (repo convention).
- Line length 100; PascalCase component files; `route.ts`/App-Router conventions.
- Brands are exactly `goldberry | ggg | nursery | hub`; the 11 components are `Button, BuyAtVendorForm, CartNavLink, CategoryBar, HeroSlideshow, JournalProductEmbed, NavLink, ProductCard, ShopSubHeader, SiblingStrip, VendorCard` (alphabetical = the `components/general/` dir listing).
- The portal **consumes the built bundle as static files** — it does NOT depend on `@grove/ui-kit` as a workspace package. No AI, no DB, no network beyond loading the static bundle (those are Plans 03–04).
- Do **not** commit `apps/qa-portal/public/bundles/` (synced build output) or `.next/`.
- Branch: work on `feat/grove-design-system` (worktree `grove-sites-ds`).
- **Prerequisite:** `pnpm build:design-bundles` (Plan 01) must have produced `dist-bundles/<brand>/` before the portal's sync hook runs. The sync script fails loudly if it's missing.

---

### Task 1: Scaffold the qa-portal app (boots, builds, brand model)

**Files:**
- Create: `apps/qa-portal/package.json`
- Create: `apps/qa-portal/next.config.ts`
- Create: `apps/qa-portal/tsconfig.json`
- Create: `apps/qa-portal/eslint.config.mjs`
- Create: `apps/qa-portal/app/globals.css`
- Create: `apps/qa-portal/app/layout.tsx`
- Create: `apps/qa-portal/app/page.tsx`
- Create: `apps/qa-portal/app/lib/brands.ts`
- Test: `apps/qa-portal/app/lib/brands.test.ts`
- Modify: `.gitignore` (ignore `apps/qa-portal/public/bundles/`)

**Interfaces:**
- Produces: `BRANDS: readonly Brand[]`, `type Brand = "goldberry"|"ggg"|"nursery"|"hub"`, `isBrand(value: string): value is Brand`, `BRAND_LABELS: Record<Brand,string>` — consumed by every later task.
- Produces: a buildable `@grove/qa-portal` Next app with a home page linking to each brand.

- [ ] **Step 1: Write the failing brand-model test**

Create `apps/qa-portal/app/lib/brands.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BRANDS, BRAND_LABELS, isBrand } from "./brands";

describe("brands", () => {
  it("lists exactly the four brands", () => {
    expect([...BRANDS]).toEqual(["goldberry", "ggg", "nursery", "hub"]);
  });

  it("isBrand accepts known brands and rejects others", () => {
    expect(isBrand("goldberry")).toBe(true);
    expect(isBrand("ggg")).toBe(true);
    expect(isBrand("bogus")).toBe(false);
    expect(isBrand("")).toBe(false);
  });

  it("has a human label for every brand", () => {
    for (const b of BRANDS) {
      expect(typeof BRAND_LABELS[b]).toBe("string");
      expect(BRAND_LABELS[b].length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/qa-portal/app/lib/brands.test.ts`
Expected: FAIL — cannot resolve `./brands`.

- [ ] **Step 3: Implement the brand model**

Create `apps/qa-portal/app/lib/brands.ts`:

```ts
export const BRANDS = ["goldberry", "ggg", "nursery", "hub"] as const;

export type Brand = (typeof BRANDS)[number];

export function isBrand(value: string): value is Brand {
  return (BRANDS as readonly string[]).includes(value);
}

export const BRAND_LABELS: Record<Brand, string> = {
  goldberry: "Goldberry Grove",
  ggg: "GGG Woodworking",
  nursery: "Grove Nursery",
  hub: "Gather at the Grove",
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run apps/qa-portal/app/lib/brands.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Create the app manifest and configs**

Create `apps/qa-portal/package.json` (mirrors the brand apps' engines/devDeps; port `3005`; the sync hooks are added in Task 2 — keep `predev`/`prebuild` out for now so the app builds standalone before bundles exist):

```json
{
  "name": "@grove/qa-portal",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "CI=1 NEXT_TELEMETRY_DISABLED=1 next dev --port 3005",
    "build": "next build",
    "start": "next start --port 3005",
    "lint": "eslint .",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^15.5.18",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "server-only": "^0.0.1"
  },
  "devDependencies": {
    "@eslint/eslintrc": "^3.3.5",
    "@next/eslint-plugin-next": "^16.2.1",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@typescript-eslint/parser": "^8.58.0",
    "eslint": "^9.39.4",
    "eslint-config-next": "^16.2.1",
    "typescript": "^5.7.0"
  },
  "engines": {
    "node": ">=22.0.0 <24.0.0",
    "pnpm": ">=9.15.0"
  }
}
```

Create `apps/qa-portal/next.config.ts`:

```ts
import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Self-contained server bundle for Docker deploys (same pattern as the brand apps).
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
```

Create `apps/qa-portal/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `apps/qa-portal/eslint.config.mjs` (verbatim from `apps/goldberry/eslint.config.mjs`):

```js
import nextPlugin from "@next/eslint-plugin-next";
import tsParser from "@typescript-eslint/parser";

export default [
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
    languageOptions: {
      parser: tsParser,
    },
  },
  {
    ignores: [".next/**", "node_modules/**"],
  },
];
```

- [ ] **Step 6: Create the root layout, global CSS, and home page**

Create `apps/qa-portal/app/globals.css`:

```css
:root {
  --bg: #fafaf8;
  --ink: #1c1b18;
  --muted: #6b7280;
  --line: #e5e7eb;
  --accent: #2f6f4f;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--bg);
  color: var(--ink);
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}
a { color: var(--accent); }
.portal-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
}
.portal-header h1 { font-size: 1.1rem; margin: 0; }
.brand-switcher { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.brand-switcher a { text-decoration: none; font-size: 0.9rem; }
.brand-switcher a[aria-current="page"] { font-weight: 700; text-decoration: underline; }
.home { padding: 2rem 1.5rem; }
.home ul { list-style: none; padding: 0; display: grid; gap: 0.5rem; }
.gallery {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
  padding: 1.5rem;
}
.preview {
  margin: 0;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
  overflow: hidden;
}
.preview figcaption {
  font: 600 0.8rem ui-monospace, monospace;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--line);
}
.preview-rail {
  display: flex;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--line);
  flex-wrap: wrap;
}
.check-viewport { display: flex; gap: 0.25rem; }
.check-viewport button {
  font: 0.75rem ui-monospace, monospace;
  text-transform: capitalize;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
}
.check-viewport button[aria-pressed="true"] {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.preview-stage { padding: 1rem; display: flex; justify-content: center; }
.preview-stage iframe { border: 0; background: #fff; }
```

Create `apps/qa-portal/app/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Grove Component QA",
  description: "Self-hosted component review for the Grove design system.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `apps/qa-portal/app/page.tsx`:

```tsx
import Link from "next/link";
import { BRANDS, BRAND_LABELS } from "./lib/brands";

export default function Home() {
  return (
    <main className="home">
      <h1>Grove Component QA</h1>
      <ul>
        {BRANDS.map((b) => (
          <li key={b}>
            <Link href={`/${b}`}>{BRAND_LABELS[b]}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 7: Ignore the synced bundle output**

In `.gitignore`, add (near the existing `dist-bundles/` rule from Plan 01):

```gitignore
apps/qa-portal/public/bundles/
```

- [ ] **Step 8: Install and verify the app type-checks and builds**

Run:
```bash
eval "$(fnm env)" && fnm use 22
pnpm install
pnpm --filter @grove/qa-portal type-check
pnpm --filter @grove/qa-portal build
```
Expected: install resolves the new workspace; `type-check` clean; `build` succeeds and reports the `/` route prerendered. (No `[brand]` route yet — that's Task 4.)

- [ ] **Step 9: Commit**

```bash
git add apps/qa-portal/package.json apps/qa-portal/next.config.ts apps/qa-portal/tsconfig.json \
  apps/qa-portal/eslint.config.mjs apps/qa-portal/app .gitignore pnpm-lock.yaml
git commit -m "feat(qa-portal): scaffold Next app shell + brand model"
```

---

### Task 2: Sync bundles into public + bundle-reading lib

**Files:**
- Create: `scripts/sync-bundles.mjs`
- Create: `apps/qa-portal/app/lib/bundle.ts`
- Test: `apps/qa-portal/app/lib/bundle.test.ts`
- Modify: `apps/qa-portal/package.json` (add `predev`/`prebuild` sync hooks)

**Interfaces:**
- Consumes (Task 1): `type Brand`.
- Consumes (Plan 01): `dist-bundles/<brand>/` at the repo root.
- Produces: `listComponents(brand: Brand, baseDir?: string): string[]` — sorted component names from `<baseDir>/<brand>/components/general`; default `baseDir` = `apps/qa-portal/public/bundles`.
- Produces: `previewSrc(brand: Brand, component: string): string` → `/bundles/<brand>/components/general/<Name>/<Name>.html`.
- Produces: `scripts/sync-bundles.mjs` — copies `dist-bundles/<brand>/` → `apps/qa-portal/public/bundles/<brand>/` for the 4 known brands; exits non-zero with a clear message if `dist-bundles/` (or a brand) is missing.

- [ ] **Step 1: Write the failing bundle-reading test**

Create `apps/qa-portal/app/lib/bundle.test.ts` (builds a throwaway fixture tree, so the test never depends on a prior build):

```ts
import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listComponents, previewSrc } from "./bundle";

const base = mkdtempSync(join(tmpdir(), "qa-bundle-"));
const generalDir = join(base, "goldberry", "components", "general");
for (const name of ["SiblingStrip", "Button", "NavLink"]) {
  mkdirSync(join(generalDir, name), { recursive: true });
  writeFileSync(join(generalDir, name, `${name}.html`), "<!doctype html>");
}

afterAll(() => rmSync(base, { recursive: true, force: true }));

describe("bundle", () => {
  it("lists components from the bundle dir, sorted", () => {
    expect(listComponents("goldberry", base)).toEqual(["Button", "NavLink", "SiblingStrip"]);
  });

  it("builds the public preview src for a component", () => {
    expect(previewSrc("ggg", "Button")).toBe(
      "/bundles/ggg/components/general/Button/Button.html",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/qa-portal/app/lib/bundle.test.ts`
Expected: FAIL — cannot resolve `./bundle`.

- [ ] **Step 3: Implement the bundle-reading lib**

Create `apps/qa-portal/app/lib/bundle.ts`:

```ts
import { readdirSync } from "node:fs";
import { join } from "node:path";
import type { Brand } from "./brands";

// Where the predev/prebuild sync hook copies dist-bundles/<brand>/.
const PUBLIC_BUNDLES = join(process.cwd(), "public", "bundles");

/**
 * The component list for a brand IS the directory listing of its bundle's
 * components/general/ — no manifest. `baseDir` is injectable for tests.
 */
export function listComponents(brand: Brand, baseDir: string = PUBLIC_BUNDLES): string[] {
  const dir = join(baseDir, brand, "components", "general");
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Public URL of a component's self-contained preview HTML (relative asset loads resolve here). */
export function previewSrc(brand: Brand, component: string): string {
  return `/bundles/${brand}/components/general/${component}/${component}.html`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run apps/qa-portal/app/lib/bundle.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the sync script**

Create `scripts/sync-bundles.mjs`:

```js
#!/usr/bin/env node
// Copy each brand's built bundle from dist-bundles/<brand>/ into the qa-portal's
// public/bundles/<brand>/ so Next serves the previews as static assets with their
// RELATIVE asset paths intact (../../../_vendor/react.js etc.). Iterates the four
// known brands only — never the stray "<brand> 2" copy artifacts in dist-bundles/.
// Run by the portal's predev/prebuild hooks (and the Plan 05 Docker build).
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BRANDS = ["goldberry", "ggg", "nursery", "hub"];
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "dist-bundles");
const DEST = join(ROOT, "apps", "qa-portal", "public", "bundles");

if (!existsSync(SRC)) {
  console.error("✗ dist-bundles/ missing — run `pnpm build:design-bundles` first.");
  process.exit(1);
}

rmSync(DEST, { recursive: true, force: true });
mkdirSync(DEST, { recursive: true });

for (const brand of BRANDS) {
  const from = join(SRC, brand);
  if (!existsSync(from)) {
    console.error(`✗ dist-bundles/${brand}/ missing — rebuild with \`pnpm build:design-bundles\`.`);
    process.exit(1);
  }
  cpSync(from, join(DEST, brand), { recursive: true });
}

console.log(`✓ synced ${BRANDS.length} brand bundles → apps/qa-portal/public/bundles/`);
```

- [ ] **Step 6: Wire the sync hooks into the portal**

In `apps/qa-portal/package.json`, add `predev` and `prebuild` to `"scripts"` (they run automatically before `dev`/`build`):

```json
    "predev": "node ../../scripts/sync-bundles.mjs",
    "prebuild": "node ../../scripts/sync-bundles.mjs",
```

(Place them above `"dev"` so the object reads `predev, prebuild, dev, build, start, lint, type-check`.)

- [ ] **Step 7: Prove the sync from real bundles**

Run (rebuild the bundles if `dist-bundles/` is absent, then sync):
```bash
[ -d dist-bundles ] || pnpm build:design-bundles
node scripts/sync-bundles.mjs
ls apps/qa-portal/public/bundles/goldberry/components/general | wc -l
test -f apps/qa-portal/public/bundles/goldberry/_ds_bundle.js && echo "OK: bundle root copied"
```
Expected: prints `✓ synced 4 brand bundles …`; the `wc -l` prints `11`; prints `OK: bundle root copied`.

- [ ] **Step 8: Commit**

```bash
git add scripts/sync-bundles.mjs apps/qa-portal/app/lib/bundle.ts \
  apps/qa-portal/app/lib/bundle.test.ts apps/qa-portal/package.json
git commit -m "feat(qa-portal): sync brand bundles into public + bundle-reading lib"
```

---

### Task 3: Pluggable checks registry + viewport check (pure logic)

**Files:**
- Create: `apps/qa-portal/app/lib/viewport.ts`
- Test: `apps/qa-portal/app/lib/viewport.test.ts`
- Create: `apps/qa-portal/app/checks/types.ts`
- Create: `apps/qa-portal/app/checks/registry.ts`
- Test: `apps/qa-portal/app/checks/registry.test.ts`
- Create: `apps/qa-portal/app/checks/viewport.tsx`
- Create: `apps/qa-portal/app/checks/index.ts`
- Test: `apps/qa-portal/app/checks/index.test.tsx`

**Interfaces:**
- Produces: `type Viewport = "mobile"|"tablet"|"desktop"`, `VIEWPORTS: readonly Viewport[]`, `VIEWPORT_WIDTHS: Record<Viewport,number>`, `viewportWidth(v: Viewport): number`.
- Produces: `interface CheckControlProps { viewport: Viewport; setViewport: (v: Viewport) => void; frameRef: RefObject<HTMLIFrameElement | null>; }` and `interface Check { id: string; label: string; Control: ComponentType<CheckControlProps>; }`.
- Produces: `registerCheck(check: Check): void` (throws on duplicate id), `getChecks(): readonly Check[]`.
- Produces: `viewportCheck: Check` (id `"viewport"`) and `app/checks/index.ts` which registers it on import and re-exports `getChecks`. This is the single seam axe/contrast/vision-sim register into later.

- [ ] **Step 1: Write the failing viewport-dims test**

Create `apps/qa-portal/app/lib/viewport.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { VIEWPORTS, VIEWPORT_WIDTHS, viewportWidth } from "./viewport";

describe("viewport", () => {
  it("orders viewports small → large", () => {
    expect([...VIEWPORTS]).toEqual(["mobile", "tablet", "desktop"]);
  });

  it("maps each viewport to its pixel width", () => {
    expect(viewportWidth("mobile")).toBe(375);
    expect(viewportWidth("tablet")).toBe(768);
    expect(viewportWidth("desktop")).toBe(1280);
  });

  it("widths strictly increase across the ordered viewports", () => {
    const widths = VIEWPORTS.map((v) => VIEWPORT_WIDTHS[v]);
    for (let i = 1; i < widths.length; i++) {
      expect(widths[i]).toBeGreaterThan(widths[i - 1]);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run apps/qa-portal/app/lib/viewport.test.ts`
Expected: FAIL — cannot resolve `./viewport`.

- [ ] **Step 3: Implement the viewport model**

Create `apps/qa-portal/app/lib/viewport.ts`:

```ts
export const VIEWPORTS = ["mobile", "tablet", "desktop"] as const;

export type Viewport = (typeof VIEWPORTS)[number];

export const VIEWPORT_WIDTHS: Record<Viewport, number> = {
  mobile: 375,
  tablet: 768,
  desktop: 1280,
};

export function viewportWidth(v: Viewport): number {
  return VIEWPORT_WIDTHS[v];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run apps/qa-portal/app/lib/viewport.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing registry test**

Create `apps/qa-portal/app/checks/registry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getChecks, registerCheck } from "./registry";
import type { Check } from "./types";

const stub = (id: string): Check => ({
  id,
  label: id,
  Control: () => null,
});

describe("checks registry", () => {
  it("registers a check and returns it from getChecks", () => {
    registerCheck(stub("alpha"));
    expect(getChecks().map((c) => c.id)).toContain("alpha");
  });

  it("rejects a duplicate id", () => {
    registerCheck(stub("beta"));
    expect(() => registerCheck(stub("beta"))).toThrow(/already registered/);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm vitest run apps/qa-portal/app/checks/registry.test.ts`
Expected: FAIL — cannot resolve `./registry` / `./types`.

- [ ] **Step 7: Implement the check types + registry**

Create `apps/qa-portal/app/checks/types.ts`:

```ts
import type { ComponentType, RefObject } from "react";
import type { Viewport } from "../lib/viewport";

export interface CheckControlProps {
  viewport: Viewport;
  setViewport: (v: Viewport) => void;
  frameRef: RefObject<HTMLIFrameElement | null>;
}

/**
 * A check is one entry in the inspection rail. It declares a label and a
 * Control rendered per-preview. Future checks (axe, contrast, vision-sim) use
 * `frameRef` to measure the live iframe; the shipped viewport check only drives
 * `setViewport`. Registering a new check requires no shell changes.
 */
export interface Check {
  id: string;
  label: string;
  Control: ComponentType<CheckControlProps>;
}
```

Create `apps/qa-portal/app/checks/registry.ts`:

```ts
import type { Check } from "./types";

const checks: Check[] = [];

export function registerCheck(check: Check): void {
  if (checks.some((c) => c.id === check.id)) {
    throw new Error(`check already registered: ${check.id}`);
  }
  checks.push(check);
}

export function getChecks(): readonly Check[] {
  return checks;
}
```

- [ ] **Step 8: Run the registry test to verify it passes**

Run: `pnpm vitest run apps/qa-portal/app/checks/registry.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Write the failing viewport-check test**

Create `apps/qa-portal/app/checks/index.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { getChecks } from "./index";
import { viewportCheck } from "./viewport";

describe("registered checks", () => {
  it("ships exactly the viewport check", () => {
    expect(getChecks().map((c) => c.id)).toEqual(["viewport"]);
  });

  it("the viewport check is well-formed", () => {
    expect(viewportCheck.id).toBe("viewport");
    expect(viewportCheck.label).toBe("Viewport");
    expect(typeof viewportCheck.Control).toBe("function");
  });
});
```

- [ ] **Step 10: Run the test to verify it fails**

Run: `pnpm vitest run apps/qa-portal/app/checks/index.test.tsx`
Expected: FAIL — cannot resolve `./index` / `./viewport`.

- [ ] **Step 11: Implement the viewport check and the registration index**

Create `apps/qa-portal/app/checks/viewport.tsx`:

```tsx
"use client";

import { VIEWPORTS } from "../lib/viewport";
import type { Check, CheckControlProps } from "./types";

function ViewportControl({ viewport, setViewport }: CheckControlProps) {
  return (
    <div className="check-viewport" role="group" aria-label="Viewport">
      {VIEWPORTS.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={viewport === v}
          onClick={() => setViewport(v)}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

export const viewportCheck: Check = {
  id: "viewport",
  label: "Viewport",
  Control: ViewportControl,
};
```

Create `apps/qa-portal/app/checks/index.ts` (the one place checks are registered; import this to get a populated registry):

```ts
import { getChecks, registerCheck } from "./registry";
import { viewportCheck } from "./viewport";

registerCheck(viewportCheck);

export { getChecks };
export type { Check, CheckControlProps } from "./types";
```

- [ ] **Step 12: Run the viewport-check test to verify it passes**

Run: `pnpm vitest run apps/qa-portal/app/checks/index.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 13: Commit**

```bash
git add apps/qa-portal/app/lib/viewport.ts apps/qa-portal/app/lib/viewport.test.ts \
  apps/qa-portal/app/checks
git commit -m "feat(qa-portal): pluggable checks registry + viewport check"
```

---

### Task 4: Brand routing + gallery + brand switcher (SSR shell)

**Files:**
- Create: `apps/qa-portal/app/components/BrandSwitcher.tsx`
- Create: `apps/qa-portal/app/components/PreviewFrame.tsx`
- Create: `apps/qa-portal/app/[brand]/layout.tsx`
- Create: `apps/qa-portal/app/[brand]/page.tsx`

**Interfaces:**
- Consumes (Tasks 1–2): `BRANDS`, `BRAND_LABELS`, `isBrand`, `type Brand`, `listComponents`, `previewSrc`.
- Produces: `<BrandSwitcher active={brand} />` (server component nav over `BRANDS`); `<PreviewFrame brand component />` (this task: a plain desktop-width iframe — Task 5 upgrades it with the checks rail); the `/[brand]` route prerendered for all 4 brands via `generateStaticParams`.

- [ ] **Step 1: Create the brand switcher**

Create `apps/qa-portal/app/components/BrandSwitcher.tsx` (no client JS needed — `next/link` works in server components):

```tsx
import Link from "next/link";
import { BRANDS, BRAND_LABELS, type Brand } from "../lib/brands";

export function BrandSwitcher({ active }: { active: Brand }) {
  return (
    <nav className="brand-switcher" aria-label="Brand">
      {BRANDS.map((b) => (
        <Link key={b} href={`/${b}`} aria-current={b === active ? "page" : undefined}>
          {BRAND_LABELS[b]}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Create the initial PreviewFrame (plain iframe, desktop width)**

Create `apps/qa-portal/app/components/PreviewFrame.tsx`:

```tsx
import { previewSrc } from "../lib/bundle";
import type { Brand } from "../lib/brands";
import { viewportWidth } from "../lib/viewport";

export function PreviewFrame({ brand, component }: { brand: Brand; component: string }) {
  return (
    <figure className="preview">
      <figcaption>{component}</figcaption>
      <div className="preview-stage">
        <iframe
          title={`${brand} ${component} preview`}
          src={previewSrc(brand, component)}
          style={{ width: viewportWidth("desktop"), maxWidth: "100%" }}
          height={460}
          loading="lazy"
        />
      </div>
    </figure>
  );
}
```

- [ ] **Step 3: Create the brand layout (chrome + switcher, brand-guarded)**

Create `apps/qa-portal/app/[brand]/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isBrand } from "../lib/brands";
import { BrandSwitcher } from "../components/BrandSwitcher";

export default async function BrandLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ brand: string }>;
}) {
  const { brand } = await params;
  if (!isBrand(brand)) notFound();
  return (
    <div className="portal">
      <header className="portal-header">
        <h1>Grove Component QA</h1>
        <BrandSwitcher active={brand} />
      </header>
      {children}
    </div>
  );
}
```

- [ ] **Step 4: Create the gallery page (prerendered per brand)**

Create `apps/qa-portal/app/[brand]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { BRANDS, isBrand } from "../lib/brands";
import { listComponents } from "../lib/bundle";
import { PreviewFrame } from "../components/PreviewFrame";

export function generateStaticParams() {
  return BRANDS.map((brand) => ({ brand }));
}

export default async function BrandGallery({ params }: { params: Promise<{ brand: string }> }) {
  const { brand } = await params;
  if (!isBrand(brand)) notFound();
  const components = listComponents(brand);
  return (
    <main className="gallery">
      {components.map((component) => (
        <PreviewFrame key={component} brand={brand} component={component} />
      ))}
    </main>
  );
}
```

- [ ] **Step 5: Build (bundles sync via prebuild) and SSR-smoke the gallery**

Run:
```bash
eval "$(fnm env)" && fnm use 22
pnpm --filter @grove/qa-portal build      # prebuild syncs dist-bundles → public/bundles
pnpm --filter @grove/qa-portal start &
SERVER_PID=$!
sleep 4
echo "--- iframe count (expect 11) ---"
curl -s http://localhost:3005/goldberry | grep -c 'components/general/'
echo "--- brand switcher present (expect >=1) ---"
curl -s http://localhost:3005/goldberry | grep -c 'GGG Woodworking'
echo "--- unknown brand 404s (expect 404) ---"
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3005/bogus
kill $SERVER_PID
```
Expected: iframe count `11`; brand-switcher grep `>=1`; unknown brand prints `404`.

- [ ] **Step 6: Commit**

```bash
git add apps/qa-portal/app/components apps/qa-portal/app/\[brand\]
git commit -m "feat(qa-portal): brand routing, gallery, and brand switcher"
```

---

### Task 5: Wire the viewport check into PreviewFrame (interactive rail)

**Files:**
- Modify: `apps/qa-portal/app/components/PreviewFrame.tsx` (server → client; render the checks rail; resize the iframe by viewport)

**Interfaces:**
- Consumes (Tasks 3–4): `getChecks` (from `../checks`), `previewSrc`, `viewportWidth`, `type Viewport`, `type Brand`.
- Produces: the final `<PreviewFrame brand component />` — a client component holding `viewport` state, rendering every registered check's `Control` in the rail, and sizing the iframe to `viewportWidth(viewport)`. Same props as Task 4, so the gallery page needs no change.

- [ ] **Step 1: Upgrade PreviewFrame to drive the viewport from the checks rail**

Replace the entire contents of `apps/qa-portal/app/components/PreviewFrame.tsx`:

```tsx
"use client";

import { useRef, useState } from "react";
import { previewSrc } from "../lib/bundle";
import type { Brand } from "../lib/brands";
import { viewportWidth, type Viewport } from "../lib/viewport";
import { getChecks } from "../checks";

export function PreviewFrame({ brand, component }: { brand: Brand; component: string }) {
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  return (
    <figure className="preview">
      <figcaption>{component}</figcaption>
      <div className="preview-rail">
        {getChecks().map((check) => (
          <check.Control
            key={check.id}
            viewport={viewport}
            setViewport={setViewport}
            frameRef={frameRef}
          />
        ))}
      </div>
      <div className="preview-stage">
        <iframe
          ref={frameRef}
          title={`${brand} ${component} preview`}
          src={previewSrc(brand, component)}
          style={{ width: viewportWidth(viewport), maxWidth: "100%" }}
          height={460}
          loading="lazy"
        />
      </div>
    </figure>
  );
}
```

- [ ] **Step 2: Type-check (a client component must not read `fs`)**

Run: `pnpm --filter @grove/qa-portal type-check`
Expected: clean. (`previewSrc`/`viewportWidth`/`getChecks` are pure — no `node:fs` reaches the client bundle; `listComponents`, the only `fs` user, stays in the server-side gallery page.)

- [ ] **Step 3: Build and SSR-smoke the rail (viewport buttons render per preview)**

Run:
```bash
eval "$(fnm env)" && fnm use 22
pnpm --filter @grove/qa-portal build
pnpm --filter @grove/qa-portal start &
SERVER_PID=$!
sleep 4
echo "--- viewport buttons in SSR markup (expect >=11 each: one per preview) ---"
curl -s http://localhost:3005/goldberry | grep -o 'aria-pressed' | wc -l
curl -s http://localhost:3005/goldberry | grep -oc 'aria-label="Viewport"'
echo "--- still 11 previews ---"
curl -s http://localhost:3005/goldberry | grep -c 'components/general/'
kill $SERVER_PID
```
Expected: `aria-pressed` count `>=33` (3 buttons × 11 previews) and `aria-label="Viewport"` count `11`; preview count `11`. (The pure resize math is covered by `viewport.test.ts`; live click-to-resize is browser behavior — see Self-Review note on deferred Playwright E2E.)

- [ ] **Step 4: Full check — lint + type-check + the whole portal test suite**

Run:
```bash
pnpm --filter @grove/qa-portal lint
pnpm --filter @grove/qa-portal type-check
pnpm vitest run apps/qa-portal
```
Expected: lint clean; type-check clean; all Task 1–3 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/qa-portal/app/components/PreviewFrame.tsx
git commit -m "feat(qa-portal): drive preview viewport from the checks rail"
```

---

## Self-Review

**Spec coverage (slice-1 §3 "in scope", §4 architecture, §5 modules):**
- "A new Next app `apps/qa-portal` … deployed to DO" → Task 1 scaffolds the standalone Next app (DO/Docker deploy wiring is Plan 05). ✅
- "One portal, brand-in-route (`/goldberry`…), brand switcher" → Task 4 (`[brand]` route + `BrandSwitcher`). ✅
- "Component gallery (iframe-per-preview) + viewport switching" → Task 4 gallery + Task 5 viewport rail. ✅
- "A pluggable checks registry shipping exactly one check (viewport)" → Task 3 (`registry.ts` + `viewportCheck`), wired in Task 5. ✅
- Render-shell module "Input: a brand's built bundle (`components/<group>/<Name>/<Name>.html`)" → Task 2 `previewSrc` + sync (relative-asset-preserving copy). ✅
- **Deferred by design (not gaps):** feedback capture/store (Plan 03), backstage triage + issue filer (Plan 04), DO deploy + Dockerfile + Infisical secrets + gated invite link + admin auth (Plan 05). This plan is exactly subsystem **A** (render shell) + the **E-min** app scaffold it rides on.

**Placeholder scan:** No TBD/TODO; every code step ships complete file contents; every run step has an exact command + expected output. ✅

**Type/name consistency:** `Brand`, `BRANDS`, `isBrand`, `BRAND_LABELS` (Task 1) used verbatim in Tasks 2/4. `listComponents`/`previewSrc` (Task 2) consumed unchanged in Task 4. `Viewport`/`viewportWidth`/`VIEWPORTS` (Task 3) consumed in Tasks 3/5. `Check`/`CheckControlProps`/`getChecks`/`registerCheck`/`viewportCheck` defined in Task 3 and consumed in Task 5. `PreviewFrame`'s props (`{ brand, component }`) are identical in Task 4 and Task 5, so the Task 5 upgrade needs no page change. ✅

**Known follow-ups (deferred, not gaps):**
- **Playwright E2E** — the repo has no `@playwright/test` today; introducing it is its own setup. Plan 02 verifies logic via Vitest and the rendered shell via build + curl SSR smoke (matching the repo's current test maturity). The live "click viewport → iframe resizes" assertion lands when Playwright is introduced (naturally alongside Plan 03's "submit a comment → it persists" smoke, per spec §10). Flagged so it isn't mistaken for missing coverage.
- **`force-dynamic` vs static** — `generateStaticParams` prerenders all 4 brands at build (bundles are present post-`prebuild`), so the gallery reads the dir at build time. If a later slice wants components to appear without a rebuild, switch the page to `export const dynamic = "force-dynamic"`; not needed for the skeleton.
- **`server-only` dep** — listed in `package.json` for parity with the brand apps and available if a later task wants to harden the `fs`-reading lib against client import; Plan 02 keeps the server/client split by file placement.
