#!/usr/bin/env node
// Mobile viewport matrix — render each brand's key routes at phone / tablet /
// desktop widths in headless Chromium and fail on the responsive defects that
// have actually cost us orders.
//
// Why this exists: the 2026-10-26 WV checkout dead-end. On a phone, the pickup
// refusal message rendered BELOW a sticky bar and off-screen, so shoppers saw
// "can't check out" with no reason. Lighthouse did not catch it (it is not a
// performance defect) and no test rendered the page at 375px. This gate does.
//
// Checks per page × viewport (thresholds live in mobile-matrix.config.json):
//   viewportMeta  <meta name=viewport> with width=device-width      (all)
//   overflow      no horizontal scroll; lists the elements that poke out (all)
//   tapTargets    controls ≥ 24px (error) / ≥ 44px (warn), inline text links
//                 exempt                                            (mobile)
//   textSize      ≥ 60% of text at ≥ 12px (Lighthouse's rule); smaller
//                 text is listed as a warning                      (mobile)
//   fixedChrome   fixed/sticky elements may pin ≤ 35% of the screen (mobile)
//   screenshot    full-page PNG per cell → mobile-matrix-artifacts/ (evidence,
//                 no diffing)
//
// Targets are DEPLOYED pages — a per-PR preview, QA, or prod (read-only GETs).
// It does not start a dev server: the storefronts need Odoo/Ghost backends.
//
// ── Usage ─────────────────────────────────────────────────────────────────
//   node scripts/mobile-matrix.mjs --target goldberry=https://goldberrygrove.farm
//   node scripts/mobile-matrix.mjs --target nursery=https://nursery.pr-123.preview... \
//                                  --target hub=https://hub.pr-123.preview...
//   node scripts/mobile-matrix.mjs --targets-json '{"nursery":"https://…","hub":"https://…"}'
//   Options: --viewports mobile,desktop   --routes /,/shop   --json   --out <dir>
//            --no-screenshots
//
// Exit codes: 0 = no errors (warnings allowed) · 1 = at least one error ·
// 2 = the check could not run (bad args, Chromium failed to launch, every page
// unreachable). A broken check is red, never a silent green.

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = JSON.parse(readFileSync(join(ROOT, "mobile-matrix.config.json"), "utf8"));

// ── Args ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const flagVals = (name) => {
  const out = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === `--${name}` && argv[i + 1] != null) out.push(argv[++i]);
  return out;
};
const has = (name) => argv.includes(`--${name}`);

const targets = {};
for (const t of flagVals("target")) {
  const eq = t.indexOf("=");
  if (eq < 1) usage(`--target expects brand=url, got "${t}"`);
  targets[t.slice(0, eq)] = t.slice(eq + 1).replace(/\/$/, "");
}
for (const j of flagVals("targets-json")) {
  let parsed;
  try { parsed = JSON.parse(j); } catch { usage("--targets-json is not valid JSON"); }
  for (const [brand, url] of Object.entries(parsed)) targets[brand] = String(url).replace(/\/$/, "");
}
if (Object.keys(targets).length === 0) usage("no targets given");

for (const brand of Object.keys(targets)) {
  if (!CONFIG.routes[brand]) usage(`unknown brand "${brand}" — known: ${Object.keys(CONFIG.routes).filter((k) => !k.startsWith("$")).join(", ")}`);
}

const viewportNames = flagVals("viewports")[0]?.split(",") ?? Object.keys(CONFIG.viewports).filter((k) => !k.startsWith("$"));
for (const v of viewportNames) if (!CONFIG.viewports[v]) usage(`unknown viewport "${v}"`);
const routeOverride = flagVals("routes")[0]?.split(",");
const jsonOnly = has("json");
const screenshots = !has("no-screenshots");
const outDir = resolve(ROOT, flagVals("out")[0] ?? CONFIG.report.artifactsDir);

function usage(msg) {
  console.error(`::error::mobile-matrix: ${msg}`);
  console.error("usage: node scripts/mobile-matrix.mjs --target <brand>=<url> [--target …] [--viewports a,b] [--routes /,/x] [--json] [--out dir] [--no-screenshots]");
  process.exit(2);
}

// ── Playwright ─────────────────────────────────────────────────────────────
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("::error::mobile-matrix: `playwright` is not installed — run `pnpm install` (it is a root devDependency).");
  process.exit(2);
}

