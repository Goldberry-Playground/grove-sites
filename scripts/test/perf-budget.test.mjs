// perf-budget.mjs + css-component-budget.mjs — the CI performance-budget gate
// (GOL-866, spec GOL-864 §1). Exercised through the CLI with PERF_BUDGET_ROOT
// pointed at a throwaway fixture tree, because the contract that matters is the
// exit code CI branches on and the JSON report, not the internals.
//
// Run: node --test scripts/test/perf-budget.test.mjs
//
// The bugs worth catching: a gate that passes a route it should fail (shared
// chunk double-counted the wrong way, ceiling not enforced), and a ratchet that
// lets a grandfathered stylesheet grow. Most tests pin those.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { gzipSync } from "node:zlib";
import { randomBytes } from "node:crypto";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

const HERE = import.meta.dirname;
const ROOT = join(HERE, "..", "..");
const ROUTE = join(ROOT, "scripts", "perf-budget.mjs");
const CSS = join(ROOT, "scripts", "css-component-budget.mjs");

// Run a gate against a fixture root. Returns { code, stdout, stderr }.
function run(script, fixtureRoot, args = []) {
  try {
    const stdout = execFileSync("node", [script, ...args], {
      env: { ...process.env, PERF_BUDGET_ROOT: fixtureRoot },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, stdout, stderr: "" };
  } catch (err) {
    return { code: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

function tmpRoot() {
  return mkdtempSync(join(tmpdir(), "perf-budget-"));
}

// Write a file whose gzip size is at least `minGz` bytes. Random bytes barely
// compress, so base64 of enough entropy overshoots predictably; we then verify.
function writeChunk(absPath, minGz) {
  mkdirSync(dirname(absPath), { recursive: true });
  let payload = randomBytes(Math.max(64, minGz * 2)).toString("base64");
  while (gzipSync(Buffer.from(payload)).length < minGz) {
    payload += randomBytes(minGz).toString("base64");
  }
  writeFileSync(absPath, payload);
  return gzipSync(Buffer.from(payload)).length;
}

function writeRouteConfig(root, route) {
  writeFileSync(
    join(root, "perf-budget.config.json"),
    JSON.stringify({ route, componentCss: { include: [], warnBytes: 2048, errorBytes: 6144 } }),
  );
}

// ── route budget ────────────────────────────────────────────────────────────

test("route gate: exit 2 when nothing is built", () => {
  const root = tmpRoot();
  try {
    writeRouteConfig(root, { js: { budgetBytes: 200, ceilingBytes: 500 }, css: { errorBytes: 300 } });
    mkdirSync(join(root, "apps"), { recursive: true });
    const r = run(ROUTE, root);
    assert.equal(r.code, 2, "no .next output must be a hard error, not a silent pass");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// Build apps/<app>/.next with the two manifests + the referenced static files.
function buildApp(root, app, { rootMain, pages, chunkGz = {} }) {
  const next = join(root, "apps", app, ".next");
  mkdirSync(next, { recursive: true });
  const all = new Set([...(rootMain || []), ...Object.values(pages).flat()]);
  for (const f of all) writeChunk(join(next, f), chunkGz[f] ?? 40);
  writeFileSync(join(next, "build-manifest.json"), JSON.stringify({ rootMainFiles: rootMain || [] }));
  writeFileSync(join(next, "app-build-manifest.json"), JSON.stringify({ pages }));
}

test("route gate: a route within budget passes", () => {
  const root = tmpRoot();
  try {
    writeRouteConfig(root, { js: { budgetBytes: 5000, ceilingBytes: 20000 }, css: { errorBytes: 5000 } });
    buildApp(root, "nursery", {
      rootMain: ["static/chunks/main.js"],
      pages: { "/page": ["static/chunks/main.js", "static/chunks/home.js", "static/css/home.css"] },
    });
    const r = run(ROUTE, root, ["--json"]);
    assert.equal(r.code, 0);
    const report = JSON.parse(r.stdout);
    assert.equal(report.hasError, false);
    assert.equal(report.apps[0].routes[0].route, "/");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("route gate: JS over the ceiling fails with exit 1", () => {
  const root = tmpRoot();
  try {
    writeRouteConfig(root, { js: { budgetBytes: 200, ceilingBytes: 500 }, css: { errorBytes: 5000 } });
    buildApp(root, "hub", {
      rootMain: [],
      pages: { "/heavy/page": ["static/chunks/heavy.js"] },
      chunkGz: { "static/chunks/heavy.js": 900 },
    });
    const r = run(ROUTE, root, ["--json"]);
    assert.equal(r.code, 1);
    const report = JSON.parse(r.stdout);
    assert.equal(report.apps[0].routes[0].jsError, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("route gate: CSS over the per-route budget fails", () => {
  const root = tmpRoot();
  try {
    writeRouteConfig(root, { js: { budgetBytes: 5000, ceilingBytes: 20000 }, css: { errorBytes: 300 } });
    buildApp(root, "ggg", {
      rootMain: [],
      pages: { "/page": ["static/css/big.css"] },
      chunkGz: { "static/css/big.css": 700 },
    });
    const r = run(ROUTE, root, ["--json"]);
    assert.equal(r.code, 1);
    assert.equal(JSON.parse(r.stdout).apps[0].routes[0].cssError, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("route gate: shared runtime chunk is counted once, not per-route", () => {
  const root = tmpRoot();
  try {
    writeRouteConfig(root, { js: { budgetBytes: 1e9, ceilingBytes: 1e9 }, css: { errorBytes: 1e9 } });
    // Same path in rootMainFiles AND the page's chunks — the classic
    // double-count trap. Reported JS must equal the single file's gz size.
    buildApp(root, "goldberry", {
      rootMain: ["static/chunks/main.js"],
      pages: { "/page": ["static/chunks/main.js"] },
      chunkGz: { "static/chunks/main.js": 400 },
    });
    const singleGz = gzipSync(
      readFileSync(join(root, "apps/goldberry/.next/static/chunks/main.js")),
    ).length;
    const report = JSON.parse(run(ROUTE, root, ["--json"]).stdout);
    assert.equal(
      report.apps[0].routes[0].jsBytes,
      singleGz,
      "a chunk shared by rootMain and the route must be counted once",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("route gate: JS over budget but under ceiling warns without failing", () => {
  const root = tmpRoot();
  try {
    writeRouteConfig(root, { js: { budgetBytes: 300, ceilingBytes: 5000 }, css: { errorBytes: 5000 } });
    buildApp(root, "nursery", {
      rootMain: [],
      pages: { "/page": ["static/chunks/mid.js"] },
      chunkGz: { "static/chunks/mid.js": 700 },
    });
    const r = run(ROUTE, root, ["--json"]);
    assert.equal(r.code, 0);
    const report = JSON.parse(r.stdout);
    assert.equal(report.hasWarn, true);
    assert.equal(report.hasError, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// ── component CSS ceiling ─────────────────────────────────────────────────

function writeCssConfig(root, { baseline = {}, warnBytes = 2048, errorBytes = 6144 } = {}) {
  writeFileSync(
    join(root, "perf-budget.config.json"),
    JSON.stringify({
      route: { js: { budgetBytes: 1, ceilingBytes: 1 }, css: { errorBytes: 1 } },
      componentCss: {
        include: ["packages/grove-ui/src/**/*.css"],
        exclude: [],
        warnBytes,
        errorBytes,
        baseline,
      },
    }, null, 2) + "\n",
  );
}

function writeComponentCss(root, rel, bytes) {
  const abs = join(root, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, "a".repeat(bytes));
}

test("css gate: a small component stylesheet passes", () => {
  const root = tmpRoot();
  try {
    writeCssConfig(root);
    writeComponentCss(root, "packages/grove-ui/src/Button/Button.css", 500);
    const r = run(CSS, root, ["--json"]);
    assert.equal(r.code, 0);
    assert.equal(JSON.parse(r.stdout).hasError, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("css gate: a new file over the 6 KB ceiling fails", () => {
  const root = tmpRoot();
  try {
    writeCssConfig(root);
    writeComponentCss(root, "packages/grove-ui/src/Fat/Fat.css", 7000);
    const r = run(CSS, root, ["--json"]);
    assert.equal(r.code, 1);
    assert.equal(JSON.parse(r.stdout).results[0].error, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("css gate: a grandfathered file at its baseline passes but may not grow", () => {
  const root = tmpRoot();
  const rel = "packages/grove-ui/src/Legacy/Legacy.css";
  try {
    // At baseline → ok.
    writeCssConfig(root, { baseline: { [rel]: 9000 } });
    writeComponentCss(root, rel, 9000);
    let r = run(CSS, root, ["--json"]);
    assert.equal(r.code, 0, "a grandfathered file at its baseline size must pass");

    // Grows one byte past baseline → error.
    writeComponentCss(root, rel, 9001);
    r = run(CSS, root, ["--json"]);
    assert.equal(r.code, 1, "a grandfathered file may only shrink");
    assert.equal(JSON.parse(r.stdout).results[0].error, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("css gate: --update-baseline records current over-ceiling files", () => {
  const root = tmpRoot();
  const rel = "packages/grove-ui/src/Fat/Fat.css";
  try {
    writeCssConfig(root);
    writeComponentCss(root, rel, 8000);
    const r = run(CSS, root, ["--update-baseline"]);
    assert.equal(r.code, 0);
    const cfg = JSON.parse(readFileSync(join(root, "perf-budget.config.json"), "utf8"));
    assert.equal(cfg.componentCss.baseline[rel], 8000);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
