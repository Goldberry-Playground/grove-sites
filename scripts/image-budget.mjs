#!/usr/bin/env node
// Image consistency gate. See docs/perf-budget.md and
// docs/storefront-delivery-standard.md.
//
// Checks source only, so it needs no install or build:
//   1. Every app with an `images` block spreads `groveImageDefaults` and does
//      not set formats, deviceSizes, qualities or minimumCacheTTL itself.
//   2. Every `fill` image, and every ProductImage, declares `sizes`.
//   3. A `sizes` literal doesn't end in a bare partial-viewport value such as
//      `33vw`, which over-requests inside a capped layout. Existing uses are
//      grandfathered per file in perf-budget.config.json and may only shrink.
//
// Usage: node scripts/image-budget.mjs [--json] [--update-baseline]
// Exit: 0 pass, 1 violation, 2 could not run. PERF_BUDGET_ROOT overrides the root.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.env.PERF_BUDGET_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = join(ROOT, "perf-budget.config.json");
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "e2e", "coverage"]);
const LOCKED_KEYS = ["formats", "deviceSizes", "qualities", "minimumCacheTTL"];
const args = new Set(process.argv.slice(2));

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.has(name)) walk(full, out);
    } else if (name.endsWith(".tsx") && !/\.(test|stories)\.tsx$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const rel = (path) => relative(ROOT, path).split(sep).join("/");
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/** Text inside the balanced braces that open at `open`, skipping strings and comments. */
function balanced(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") {
      i = text.indexOf("\n", i);
      if (i === -1) return null;
    } else if (c === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i) + 1;
      if (i === 0) return null;
    } else if (c === '"' || c === "'" || c === "`") {
      for (i++; i < text.length && text[i] !== c; i++) if (text[i] === "\\") i++;
    } else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return text.slice(open + 1, i);
  }
  return null;
}

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/^\s*\/\/.*$/gm, "");
}

/** Violations for one next.config source. */
export function checkNextConfig(source) {
  const match = /\bimages:\s*\{/.exec(source);
  if (!match) return [];
  const body = balanced(source, match.index + match[0].length - 1);
  if (body === null) return ["could not parse the images block"];
  const code = stripComments(body);
  const problems = [];
  if (!/\.\.\.groveImageDefaults\b/.test(code)) problems.push("images must spread groveImageDefaults");
  // Only top-level keys count; nested remotePatterns entries are left alone.
  let depth = 0;
  let top = "";
  for (const c of code) {
    if ("{[(".includes(c)) depth++;
    else if ("}])".includes(c)) depth--;
    else if (depth === 0) top += c;
  }
  for (const key of LOCKED_KEYS) {
    if (new RegExp(`\\b${key}\\s*:`).test(top)) problems.push(`images.${key} must come from groveImageDefaults`);
  }
  return problems;
}

/** Opening JSX tags named Image or ProductImage, with attribute text. */
export function findImageTags(source) {
  const tags = [];
  const re = /<(Image|ProductImage)(?=[\s/>])/g;
  let m;
  while ((m = re.exec(source))) {
    let depth = 0;
    let quote = null;
    let end = -1;
    for (let i = m.index + m[0].length; i < source.length; i++) {
      const c = source[i];
      if (quote) {
        if (c === "\\") i++;
        else if (c === quote) quote = null;
      } else if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth++;
      else if (c === "}") depth--;
      else if (c === ">" && depth === 0 && source[i - 1] !== "=") {
        end = i;
        break;
      }
    }
    if (end === -1) continue;
    tags.push({ name: m[1], attrs: source.slice(m.index + m[0].length, end), index: m.index });
  }
  return tags;
}

/** The final term of a `sizes` string when it's a bare partial-viewport value. */
export function uncappedTerm(sizes) {
  const last = sizes.split(",").pop().trim();
  const match = /^(\d+(?:\.\d+)?)vw$/.exec(last);
  return match && Number(match[1]) < 100 ? last : null;
}

/** Violations and grandfathered-rule counts for one TSX source. */
export function checkSource(source) {
  const errors = [];
  let uncapped = 0;
  for (const tag of findImageTags(source)) {
    const line = lineOf(source, tag.index);
    const hasSizes = /(^|\s)sizes=/.test(tag.attrs);
    const isFill = /(^|\s)fill(\s|=|$|\/)/.test(tag.attrs);
    // A spread may carry sizes; the wrapper's own usage is checked at call sites.
    const hasSpread = /\{\s*\.\.\./.test(tag.attrs);
    if (!hasSizes && !hasSpread && (isFill || tag.name === "ProductImage")) {
      errors.push({ line, message: `<${tag.name}> needs a sizes prop` });
    }
    const literal = /(?:^|\s)sizes=(?:"([^"]*)"|\{\s*"([^"]*)"\s*\})/.exec(tag.attrs);
    if (literal && uncappedTerm(literal[1] ?? literal[2])) uncapped++;
  }
  return { errors, uncapped };
}

function report(result, json) {
  if (json) console.log(JSON.stringify(result, null, 2));
  else if (result.violations.length === 0) {
    console.log(`image-budget: OK (${result.configs} configs, ${result.files} files)`);
  } else {
    for (const v of result.violations) console.log(`::error file=${v.file},line=${v.line ?? 1}::${v.message}`);
    console.log(`image-budget: ${result.violations.length} violation(s). See docs/perf-budget.md.`);
  }
}

function main() {
  if (!existsSync(CONFIG)) {
    console.log(`::error::image-budget: missing ${CONFIG}`);
    process.exit(2);
  }
  const config = JSON.parse(readFileSync(CONFIG, "utf8"));
  const baseline = config.images?.uncappedSizesBaseline ?? {};
  const apps = existsSync(join(ROOT, "apps")) ? readdirSync(join(ROOT, "apps")) : [];
  const violations = [];
  const counts = {};
  let configs = 0;
  for (const app of apps) {
    const path = join(ROOT, "apps", app, "next.config.ts");
    if (!existsSync(path)) continue;
    const source = readFileSync(path, "utf8");
    if (/\bimages:\s*\{/.test(source)) configs++;
    for (const message of checkNextConfig(source)) violations.push({ file: rel(path), message });
  }
  const files = [...walk(join(ROOT, "apps")), ...walk(join(ROOT, "packages"))];
  if (configs === 0 || files.length === 0) {
    console.log("::error::image-budget: found nothing to check");
    process.exit(2);
  }
  for (const path of files) {
    const file = rel(path);
    const { errors, uncapped } = checkSource(readFileSync(path, "utf8"));
    for (const e of errors) violations.push({ file, line: e.line, message: e.message });
    if (uncapped > 0) counts[file] = uncapped;
    if (uncapped > (baseline[file] ?? 0)) {
      violations.push({
        file,
        message: `sizes ends in a bare vw value ${uncapped} time(s), allowed ${baseline[file] ?? 0}. Cap it, e.g. min(33vw, 340px)`,
      });
    }
  }
  if (args.has("--update-baseline")) {
    config.images = { ...config.images, uncappedSizesBaseline: Object.fromEntries(Object.entries(counts).sort()) };
    writeFileSync(CONFIG, `${JSON.stringify(config, null, 2)}\n`);
    console.log(`image-budget: baseline now has ${Object.keys(counts).length} file(s)`);
    return;
  }
  report({ configs, files: files.length, violations }, args.has("--json"));
  process.exit(violations.length ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