// ── In-page audit (runs inside the browser) ────────────────────────────────
// One function, serialized by Playwright. Keep it self-contained: no imports,
// no closures over Node state. `cfg` is CONFIG.checks + the viewport flag.
function auditPage(cfg) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const MAX = cfg.maxItems;

  const describe = (el) => {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : "";
    const cls = el.classList.length ? "." + [...el.classList].slice(0, 3).join(".") : "";
    const text = (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
    return `${tag}${id}${cls}${text ? ` “${text}”` : ""}`;
  };
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const findings = {};

  // viewportMeta
  const meta = document.querySelector('meta[name="viewport"]');
  findings.viewportMeta = {
    ok: !!meta && /width\s*=\s*device-width/i.test(meta.getAttribute("content") || ""),
    content: meta ? meta.getAttribute("content") : null,
  };

  // overflow
  const scrollW = document.documentElement.scrollWidth;
  const overflowing = [];
  if (scrollW > vw + cfg.overflow.tolerancePx) {
    for (const el of document.body.querySelectorAll("*")) {
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.right > vw + cfg.overflow.tolerancePx && r.width > 0) {
        overflowing.push({ el: describe(el), right: Math.round(r.right), width: Math.round(r.width) });
      }
    }
    overflowing.sort((a, b) => b.right - a.right);
  }
  findings.overflow = { scrollWidth: scrollW, innerWidth: vw, items: overflowing.slice(0, MAX), total: overflowing.length };

  if (cfg.mobile) {
    // tapTargets
    const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="link"], summary';
    const small = [];
    for (const el of document.querySelectorAll(sel)) {
      if (!visible(el)) continue;
      const cs = getComputedStyle(el);
      // WCAG 2.5.8 exemption: a link that sits inline in a sentence.
      if (cs.display === "inline" && el.parentElement) {
        const hasText = [...el.parentElement.childNodes].some(
          (n) => n.nodeType === 3 && n.textContent.trim().length > 0,
        );
        if (hasText) continue;
      }
      // A checkbox/radio is 18px by nature; its hit area is the label that
      // wraps it or points at it, so measure that (WCAG counts the label).
      let r = el.getBoundingClientRect();
      if (el.tagName === "INPUT" && /^(checkbox|radio)$/i.test(el.type)) {
        const label = el.closest("label") || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
        if (label) {
          const lr = label.getBoundingClientRect();
          r = {
            width: Math.max(lr.right, r.right) - Math.min(lr.left, r.left),
            height: Math.max(lr.bottom, r.bottom) - Math.min(lr.top, r.top),
          };
        }
      }
      const side = Math.min(r.width, r.height);
      if (side < cfg.tapTargets.warnPx) {
        small.push({ el: describe(el), w: Math.round(r.width), h: Math.round(r.height), side: Math.round(side) });
      }
    }
    small.sort((a, b) => a.side - b.side);
    findings.tapTargets = {
      errors: small.filter((s) => s.side < cfg.tapTargets.errorPx),
      warns: small.filter((s) => s.side >= cfg.tapTargets.errorPx),
    };
    findings.tapTargets.errorTotal = findings.tapTargets.errors.length;
    findings.tapTargets.warnTotal = findings.tapTargets.warns.length;
    findings.tapTargets.errors = findings.tapTargets.errors.slice(0, MAX);
    findings.tapTargets.warns = findings.tapTargets.warns.slice(0, MAX);

    // textSize — Lighthouse's legibility rule: ≥ 60% of visible text (by
    // characters) must be ≥ 12px. Elements under the floor are listed too.
    const tiny = [];
    let legibleChars = 0;
    let totalChars = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    for (let el = walker.nextNode(); el; el = walker.nextNode()) {
      if (/^(script|style|noscript|svg|template)$/i.test(el.tagName)) continue;
      const ownChars = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .reduce((n, t) => n + t.textContent.trim().length, 0);
      if (!ownChars || !visible(el)) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      totalChars += ownChars;
      if (fs >= cfg.textSize.minLegiblePx) legibleChars += ownChars;
      else tiny.push({ el: describe(el), px: Math.round(fs * 10) / 10, chars: ownChars });
    }
    tiny.sort((a, b) => a.px - b.px);
    findings.textSize = {
      legibleShare: totalChars ? Math.round((legibleChars / totalChars) * 1000) / 1000 : 1,
      totalChars,
      smallTotal: tiny.length,
      small: tiny.slice(0, MAX),
    };

    // fixedChrome — union of vertical extents of pinned elements in view.
    const pinned = [];
    for (const el of document.body.querySelectorAll("*")) {
      const pos = getComputedStyle(el).position;
      if (pos !== "fixed" && pos !== "sticky") continue;
      if (!visible(el)) continue;
      const r = el.getBoundingClientRect();
      const top = Math.max(0, r.top);
      const bottom = Math.min(vh, r.bottom);
      if (bottom - top <= 0 || r.width < vw * 0.5) continue; // narrow floating buttons don't block content
      pinned.push({ el: describe(el), top: Math.round(top), bottom: Math.round(bottom), pos });
    }
    pinned.sort((a, b) => a.top - b.top);
    let covered = 0;
    let curTop = -1;
    let curBot = -1;
    for (const p of pinned) {
      if (p.top > curBot) {
        if (curBot > curTop) covered += curBot - curTop;
        curTop = p.top;
        curBot = p.bottom;
      } else curBot = Math.max(curBot, p.bottom);
    }
    if (curBot > curTop) covered += curBot - curTop;
    findings.fixedChrome = {
      coveredPx: covered,
      innerHeight: vh,
      fraction: Math.round((covered / vh) * 1000) / 1000,
      items: pinned.slice(0, MAX),
    };
  }

  return findings;
}

