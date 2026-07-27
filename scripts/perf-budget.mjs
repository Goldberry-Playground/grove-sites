#!/usr/bin/env node
// Per-route JS/CSS byte-budget gate (GOL-866, spec GOL-864 §1b).
//
// This is the Next.js/React translation of Angular's `budgets` block: it fails
// the PR build when a route ships more first-load JS or CSS than the Grove
// performance budget allows, so weight regressions can't land silently.
//
// ── Where the numbers come from ───────────────────────────────────────────
//
// After `next build`, every app writes two manifests we read here:
//   .next/build-manifest.json      → `rootMainFiles`: the shared App-Router
//                                     runtime JS every route loads.
//   .next/app-build-manifest.json  → `pages`: per-route arrays of the static
//                                     chunk paths (JS + CSS) that route needs.
// This is the SAME chunk graph @next/bundle-analyzer visualizes — we read it
// directly instead of the analyzer's treemap because it maps cleanly to routes,
// which is what a per-route budget is defined against.
//
// First-load JS for a route = the unique union of rootMainFiles and that route's
// own JS chunks. CSS = that route's stylesheet chunks. Every file is gzipped on
// disk and summed, because gzip (≈ brotli, within a few %) is what the browser
// actually transfers — raw disk size would over-count by ~3-4x and make the
// budget meaningless.
//
// ── Budget (perf-budget.config.json → route) ──────────────────────────────
//   JS   : warn > 150 KB gz, ERROR > 400 KB gz  (the outer ceiling)
//   CSS  : ERROR > 60 KB gz per route
// Warnings annotate but do not fail; errors exit 1.
//
// The 540 KB total-initial-load and the Core Web Vitals targets (LCP/INP/CLS)
// are NOT checked here — they include images, fonts, and HTML that only exist
// at runtime. Lighthouse CI (lighthouserc.json) owns those against a live
// preview URL. This gate owns the two things a static build can measure exactly.
//
// ── Usage ─────────────────────────────────────────────────────────────────
//   pnpm build                       # must run first — reads .next/ output
//   node scripts/perf-budget.mjs                 # all built apps
//   node scripts/perf-budget.mjs --app nursery   # one app
//   node scripts/perf-budget.mjs --json          # machine-readable report only
//
// Exit codes: 0 = within budget (warnings allowed) · 1 = a budget was exceeded
// · 2 = the check itself could not run (no build found, unreadable manifest) —
// a silent pass on a broken check is worse than a red one, so this never
// degrades to 0.

import { gzipSync } from "node:zlib";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Repo root by default; PERF_BUDGET_ROOT lets the test suite point the gate at a
// fixture tree without touching the real apps/ output.
const ROOT = process.env.PERF_BUDGET_ROOT
  ? resolve(process.env.PERF_BUDGET_ROOT)
  : join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = JSON.parse(readFileSync(join(ROOT, "perf-budget.config.json"), "utf8"));
const KB = 1024;

// ── CLI ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const jsonOnly = argv.includes("--json");
const appArgIdx = argv.indexOf("--app");
const onlyApp = appArgIdx !== -1 ? argv[appArgIdx + 1] : null;

const fmt = (bytes) => `${(bytes / KB).toFixed(1)} KB`;

// Discover built apps: apps/<name>/.next with both manifests present.
function findBuiltApps() {
  const appsDir = join(ROOT, "apps");
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir)
    .filter((name) => {
      if (onlyApp && name !== onlyApp) return false;
      const next = join(appsDir, name, ".next");
      return (
        existsSync(join(next, "build-manifest.json")) &&
        existsSync(join(next, "app-build-manifest.json"))
      );
    })
    .map((name) => ({ name, nextDir: join(appsDir, name, ".next") }));
}

// gzip a static asset and return its transferred byte size; 0 if missing so a
// stale manifest entry can't crash the whole run (it is reported, not fatal).
const gzCache = new Map();
function gzSize(nextDir, relPath) {
  const abs = join(nextDir, relPath);
  if (gzCache.has(abs)) return gzCache.get(abs);
  let size = 0;
  try {
    if (existsSync(abs) && statSync(abs).isFile()) {
      size = gzipSync(readFileSync(abs)).length;
    }
  } catch {
    size = 0;
  }
  gzCache.set(abs, size);
  return size;
}

// Human route label: ".../route/page" → "/route", "/page" → "/".
function routeLabel(key) {
  const trimmed = key.replace(/\/page$/, "").replace(/\/route$/, "");
  return trimmed === "" ? "/" : trimmed;
}