// ── Run ────────────────────────────────────────────────────────────────────
let browser;
try {
  browser = await chromium.launch({
    args: (process.env.PW_CHROMIUM_ARGS || "").split(" ").filter(Boolean),
  });
} catch (err) {
  console.error(`::error::mobile-matrix: Chromium failed to launch — ${err.message}. Run: pnpm exec playwright install --with-deps chromium`);
  process.exit(2);
}

if (screenshots) mkdirSync(outDir, { recursive: true });

const cells = [];
let unreachable = 0;

for (const [brand, base] of Object.entries(targets)) {
  const routes = routeOverride ?? CONFIG.routes[brand];
  for (const route of routes) {
    const url = base + route;
    for (const vpName of viewportNames) {
      const vp = CONFIG.viewports[vpName];
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        deviceScaleFactor: vp.deviceScaleFactor,
        isMobile: vp.isMobile,
        hasTouch: vp.hasTouch,
        userAgent: vp.isMobile
          ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Mobile Safari/537.36 grove-mobile-matrix"
          : undefined,
      });
      const page = await context.newPage();
      const cell = { brand, route, url, viewport: vpName, status: null, errors: [], warns: [], findings: null, screenshot: null };
      try {
        const resp = await page.goto(url, { waitUntil: "load", timeout: CONFIG.navigation.timeoutMs });
        cell.status = resp ? resp.status() : null;
        if (cell.status != null && cell.status >= 400) {
          cell.errors.push(`page returned HTTP ${cell.status}`);
          unreachable++;
        } else {
          await page.waitForTimeout(CONFIG.navigation.settleMs);
          const f = await page.evaluate(auditPage, {
            ...CONFIG.checks,
            mobile: vpName === "mobile",
            maxItems: CONFIG.report.maxItemsPerFinding,
          });
          cell.findings = f;

          if (!f.viewportMeta.ok) cell.errors.push(`no <meta name=viewport> with width=device-width (got: ${f.viewportMeta.content ?? "none"})`);
          if (f.overflow.scrollWidth > f.overflow.innerWidth + CONFIG.checks.overflow.tolerancePx) {
            const top = f.overflow.items.slice(0, 3).map((i) => i.el).join("; ");
            cell.errors.push(`horizontal overflow: scrollWidth ${f.overflow.scrollWidth} > viewport ${f.overflow.innerWidth} (${f.overflow.total} element(s) cross the edge: ${top})`);
          }
          if (f.tapTargets) {
            if (f.tapTargets.errorTotal) cell.errors.push(`${f.tapTargets.errorTotal} tap target(s) under ${CONFIG.checks.tapTargets.errorPx}px: ${f.tapTargets.errors.slice(0, 3).map((t) => `${t.el} ${t.w}×${t.h}`).join("; ")}`);
            if (f.tapTargets.warnTotal) cell.warns.push(`${f.tapTargets.warnTotal} tap target(s) under ${CONFIG.checks.tapTargets.warnPx}px: ${f.tapTargets.warns.slice(0, 3).map((t) => `${t.el} ${t.w}×${t.h}`).join("; ")}`);
          }
          if (f.textSize) {
            const ts = CONFIG.checks.textSize;
            const pct = Math.round(f.textSize.legibleShare * 100);
            if (f.textSize.legibleShare < ts.minLegibleShare) {
              cell.errors.push(`only ${pct}% of text is ≥ ${ts.minLegiblePx}px (floor ${Math.round(ts.minLegibleShare * 100)}%): ${f.textSize.small.slice(0, 3).map((t) => `${t.el} ${t.px}px`).join("; ")}`);
            } else if (f.textSize.smallTotal) {
              cell.warns.push(`${f.textSize.smallTotal} text element(s) under ${ts.minLegiblePx}px (${pct}% of text is legible): ${f.textSize.small.slice(0, 3).map((t) => `${t.el} ${t.px}px`).join("; ")}`);
            }
          }
          if (f.fixedChrome && f.fixedChrome.fraction > CONFIG.checks.fixedChrome.maxFraction) {
            cell.errors.push(`fixed/sticky chrome covers ${Math.round(f.fixedChrome.fraction * 100)}% of the viewport (limit ${Math.round(CONFIG.checks.fixedChrome.maxFraction * 100)}%): ${f.fixedChrome.items.map((i) => `${i.el} [${i.pos} ${i.top}–${i.bottom}]`).join("; ")}`);
          }
        }
        if (screenshots) {
          const slug = `${brand}${route === "/" ? "-home" : route.replace(/\//g, "-")}-${vpName}.png`;
          const path = join(outDir, slug);
          await page.screenshot({ path, fullPage: true });
          cell.screenshot = slug;
        }
      } catch (err) {
        cell.errors.push(`navigation failed: ${err.message.split("\n")[0]}`);
        unreachable++;
      } finally {
        await context.close();
      }
      cells.push(cell);
    }
  }
}
await browser.close();