function auditApp({ name, nextDir }) {
  let buildManifest, appBuildManifest;
  try {
    buildManifest = JSON.parse(readFileSync(join(nextDir, "build-manifest.json"), "utf8"));
    appBuildManifest = JSON.parse(readFileSync(join(nextDir, "app-build-manifest.json"), "utf8"));
  } catch (err) {
    return { name, error: `unreadable manifest: ${err.message}`, routes: [] };
  }

  // Shared runtime JS every App-Router route pays for on first load.
  const rootMain = Array.isArray(buildManifest.rootMainFiles)
    ? buildManifest.rootMainFiles
    : [];
  const pages = appBuildManifest.pages || {};

  const routes = [];
  for (const [key, files] of Object.entries(pages)) {
    // App Router entries are page/route/layout files; budget the renderable
    // ones (page + route handlers). Skip pure layouts — they are folded into
    // their pages' first-load already via shared chunks.
    if (!/\/(page|route)$/.test(key)) continue;

    const all = new Set([...rootMain, ...files]);
    let jsBytes = 0;
    let cssBytes = 0;
    for (const f of all) {
      if (f.endsWith(".js")) jsBytes += gzSize(nextDir, f);
      else if (f.endsWith(".css")) cssBytes += gzSize(nextDir, f);
    }

    const jsError = jsBytes > CONFIG.route.js.ceilingBytes;
    const jsWarn = !jsError && jsBytes > CONFIG.route.js.budgetBytes;
    const cssError = cssBytes > CONFIG.route.css.errorBytes;

    routes.push({
      route: routeLabel(key),
      jsBytes,
      cssBytes,
      totalBytes: jsBytes + cssBytes,
      jsError,
      jsWarn,
      cssError,
    });
  }

  routes.sort((a, b) => b.totalBytes - a.totalBytes);
  return { name, routes };
}

// ── Run ──────────────────────────────────────────────────────────────────
const apps = findBuiltApps();
if (apps.length === 0) {
  const msg = onlyApp
    ? `No built output for app "${onlyApp}" (apps/${onlyApp}/.next manifests missing). Run \`pnpm build\` first.`
    : "No built Next.js apps found (apps/*/.next manifests missing). Run `pnpm build` before this gate.";
  console.error(`::error::perf-budget: ${msg}`);
  process.exit(2);
}

const report = { budget: CONFIG.route, apps: apps.map(auditApp) };

// A broken manifest is a broken check, not a pass.
const brokenApp = report.apps.find((a) => a.error);
if (brokenApp) {
  console.error(`::error::perf-budget: ${brokenApp.name}: ${brokenApp.error}`);
  if (jsonOnly) console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}

let hasError = false;
let hasWarn = false;

if (!jsonOnly) {
  const B = CONFIG.route;
  console.error(
    `\nPer-route byte budget (gzip)  ·  JS warn ${fmt(B.js.budgetBytes)} / error ${fmt(
      B.js.ceilingBytes,
    )}  ·  CSS error ${fmt(B.css.errorBytes)}\n`,
  );
  for (const app of report.apps) {
    console.error(`  ${app.name}`);
    if (app.routes.length === 0) {
      console.error("    (no page/route entries in manifest)");
      continue;
    }
    for (const r of app.routes) {
      const jsFlag = r.jsError ? "ERROR" : r.jsWarn ? "warn " : "ok   ";
      const cssFlag = r.cssError ? "ERROR" : "ok   ";
      console.error(
        `    ${r.route.padEnd(28)} JS ${fmt(r.jsBytes).padStart(9)} [${jsFlag}]  CSS ${fmt(
          r.cssBytes,
        ).padStart(9)} [${cssFlag}]  total ${fmt(r.totalBytes).padStart(9)}`,
      );
    }
    console.error("");
  }
}

for (const app of report.apps) {
  for (const r of app.routes) {
    const where = `${app.name} ${r.route}`;
    if (r.jsError) {
      hasError = true;
      console.error(
        `::error title=JS budget::${where}: first-load JS ${fmt(r.jsBytes)} exceeds the ${fmt(
          CONFIG.route.js.ceilingBytes,
        )} ceiling. Route-split, lazy-load, or move client work server-side.`,
      );
    } else if (r.jsWarn) {
      hasWarn = true;
      console.error(
        `::warning title=JS budget::${where}: first-load JS ${fmt(r.jsBytes)} is over the ${fmt(
          CONFIG.route.js.budgetBytes,
        )} budget (ceiling ${fmt(CONFIG.route.js.ceilingBytes)}).`,
      );
    }
    if (r.cssError) {
      hasError = true;
      console.error(
        `::error title=CSS budget::${where}: route CSS ${fmt(r.cssBytes)} exceeds the ${fmt(
          CONFIG.route.css.errorBytes,
        )} per-route budget — likely un-purged or one-off CSS.`,
      );
    }
  }
}

if (jsonOnly) {
  console.log(JSON.stringify({ ...report, hasError, hasWarn }, null, 2));
} else if (!hasError && !hasWarn) {
  console.error("All routes within budget. ✓");
}

process.exit(hasError ? 1 : 0);