// ── Report ─────────────────────────────────────────────────────────────────
const hasError = cells.some((c) => c.errors.length > 0);
const hasWarn = cells.some((c) => c.warns.length > 0);
const allUnreachable = cells.length > 0 && unreachable === cells.length;

const report = {
  generatedAt: new Date().toISOString(),
  targets,
  viewports: viewportNames,
  cells,
  summary: {
    cells: cells.length,
    cellsWithErrors: cells.filter((c) => c.errors.length).length,
    cellsWithWarnings: cells.filter((c) => c.warns.length).length,
    unreachable,
  },
  hasError,
  hasWarn,
};
if (screenshots) writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 2) + "\n");

if (jsonOnly) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.error(`\nMobile viewport matrix  ·  ${Object.keys(targets).join(", ")}  ·  viewports: ${viewportNames.join(", ")}\n`);
  for (const c of cells) {
    const flag = c.errors.length ? "ERROR" : c.warns.length ? "warn " : "ok   ";
    console.error(`  [${flag}] ${c.brand.padEnd(9)} ${c.route.padEnd(20)} ${c.viewport.padEnd(8)} ${c.status ?? "—"}`);
    for (const e of c.errors) {
      console.error(`           ✗ ${e}`);
      console.error(`::error title=Mobile matrix ${c.viewport}::${c.brand} ${c.route} @ ${c.viewport}: ${e}`);
    }
    for (const w of c.warns) {
      console.error(`           ! ${w}`);
      console.error(`::warning title=Mobile matrix ${c.viewport}::${c.brand} ${c.route} @ ${c.viewport}: ${w}`);
    }
  }
  console.error(
    `\n${report.summary.cells} cell(s): ${report.summary.cellsWithErrors} with errors, ${report.summary.cellsWithWarnings} with warnings only, ${unreachable} unreachable.` +
      (screenshots ? `  Screenshots + report.json → ${outDir}` : ""),
  );
  if (!hasError && !hasWarn) console.error("Every page fits every viewport. ✓");
}

process.exit(allUnreachable ? 2 : hasError ? 1 : 0);
